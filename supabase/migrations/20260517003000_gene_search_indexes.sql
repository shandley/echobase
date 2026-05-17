-- Enable trigram extension for fast ILIKE/similarity search on gene symbols
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for gene search over 657K rows.
-- These make symbol and name searches fast without full-table scans.
CREATE INDEX IF NOT EXISTS idx_genes_symbol_trgm ON genes USING gin (symbol gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_genes_name_trgm   ON genes USING gin (name   gin_trgm_ops);
