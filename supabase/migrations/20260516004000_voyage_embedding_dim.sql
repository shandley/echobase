-- Switch paper embeddings from PubMedBERT (768-dim) to Voyage AI voyage-3 (1024-dim).
-- No paper embedding data exists yet in the column, so this is safe.

-- Drop old column and index
ALTER TABLE papers DROP COLUMN IF EXISTS embedding;

-- Add new column with Voyage AI dimension
ALTER TABLE papers ADD COLUMN embedding vector(1024);

-- Rebuild HNSW index for 1024-dim cosine similarity
CREATE INDEX idx_papers_embedding ON papers
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Update match_papers RPC for 1024-dim vectors
CREATE OR REPLACE FUNCTION match_papers(
  query_embedding vector(1024),
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.1
)
RETURNS TABLE (
  id int,
  pmid bigint,
  title text,
  abstract text,
  journal text,
  year int,
  doi text,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id,
    p.pmid,
    p.title,
    p.abstract,
    p.journal,
    p.year,
    p.doi,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM papers p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;
