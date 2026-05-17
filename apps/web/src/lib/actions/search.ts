"use server";
import { createServiceClient } from "@/lib/supabase/server";

async function embedQuery(text: string): Promise<number[] | null> {
  const hfToken = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "EchoBase/1.0",
  };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/NeuML/pubmedbert-base-embeddings",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) return null;

    const data: unknown = await response.json();
    const embedding =
      Array.isArray(data) && Array.isArray((data as unknown[][])[0])
        ? (data as number[][])[0]
        : (data as number[]);

    if (!Array.isArray(embedding) || typeof embedding[0] !== "number") return null;
    if (embedding.length !== 768) return null;

    return embedding;
  } catch {
    return null;
  }
}

export type SemanticPaperResult = {
  id: number;
  pmid: number;
  title: string;
  abstract: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  similarity: number;
};

export async function semanticSearchPapers(
  query: string,
  limit = 10,
): Promise<SemanticPaperResult[]> {
  const embedding = await embedQuery(query);
  if (!embedding) throw new Error("Embedding unavailable");

  const client = createServiceClient();
  const { data, error } = await client.rpc("match_papers", {
    query_embedding: embedding,
    match_count: limit,
    match_threshold: 0.1,
  });
  if (error) throw error;
  return (data ?? []) as SemanticPaperResult[];
}
