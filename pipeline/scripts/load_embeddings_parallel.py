#!/usr/bin/env python3
"""
EchoBase protein embedding loader -- parallel REST via ThreadPoolExecutor

Uses 20 concurrent threads each making Supabase upsert requests.
At 20 workers × 20 records/batch × ~1s/request ≈ 400 records/sec.
2.65M proteins ÷ 400 ≈ 1.8 hours vs ~100 hours for sequential.

Each thread creates its own Supabase client (thread-safe pattern).
"""

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Generator

import pyarrow.parquet as pq
from dotenv import load_dotenv
from supabase import create_client

ENV_FILE  = Path("/storage3/fs1/shandley/Active/echobase/.env")
EMBED_DIR = Path("/storage3/fs1/shandley/Active/echobase/embeddings/protein")

BATCH_SIZE   = 500   # large batches -- minimises request overhead
MAX_WORKERS  = 1     # single sequential connection -- no pooler contention
MAX_RETRIES  = 10    # more retries for occasional timeouts


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def upsert_batch(batch: list[dict], url: str, key: str, attempt: int = 1) -> int:
    """Upsert one batch. Returns number of records on success, raises on failure."""
    try:
        client = create_client(url, key)
        client.from_("proteins").upsert(
            batch, on_conflict="ncbi_protein_accession"
        ).execute()
        return len(batch)
    except Exception as e:
        if attempt >= MAX_RETRIES:
            raise
        wait = min(2 ** attempt, 30)
        time.sleep(wait)
        return upsert_batch(batch, url, key, attempt + 1)


def batches_from_parquet(pq_file: Path) -> Generator[list[dict], None, None]:
    """Yield BATCH_SIZE-sized lists of {ncbi_protein_accession, species_id, embedding}."""
    table = pq.read_table(pq_file, columns=["ncbi_protein_accession", "species_id", "embedding"])
    accessions = table["ncbi_protein_accession"].to_pylist()
    species_ids = table["species_id"].to_pylist()
    embeddings  = table["embedding"].to_pylist()

    batch: list[dict] = []
    for acc, sid, emb in zip(accessions, species_ids, embeddings):
        batch.append({
            "ncbi_protein_accession": acc,
            "species_id": int(sid),
            "embedding": list(emb),
        })
        if len(batch) >= BATCH_SIZE:
            yield batch
            batch = []
    if batch:
        yield batch


def load_species(pq_file: Path, url: str, key: str) -> tuple[int, int]:
    """Load one species parquet in parallel. Returns (submitted, loaded)."""
    tax_id = pq_file.stem.split("_")[1]
    all_batches = list(batches_from_parquet(pq_file))
    n_proteins  = sum(len(b) for b in all_batches)
    log(f"  taxid {tax_id}: {n_proteins:,} proteins → {len(all_batches)} batches")

    loaded = 0
    errors = 0
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(upsert_batch, b, url, key): b for b in all_batches}
        for fut in as_completed(futures):
            try:
                loaded += fut.result()
                if loaded % 5000 == 0 or loaded == n_proteins:
                    rate = loaded / max(time.time() - t0, 1)
                    log(f"    {loaded:,}/{n_proteins:,} ({rate:.0f} proteins/s)")
            except Exception as e:
                errors += 1
                log(f"  BATCH ERROR: {e}")

    elapsed = time.time() - t0
    log(f"  taxid {tax_id}: done — {loaded:,} loaded, {errors} errors, "
        f"{loaded/elapsed:.0f} proteins/s")
    return n_proteins, loaded


def main() -> None:
    load_dotenv(ENV_FILE)
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

    pq_files = sorted(EMBED_DIR.glob("species_*.parquet"))
    log(f"Found {len(pq_files)} species parquet files")
    log(f"Workers: {MAX_WORKERS} | Batch size: {BATCH_SIZE}")

    total_proteins = 0
    total_loaded   = 0
    t_start        = time.time()

    for i, pq_file in enumerate(pq_files, 1):
        log(f"\n[{i}/{len(pq_files)}] {pq_file.name}")
        submitted, loaded = load_species(pq_file, url, key)
        total_proteins += submitted
        total_loaded   += loaded

    elapsed = time.time() - t_start
    log(f"\n=== Complete ===")
    log(f"Total proteins:  {total_proteins:,}")
    log(f"Total loaded:    {total_loaded:,}")
    log(f"Elapsed:         {elapsed/3600:.2f}h")
    log(f"Average rate:    {total_loaded/elapsed:.0f} proteins/s")


if __name__ == "__main__":
    main()
