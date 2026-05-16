-- Switch protein embeddings from ESM2-650M (1280-dim) to ESM3-small (1536-dim).
-- Embeddings column is NULL for all rows at this point, so dropping and
-- re-adding is safe -- no data is lost.

ALTER TABLE proteins DROP COLUMN IF EXISTS embedding;

ALTER TABLE proteins ADD COLUMN embedding vector(1536);

CREATE INDEX idx_proteins_embedding ON proteins
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
