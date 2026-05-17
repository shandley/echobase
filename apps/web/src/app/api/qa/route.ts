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

// ── query embedding: Voyage AI voyage-3 (matches paper embeddings after reembed) ──

async function embedQuery(text: string): Promise<number[] | null> {
  // Try Voyage AI first -- confirmed working from Vercel infra
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (voyageKey) {
    try {
      const response = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${voyageKey}` },
        body: JSON.stringify({ model: "voyage-3", input: [text] }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        const data = await response.json() as { data: Array<{ embedding: number[] }> };
        const emb = data.data?.[0]?.embedding;
        if (Array.isArray(emb) && emb.length === 1024) return emb;
      }
    } catch { /* fall through */ }
  }

  const hfToken = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN;

  // Try bge-large via HF (fallback)
  if (hfToken) {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${hfToken}`,
          },
          body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (response.ok) {
        const data = await response.json() as unknown;
        // HF returns flat array or nested [[...]]
        const embedding = Array.isArray(data) && Array.isArray((data as number[][])[0])
          ? (data as number[][])[0]
          : (data as number[]);
        if (Array.isArray(embedding) && embedding.length === 1024) {
          return embedding;
        }
      }
    } catch { /* fall through */ }
  }

  // Secondary Voyage fallback (voyageKey already declared above)
  if (voyageKey) {
    try {
      const response = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${voyageKey}` },
        body: JSON.stringify({ model: "voyage-3", input: [text] }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) {
        const data = await response.json() as { data: Array<{ embedding: number[] }> };
        const emb = data.data?.[0]?.embedding;
        if (Array.isArray(emb) && emb.length === 1024) return emb;
      }
    } catch { /* fall through */ }
  }

  return null;
}

// ── paper retrieval ────────────────────────────────────────────────────────────

async function retrievePapers(question: string): Promise<{ papers: MatchedPaper[]; method: string }> {
  const embedding = await embedQuery(question);

  if (embedding) {
    try {
      const client = createServiceClient();
      const { data, error } = await client.rpc("match_papers", {
        query_embedding: embedding as unknown as string,
        match_count: 8,
        match_threshold: 0.1,
      });
      if (!error && data && (data as MatchedPaper[]).length > 0) {
        return { papers: data as MatchedPaper[], method: "semantic" };
      }
    } catch { /* fall through to keyword */ }
  }

  // Keyword fallback
  const stopwords = new Set(["can", "you", "tell", "me", "about", "what", "how", "why",
    "the", "and", "for", "are", "with", "that", "this", "have", "from"]);
  const keywords = question.toLowerCase().split(/\s+/)
    .filter(w => w.length > 4 && !stopwords.has(w));

  const client = await createClient();
  let query = client.from("papers").select("id, pmid, title, abstract, journal, year, doi")
    .order("year", { ascending: false }).limit(8);

  if (keywords.length > 0) {
    const orFilter = keywords.map(k => `title.ilike.%${k}%,abstract.ilike.%${k}%`).join(",");
    query = query.or(orFilter);
  }

  const { data } = await query;
  return { papers: (data ?? []) as MatchedPaper[], method: "keyword" };
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 503 });
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
    return NextResponse.json({ answer: "No relevant papers were found for this question.", papers: [], method });
  }

  const papersContext = papers.map((p, i) => {
    const abstract = p.abstract
      ? p.abstract.length > 300 ? `${p.abstract.slice(0, 300)}...` : p.abstract
      : "No abstract available.";
    return `[${i + 1}] PMID:${p.pmid} (${p.year ?? "n.d."}) ${stripHtml(p.title)}\n${abstract}`;
  }).join("\n\n");

  const systemPrompt = `You are a scientific assistant specializing in bat (Chiroptera) biology.
Answer questions using ONLY the provided paper excerpts.
Cite papers inline as [PMID:XXXXXXXX]. If papers lack enough information, say so clearly.
Keep answers concise -- 2-4 sentences per point.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: `Question: ${question}\n\nPapers:\n${papersContext}` }],
    });
    const answer = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ answer, papers, method });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 503 });
  }
}
