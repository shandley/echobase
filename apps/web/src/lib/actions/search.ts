"use server";
import { createServiceClient } from "@/lib/supabase/server";

async function embedQuery(text: string): Promise<number[] | null> {
  const hfToken = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN;

  if (hfToken) {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/BAAI/bge-large-en-v1.5",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${hfToken}` },
          body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (response.ok) {
        const data = await response.json() as unknown;
        const embedding = Array.isArray(data) && Array.isArray((data as number[][])[0])
          ? (data as number[][])[0] : (data as number[]);
        if (Array.isArray(embedding) && embedding.length === 1024) return embedding;
      }
    } catch { /* fall through */ }
  }

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

  return null;
}

export type SemanticPaperResult = {
  id: number; pmid: number; title: string; abstract: string | null;
  journal: string | null; year: number | null; doi: string | null; similarity: number;
};

export async function semanticSearchPapers(query: string, limit = 10): Promise<SemanticPaperResult[]> {
  const embedding = await embedQuery(query);
  if (!embedding) throw new Error("Embedding unavailable");

  const client = createServiceClient();
  const { data, error } = await client.rpc("match_papers", {
    query_embedding: embedding as unknown as string,
    match_count: limit,
    match_threshold: 0.1,
  });
  if (error) throw error;
  return (data ?? []) as SemanticPaperResult[];
}
