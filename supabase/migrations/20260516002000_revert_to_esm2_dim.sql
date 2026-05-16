-- Revert from ESM3 (1536-dim) back to ESM2-650M (1280-dim).
-- ESM3 switch was abandoned due to gated model auth requirements.
-- No embedding data exists yet so this is safe.

ALTER TABLE proteins DROP COLUMN IF EXISTS embedding;

ALTER TABLE proteins ADD COLUMN embedding vector(1280);

CREATE INDEX idx_proteins_embedding ON proteins
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
