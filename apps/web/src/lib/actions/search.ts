"use server";
import { createServiceClient } from "@/lib/supabase/server";

async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "voyage-3", input: [text] }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    const embedding = data.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== 1024) return null;

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
  if (!embedding) throw new Error("Voyage AI embedding unavailable");

  const client = createServiceClient();
  const { data, error } = await client.rpc("match_papers", {
    query_embedding: embedding as unknown as string,
    match_count: limit,
    match_threshold: 0.1,
  });
  if (error) throw error;
  return (data ?? []) as SemanticPaperResult[];
}
