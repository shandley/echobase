import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export type MatchedPaper = {
  id: number;
  pmid: number;
  title: string;
  abstract: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  similarity: number;
};

async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch(
    "https://api-inference.huggingface.co/pipeline/feature-extraction/NeuML/pubmedbert-base-embeddings",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "EchoBase/1.0",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    },
  );

  if (!response.ok) {
    throw new Error(`HuggingFace API error: ${response.status}`);
  }

  const data: unknown = await response.json();

  // HF returns the embedding directly as a flat array, or nested as [[...]]
  let embedding: unknown;
  if (Array.isArray(data) && Array.isArray((data as unknown[])[0])) {
    embedding = (data as unknown[][])[0];
  } else {
    embedding = data;
  }

  if (
    !Array.isArray(embedding) ||
    embedding.length === 0 ||
    typeof (embedding as unknown[])[0] !== "number"
  ) {
    throw new Error("HuggingFace API returned an unexpected response format");
  }

  return embedding as number[];
}

export async function POST(request: Request) {
  // Check for Anthropic API key early
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured. Add it to your environment variables to enable AI Q&A.",
      },
      { status: 503 },
    );
  }

  let question: string;
  try {
    const body = (await request.json()) as { question?: unknown };
    if (typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json(
        { error: "A non-empty question string is required." },
        { status: 400 },
      );
    }
    question = body.question.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Step 1: Embed the question
  let embedding: number[];
  try {
    embedding = await embedQuery(question);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate embedding: ${message}` },
      { status: 503 },
    );
  }

  // Step 2: Retrieve relevant papers via Supabase RPC
  let papers: MatchedPaper[];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("match_papers", {
      query_embedding: embedding,
      match_count: 8,
      match_threshold: 0.1,
    });

    if (error) {
      throw new Error(error.message);
    }

    papers = (data ?? []) as MatchedPaper[];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to retrieve papers: ${message}` },
      { status: 503 },
    );
  }

  if (papers.length === 0) {
    return NextResponse.json({
      answer:
        "No relevant papers were found in the database for this question.",
      papers: [],
    });
  }

  // Step 3: Build context string (truncate abstracts to 300 chars each)
  const papersContext = papers
    .map((p) => {
      const abstract = p.abstract
        ? p.abstract.length > 300
          ? `${p.abstract.slice(0, 300)}...`
          : p.abstract
        : "No abstract available.";
      return `PMID: ${p.pmid} | ${p.title} (${p.year ?? "year unknown"})\n${abstract}`;
    })
    .join("\n\n");

  // Step 4: Call Claude
  const prompt = `You are a scientific assistant specializing in bat (Chiroptera) biology.
Answer the question using ONLY the provided paper excerpts.
Cite papers inline as [PMID: 12345678].
If the papers don't contain enough information, say so clearly.
Keep answers concise -- 2-4 sentences per point.

Question: ${question}

Papers:
${papersContext}`;

  let answer: string;
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }
    answer = content.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate answer: ${message}` },
      { status: 503 },
    );
  }

  return NextResponse.json({ answer, papers });
}
