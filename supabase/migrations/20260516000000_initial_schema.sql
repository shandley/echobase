-- EchoBase initial schema
-- Chiroptera unified knowledge platform

-- Enable pgvector for embedding similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TAXONOMY
-- ============================================================

CREATE TABLE taxonomy (
  id                SERIAL PRIMARY KEY,
  ncbi_tax_id       INTEGER UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  rank              TEXT, -- species, genus, family, suborder, order
  parent_tax_id     INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_taxonomy_parent ON taxonomy(parent_tax_id);
CREATE INDEX idx_taxonomy_rank   ON taxonomy(rank);

-- ============================================================
-- SPECIES
-- ============================================================

CREATE TABLE species (
  id                          SERIAL PRIMARY KEY,
  ncbi_tax_id                 INTEGER UNIQUE NOT NULL,
  scientific_name             TEXT NOT NULL,
  common_name                 TEXT,
  family                      TEXT,
  genus                       TEXT,
  -- Biological traits
  echolocation_type           TEXT, -- laryngeal, tongue-click, none
  max_lifespan_years          NUMERIC,
  body_mass_g                 NUMERIC,
  -- Genome
  genome_assembly_accession   TEXT,
  genome_size_bp              BIGINT,
  annotation_status           TEXT, -- full, partial, none
  refseq_category             TEXT,
  -- Flexible metadata
  metadata                    JSONB DEFAULT '{}',
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_species_tax_id  ON species(ncbi_tax_id);
CREATE INDEX idx_species_family  ON species(family);
CREATE INDEX idx_species_genus   ON species(genus);

-- ============================================================
-- GENES
-- ============================================================

CREATE TABLE genes (
  id              SERIAL PRIMARY KEY,
  ncbi_gene_id    BIGINT UNIQUE,
  symbol          TEXT,
  name            TEXT,
  species_id      INTEGER NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  chromosome      TEXT,
  strand          CHAR(1),
  start_pos       BIGINT,
  end_pos         BIGINT,
  gene_biotype    TEXT, -- protein_coding, lncRNA, pseudogene, etc.
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_genes_species    ON genes(species_id);
CREATE INDEX idx_genes_symbol     ON genes(symbol);
CREATE INDEX idx_genes_ncbi_id    ON genes(ncbi_gene_id);

-- ============================================================
-- PROTEINS
-- ============================================================

CREATE TABLE proteins (
  id                          SERIAL PRIMARY KEY,
  ncbi_protein_accession      TEXT UNIQUE NOT NULL,
  gene_id                     INTEGER REFERENCES genes(id) ON DELETE SET NULL,
  species_id                  INTEGER NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  sequence                    TEXT,
  length                      INTEGER,
  description                 TEXT,
  alphafold_url               TEXT,
  -- ESM2-650M embedding: 1280 dimensions
  embedding                   vector(1280),
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proteins_species    ON proteins(species_id);
CREATE INDEX idx_proteins_gene       ON proteins(gene_id);
-- HNSW index for fast approximate nearest-neighbor search on protein embeddings
CREATE INDEX idx_proteins_embedding  ON proteins USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- PAPERS
-- ============================================================

CREATE TABLE papers (
  id                      SERIAL PRIMARY KEY,
  pmid                    BIGINT UNIQUE NOT NULL,
  title                   TEXT NOT NULL,
  abstract                TEXT,
  journal                 TEXT,
  year                    INTEGER,
  doi                     TEXT,
  authors                 JSONB DEFAULT '[]',
  full_text_available     BOOLEAN DEFAULT FALSE,
  -- PubMedBERT embedding: 768 dimensions
  embedding               vector(768),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_papers_pmid  ON papers(pmid);
CREATE INDEX idx_papers_year  ON papers(year);
-- HNSW index for fast approximate nearest-neighbor search on paper embeddings
CREATE INDEX idx_papers_embedding ON papers USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- PAPER ENTITY LINKS  (from PubTator3)
-- ============================================================

CREATE TABLE paper_entities (
  id              SERIAL PRIMARY KEY,
  paper_id        INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL, -- gene, species, disease, chemical, variant, cell_line
  entity_name     TEXT NOT NULL,
  normalized_id   TEXT, -- NCBI Gene ID, NCBI Taxonomy ID, MeSH ID, etc.
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_paper_entities_paper        ON paper_entities(paper_id);
CREATE INDEX idx_paper_entities_type_norm    ON paper_entities(entity_type, normalized_id);

-- ============================================================
-- MANY-TO-MANY: GENES <-> PAPERS
-- ============================================================

CREATE TABLE gene_papers (
  gene_id     INTEGER NOT NULL REFERENCES genes(id) ON DELETE CASCADE,
  paper_id    INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  PRIMARY KEY (gene_id, paper_id)
);

-- ============================================================
-- MANY-TO-MANY: SPECIES <-> PAPERS
-- ============================================================

CREATE TABLE species_papers (
  species_id  INTEGER NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  paper_id    INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  PRIMARY KEY (species_id, paper_id)
);

-- ============================================================
-- ORTHOLOGS
-- ============================================================

CREATE TABLE orthologs (
  id                  SERIAL PRIMARY KEY,
  gene_id             INTEGER NOT NULL REFERENCES genes(id) ON DELETE CASCADE,
  ortholog_gene_id    INTEGER NOT NULL REFERENCES genes(id) ON DELETE CASCADE,
  percent_identity    NUMERIC,
  alignment_score     NUMERIC,
  source              TEXT DEFAULT 'ncbi', -- ncbi, manual, etc.
  UNIQUE (gene_id, ortholog_gene_id)
);

CREATE INDEX idx_orthologs_gene ON orthologs(gene_id);

-- ============================================================
-- SEARCH INDEX: full-text search over species + genes + papers
-- ============================================================

-- Functional index for text search on species names
CREATE INDEX idx_species_name_fts ON species USING gin(
  to_tsvector('english', coalesce(scientific_name, '') || ' ' || coalesce(common_name, ''))
);

-- Functional index for text search on gene symbols and names
CREATE INDEX idx_genes_fts ON genes USING gin(
  to_tsvector('english', coalesce(symbol, '') || ' ' || coalesce(name, '') || ' ' || coalesce(description, ''))
);

-- Functional index for text search on paper titles and abstracts
CREATE INDEX idx_papers_fts ON papers USING gin(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(abstract, ''))
);
