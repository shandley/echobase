-- Recreate HNSW index on proteins.embedding after bulk loading is complete.
-- CONCURRENTLY allows building without blocking reads/writes on the table.
-- Run this AFTER all 2.65M protein embeddings have been loaded.
-- This migration should be pushed manually once loading is done.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proteins_embedding
ON proteins USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
