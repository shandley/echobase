#!/usr/bin/env python3
"""
EchoBase protein embedding loader -- direct PostgreSQL via psycopg2

Uses COPY FROM STDIN into a temp table then a single UPDATE join per species.
This is orders of magnitude faster than the Supabase REST API approach.

Strategy per species parquet file:
  1. COPY (accession, embedding_text) → temp table
  2. UPDATE proteins SET embedding = temp.emb WHERE accession matches
  3. DROP temp table

Estimated runtime: ~15-30 minutes for 2.65M proteins vs ~100 hours via REST.

Requires POSTGRES_URL in /storage3/fs1/shandley/Active/echobase/.env:
  POSTGRES_URL=postgresql://postgres.[ref]:[password]@[host]:6543/postgres
"""

import io
import os
import time
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import psycopg2
from dotenv import load_dotenv

ENV_FILE  = Path("/storage3/fs1/shandley/Active/echobase/.env")
EMBED_DIR = Path("/storage3/fs1/shandley/Active/echobase/embeddings/protein")


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def vector_to_pg(arr: np.ndarray) -> str:
    """Format a numpy array as pgvector text: [v1,v2,...,vn]"""
    return "[" + ",".join(f"{v:.8f}" for v in arr) + "]"


def load_species(conn, pq_file: Path) -> tuple[int, int]:
    """
    Load one species parquet into Supabase via:
      1. COPY accessions + embeddings into a temp table
      2. UPDATE proteins.embedding WHERE accession matches
    Returns (proteins_matched, proteins_updated).
    """
    table = pq.read_table(pq_file, columns=["ncbi_protein_accession", "embedding"])
    accessions = table["ncbi_protein_accession"].to_pylist()
    embeddings = table["embedding"].to_pylist()  # list of list[float]
    n = len(accessions)

    if n == 0:
        return 0, 0

    tax_id = pq_file.stem.split("_")[1]
    log(f"  {n:,} proteins in parquet")

    with conn.cursor() as cur:
        # 1. Create temp table
        cur.execute("""
            CREATE TEMP TABLE _emb_load (
                accession TEXT,
                embedding  TEXT
            ) ON COMMIT DROP
        """)

        # 2. Stream data via COPY
        buf = io.StringIO()
        for acc, emb in zip(accessions, embeddings):
            vec_str = "[" + ",".join(f"{v:.8f}" for v in emb) + "]"
            buf.write(f"{acc}\t{vec_str}\n")
        buf.seek(0)

        cur.copy_from(buf, "_emb_load", columns=("accession", "embedding"))
        log(f"  COPY complete: {n:,} rows")

        # 3. UPDATE proteins from temp table
        cur.execute("""
            UPDATE proteins p
            SET    embedding = t.embedding::vector
            FROM   _emb_load t
            WHERE  p.ncbi_protein_accession = t.accession
        """)
        updated = cur.rowcount
        conn.commit()
        log(f"  UPDATE complete: {updated:,} rows updated")

    return n, updated


def main() -> None:
    load_dotenv(ENV_FILE)

    pg_url = os.environ.get("POSTGRES_URL")
    if not pg_url:
        raise SystemExit("ERROR: POSTGRES_URL not set in .env")

    log(f"Connecting to PostgreSQL...")
    conn = psycopg2.connect(pg_url)
    conn.autocommit = False
    log("Connected.")

    pq_files = sorted(EMBED_DIR.glob("species_*.parquet"))
    log(f"Found {len(pq_files)} species parquet files")

    total_matched = 0
    total_updated = 0
    t0 = time.time()

    for i, pq_file in enumerate(pq_files, 1):
        tax_id = pq_file.stem.split("_")[1]
        log(f"\n[{i}/{len(pq_files)}] taxid {tax_id} ({pq_file.name})")
        try:
            matched, updated = load_species(conn, pq_file)
            total_matched += matched
            total_updated += updated
            elapsed = time.time() - t0
            rate = total_updated / elapsed
            log(f"  Running total: {total_updated:,} updated | {rate:.0f} proteins/s")
        except Exception as e:
            log(f"  ERROR: {e}")
            conn.rollback()

    conn.close()
    elapsed = time.time() - t0
    log(f"\n=== Complete ===")
    log(f"Parquet rows:   {total_matched:,}")
    log(f"DB rows updated: {total_updated:,}")
    log(f"Elapsed:         {elapsed/3600:.2f}h")
    log(f"Rate:            {total_updated/elapsed:.0f} proteins/s")


if __name__ == "__main__":
    main()
