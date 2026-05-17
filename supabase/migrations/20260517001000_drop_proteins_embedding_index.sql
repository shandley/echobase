-- Drop the HNSW index on proteins.embedding before bulk loading.
-- Every upsert with the index in place requires an expensive HNSW graph
-- update, making bulk loads orders of magnitude slower.
-- The index will be recreated after all embeddings are loaded.
DROP INDEX IF EXISTS idx_proteins_embedding;
