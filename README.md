# EchoBase

A unified knowledge platform for Chiroptera genomics, built on modern AI and biological sequence embeddings.

## What it is

EchoBase reimagines how researchers interact with biological databases, using bat genomics as a model system. Rather than routing queries through separate databases (sequences, literature, taxonomy, structure), EchoBase exposes everything through a single search interface backed by language model embeddings and a cross-linked knowledge graph.

The name comes from bat echolocation: send a query, get back a rich biological echo.

## Core features (v1)

- **Unified search** across species, genes, proteins, and literature from one input
- **Embedding-based sequence similarity** using ESM2 (proteins) and Nucleotide Transformer (DNA) -- finds functional neighbors, not just high-identity matches
- **Entity pages** for bat species, genes, and proteins that aggregate genome data, predicted structure, cross-species orthologs, and relevant literature in one place
- **Semantic literature search** over ~50K bat biology papers with AI-synthesized summaries
- **Taxonomy browser** spanning all ~1,400 Chiroptera species, linked to entity data
- **Paper pages** with automatic entity linking (genes, species, diseases) via PubTator3
- **AI Q&A** grounded in indexed literature with inline citations

## Data sources

- NCBI Datasets (bat genome assemblies, genes, proteins)
- PubMed (bat biology literature)
- AlphaFold DB (protein structures)
- PubTator3 (paper entity annotations)
- OneZoom / Open Tree of Life (taxonomy)
- BioThings API (gene/protein annotations)

## Stack

- **Frontend**: Next.js (TypeScript, strict mode) on Vercel
- **Database**: Supabase (PostgreSQL + pgvector)
- **Embeddings**: ESM2-650M (proteins), Nucleotide Transformer v2 (DNA), PubMedBERT (text)
- **Compute**: WashU RIS Compute2 (H100 GPUs) for batch embedding jobs
- **AI**: Claude API for Q&A synthesis

## Status

Early development. Data pipeline and embedding infrastructure in progress.

## Project structure

```
echobase/
├── pipeline/        # Data ingestion and embedding batch jobs (SLURM)
├── apps/
│   ├── web/         # Next.js frontend
│   └── api/         # FastAPI backend
├── packages/
│   └── shared/      # Shared types and utilities
└── docs/            # Architecture and data model documentation
```
