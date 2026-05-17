import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { stripHtml } from "@/lib/utils/format";

export type MatchedPaper = {
  id: number;
  pmid: number;
  title: string;
  abstract: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  similarity?: number;
};

// ── embedding via HuggingFace (optional -- falls back to keyword if unavailable) ──

async function embedQuery(text: string): Promise<number[] | null> {
  const hfToken = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "EchoBase/1.0",
  };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/NeuML/pubmedbert-base-embeddings",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) return null;

    const data: unknown = await response.json();
    const embedding = Array.isArray(data) && Array.isArray((data as unknown[][])[0])
      ? (data as number[][])[0]
      : (data as number[]);

    if (!Array.isArray(embedding) || typeof embedding[0] !== "number") return null;
    if (embedding.length !== 768) return null;

    return embedding;
  } catch {
    return null;
  }
}

// ── paper retrieval: semantic (preferred) or keyword (fallback) ──

async function retrievePapers(question: string): Promise<{ papers: MatchedPaper[]; method: string }> {
  const embedding = await embedQuery(question);

  if (embedding) {
    try {
      const client = createServiceClient();
      const { data, error } = await client.rpc("match_papers", {
        query_embedding: embedding,
        match_count: 8,
        match_threshold: 0.1,
      });
      if (!error && data && (data as MatchedPaper[]).length > 0) {
        return { papers: data as MatchedPaper[], method: "semantic" };
      }
    } catch { /* fall through to keyword */ }
  }

  // Keyword fallback: use full-text search over title + abstract
  const client = await createClient();
  const { data } = await client
    .from("papers")
    .select("id, pmid, title, abstract, journal, year, doi")
    .textSearch("title", question.split(" ").filter(w => w.length > 3).join(" | "), {
      type: "plain",
      config: "english",
    })
    .order("year", { ascending: false })
    .limit(8);

  return { papers: (data ?? []) as MatchedPaper[], method: "keyword" };
}

// ── main handler ──

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let question: string;
  try {
    const body = (await request.json()) as { question?: unknown };
    if (typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ error: "A non-empty question is required." }, { status: 400 });
    }
    question = body.question.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { papers, method } = await retrievePapers(question);

  if (papers.length === 0) {
    return NextResponse.json({
      answer: "No relevant papers were found for this question.",
      papers: [],
      method,
    });
  }

  // Build context
  const papersContext = papers
    .map((p, i) => {
      const abstract = p.abstract
        ? p.abstract.length > 300 ? `${p.abstract.slice(0, 300)}...` : p.abstract
        : "No abstract available.";
      return `[${i + 1}] PMID:${p.pmid} (${p.year ?? "n.d."}) ${stripHtml(p.title)}\n${abstract}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a scientific assistant specializing in bat (Chiroptera) biology.
Answer questions using ONLY the provided paper excerpts.
Cite papers inline using their PMID as [PMID:XXXXXXXX].
If the papers lack enough information, say so clearly.
Keep answers concise -- 2-4 sentences per point. No bullet lists unless the question asks for a list.`;

  const userMessage = `Question: ${question}\n\nPapers:\n${papersContext}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const answer =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ answer, papers, method });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 503 });
  }
}
