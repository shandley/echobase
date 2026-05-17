#!/usr/bin/env python3
"""
EchoBase protein embedding loader

Reads per-species parquet files produced by embed_proteins.py and writes
the embedding vectors to the Supabase proteins table.

Strategy:
  For each parquet file:
    1. Read accessions and embeddings.
    2. Fetch protein IDs from Supabase in batches of 1000 accessions.
    3. Upsert {id, embedding} pairs in batches of 200 (vectors are large).

Idempotent: already-loaded rows are overwritten safely.

Usage:
  python load_embeddings.py              # all species
  python load_embeddings.py --species 9440  # single species by ncbi_tax_id
"""

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# ── configuration ─────────────────────────────────────────────────────────────

ENV_FILE  = Path("/storage3/fs1/shandley/Active/echobase/.env")
EMBED_DIR = Path("/storage3/fs1/shandley/Active/echobase/embeddings/protein")

ID_FETCH_BATCH  = 1000   # accessions per SELECT … IN (…) call
UPSERT_BATCH    = 50     # records per upsert -- smaller to avoid statement timeout
                         # (50 × 1280-dim × 4 bytes = 256 KB per request, safe)
MAX_RETRIES     = 3
RETRY_BASE_SECS = 2.0    # exponential backoff: 2, 4, 8 seconds

# ── helpers ──────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def retry(fn, label: str):
    """Call fn(), retrying up to MAX_RETRIES times with exponential backoff."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn()
        except Exception as exc:
            if attempt == MAX_RETRIES:
                raise RuntimeError(f"{label} failed after {MAX_RETRIES} attempts: {exc}") from exc
            wait = RETRY_BASE_SECS ** attempt
            log(f"  WARNING: {label} attempt {attempt} failed ({exc}), retrying in {wait:.0f}s...")
            time.sleep(wait)


def load_supabase() -> Client:
    load_dotenv(ENV_FILE)
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


# ── core loading logic ────────────────────────────────────────────────────────

def fetch_protein_ids(
    client: Client,
    accessions: list[str],
) -> dict[str, int]:
    """Return {ncbi_protein_accession: id} for the given accessions."""
    result: dict[str, int] = {}
    for i in range(0, len(accessions), ID_FETCH_BATCH):
        batch = accessions[i : i + ID_FETCH_BATCH]
        resp = retry(
            lambda b=batch: (
                client.from_("proteins")
                .select("id, ncbi_protein_accession")
                .in_("ncbi_protein_accession", b)
                .execute()
            ),
            label=f"fetch IDs batch {i // ID_FETCH_BATCH + 1}",
        )
        for row in resp.data:
            result[row["ncbi_protein_accession"]] = row["id"]
    return result


def upsert_embeddings(
    client: Client,
    records: list[dict],
) -> int:
    """Upsert [{id, ncbi_protein_accession, species_id, embedding}] in batches.
    Returns count of records sent.

    Sends species_id and ncbi_protein_accession alongside the embedding so
    that PostgreSQL's NOT NULL constraints are satisfied during the INSERT
    phase of ON CONFLICT (id) DO UPDATE.
    """
    total = 0
    n_batches = (len(records) + UPSERT_BATCH - 1) // UPSERT_BATCH
    for i in range(0, len(records), UPSERT_BATCH):
        batch = records[i : i + UPSERT_BATCH]
        batch_num = i // UPSERT_BATCH + 1
        retry(
            lambda b=batch: (
                client.from_("proteins")
                .upsert(b, on_conflict="id")
                .execute()
            ),
            label=f"upsert batch {batch_num}/{n_batches}",
        )
        total += len(batch)
        if batch_num % 25 == 0 or batch_num == n_batches:
            log(f"    upsert progress: {total:,}/{len(records):,} records")
    return total


def load_species_parquet(client: Client, parquet_path: Path) -> tuple[int, int]:
    """
    Load one species parquet into Supabase.
    Returns (proteins_matched, proteins_uploaded).
    """
    df = pd.read_parquet(parquet_path, columns=["ncbi_protein_accession", "species_id", "embedding"])
    accessions: list[str] = df["ncbi_protein_accession"].tolist()
    log(f"  {parquet_path.name}: {len(accessions):,} proteins in parquet")

    # Step 1: fetch protein IDs from Supabase
    t0 = time.time()
    acc_to_id = fetch_protein_ids(client, accessions)
    log(f"  ID fetch: {len(acc_to_id):,}/{len(accessions):,} matched "
        f"({time.time() - t0:.1f}s)")

    if not acc_to_id:
        log(f"  WARNING: no protein IDs found -- skipping")
        return 0, 0

    # Step 2: build upsert records for matched accessions
    records: list[dict] = []
    for acc, sid, emb in zip(
        df["ncbi_protein_accession"],
        df["species_id"],
        df["embedding"],
    ):
        pid = acc_to_id.get(acc)
        if pid is None:
            continue
        # embedding may be a numpy array or a list depending on pyarrow/pandas version
        emb_list: list[float] = emb.tolist() if isinstance(emb, np.ndarray) else list(emb)
        records.append({
            "id": pid,
            "ncbi_protein_accession": acc,
            "species_id": int(sid),
            "embedding": emb_list,
        })

    # Step 3: upsert embeddings
    t1 = time.time()
    uploaded = upsert_embeddings(client, records)
    log(f"  Upserted: {uploaded:,} embeddings ({time.time() - t1:.1f}s)")

    return len(acc_to_id), uploaded


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Load ESM2 protein embeddings from parquet files into Supabase"
    )
    parser.add_argument(
        "--species",
        type=int,
        default=None,
        metavar="TAXID",
        help="Load a single species by NCBI tax ID (default: all)",
    )
    args = parser.parse_args()

    log("Connecting to Supabase...")
    client = load_supabase()
    log("Connected.")

    # Discover parquet files
    if args.species is not None:
        parquet_files = [EMBED_DIR / f"species_{args.species}.parquet"]
        missing = [p for p in parquet_files if not p.exists()]
        if missing:
            sys.exit(f"ERROR: parquet not found: {missing[0]}")
    else:
        parquet_files = sorted(EMBED_DIR.glob("species_*.parquet"))
        if not parquet_files:
            sys.exit(f"ERROR: no parquet files found in {EMBED_DIR}")
        log(f"Found {len(parquet_files)} species parquet files")

    job_start = time.time()
    species_loaded = 0
    total_matched  = 0
    total_uploaded = 0

    for i, parquet_path in enumerate(parquet_files, 1):
        tax_id_str = parquet_path.stem.replace("species_", "")
        log(f"\n[{i}/{len(parquet_files)}] taxid {tax_id_str}")

        try:
            matched, uploaded = load_species_parquet(client, parquet_path)
            species_loaded += 1
            total_matched  += matched
            total_uploaded += uploaded
        except Exception as exc:
            log(f"  ERROR loading {parquet_path.name}: {exc}")
            # Continue with remaining species rather than aborting the job
            continue

    elapsed = time.time() - job_start
    log(
        f"\n=== Summary ==="
        f"\n  Species loaded:    {species_loaded}/{len(parquet_files)}"
        f"\n  Proteins matched:  {total_matched:,}"
        f"\n  Embeddings loaded: {total_uploaded:,}"
        f"\n  Time elapsed:      {elapsed/3600:.2f}h ({elapsed:.0f}s)"
    )


if __name__ == "__main__":
    main()
