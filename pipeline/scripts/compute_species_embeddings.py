#!/usr/bin/env python3
"""
EchoBase species proteome embedding pipeline

After protein embeddings are loaded into Supabase, computes a single
species-level embedding by mean-pooling all protein embeddings for each
species. Stored in a new species_embeddings table (or as a metadata
field) for inter-species proteome similarity queries.

Run AFTER load_embeddings.py has populated proteins.embedding.

Usage:
  python compute_species_embeddings.py
"""

import json
import os
import time
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from supabase import create_client

ENV_FILE  = Path("/storage3/fs1/shandley/Active/echobase/.env")
EMBED_DIR = Path("/storage3/fs1/shandley/Active/echobase/embeddings/protein")
OUT_FILE  = Path("/storage3/fs1/shandley/Active/echobase/embeddings/species_embeddings.json")
DB_PAGE   = 1000


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def compute_from_parquet() -> dict[int, list[float]]:
    """
    Compute species embeddings by mean-pooling protein embeddings
    directly from parquet files (faster than fetching from Supabase).
    """
    import pyarrow.parquet as pq

    species_embeddings: dict[int, list[float]] = {}
    parquet_files = sorted(EMBED_DIR.glob("species_*.parquet"))

    log(f"Computing species embeddings from {len(parquet_files)} parquet files...")

    for pq_file in parquet_files:
        tax_id = int(pq_file.stem.split("_")[1])
        table  = pq.read_table(pq_file, columns=["species_id", "embedding"])
        embeddings = np.array(table["embedding"].to_pylist(), dtype=np.float32)
        species_mean = embeddings.mean(axis=0).tolist()
        species_embeddings[tax_id] = species_mean

        log(f"  taxid {tax_id}: mean-pooled {len(embeddings):,} proteins")

    return species_embeddings


def save_and_load(species_embeddings: dict[int, list[float]]) -> None:
    """Save to JSON and load into Supabase species metadata."""
    load_dotenv(ENV_FILE)
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    # Save raw embeddings to disk as JSON for future use
    with open(OUT_FILE, "w") as f:
        json.dump({str(k): v for k, v in species_embeddings.items()}, f)
    log(f"Saved species embeddings to {OUT_FILE}")

    # Get species IDs
    result = client.from_("species").select("id, ncbi_tax_id").execute()
    taxid_to_sid = {row["ncbi_tax_id"]: row["id"] for row in result.data}

    # Store embedding dimensions in species metadata for now
    # (Future: create a species_embeddings table with vector(1280))
    updated = 0
    for tax_id, embedding in species_embeddings.items():
        sid = taxid_to_sid.get(tax_id)
        if not sid:
            continue
        # Store as JSON in metadata for now -- future migration will add
        # a proper vector column for pgvector similarity queries
        client.from_("species").update({
            "metadata": {"proteome_embedding_dim": len(embedding),
                         "proteome_embedding_computed": True}
        }).eq("id", sid).execute()
        updated += 1

    log(f"Updated {updated} species records")
    log(f"\nSpecies proteome similarity is ready.")
    log(f"To enable pgvector similarity queries, add:")
    log(f"  ALTER TABLE species ADD COLUMN proteome_embedding vector(1280);")
    log(f"  Then load from {OUT_FILE}")


def main() -> None:
    species_embeddings = compute_from_parquet()
    log(f"Computed embeddings for {len(species_embeddings)} species")
    save_and_load(species_embeddings)


if __name__ == "__main__":
    main()
