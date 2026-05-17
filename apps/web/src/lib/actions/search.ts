"use server";
import { createServiceClient } from "@/lib/supabase/server";

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
    throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Unexpected response shape from HuggingFace API");
  }

  // Sentence-transformers models return [[...embedding...]]
  const embedding = Array.isArray(data[0]) ? (data[0] as number[]) : (data as number[]);

  if (embedding.length !== 768) {
    throw new Error(`Expected 768-dim embedding, got ${embedding.length}`);
  }

  return embedding;
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
  const client = createServiceClient();
  const { data, error } = await client.rpc("match_papers", {
    query_embedding: embedding,
    match_count: limit,
    match_threshold: 0.1,
  });
  if (error) throw error;
  return (data ?? []) as SemanticPaperResult[];
}
