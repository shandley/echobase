#!/usr/bin/env python3
"""
EchoBase ESM2 protein embedding pipeline

For each species, fetches protein sequences from Supabase, computes
mean-pooled ESM2-650M embeddings on GPU, and saves results to parquet.

Output: one parquet file per species at
  $EMBED_DIR/species_{ncbi_tax_id}.parquet

Columns: protein_id (int), ncbi_protein_accession (str),
         species_id (int), embedding (list[float], len=1280)

Idempotent: skips species whose parquet file already exists.
Restart-safe: --species flag to re-run a single species.

Usage:
  python embed_proteins.py              # all species
  python embed_proteins.py --species 9440  # single species by tax_id
"""

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import torch
from dotenv import load_dotenv
from supabase import create_client
from transformers import EsmModel, EsmTokenizer

# ── configuration ────────────────────────────────────────────────────────────

MODEL_ID     = "facebook/esm2_t33_650M_UR50D"
EMBED_DIM    = 1280
MAX_SEQ_LEN  = 1022   # ESM2 hard limit (excluding CLS/EOS tokens)
GPU_BATCH    = 128    # sequences per forward pass (H100 80GB handles this easily)
DB_PAGE_SIZE = 1000   # Supabase PostgREST default max rows -- do not exceed

ENV_FILE  = Path("/storage3/fs1/shandley/Active/echobase/.env")
EMBED_DIR = Path("/storage3/fs1/shandley/Active/echobase/embeddings/protein")
EMBED_DIR.mkdir(parents=True, exist_ok=True)


# ── helpers ──────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def mean_pool(token_embeddings: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    """
    Mean-pool token embeddings, excluding padding.
    Excludes position 0 (CLS) and last real token (EOS) via mask slicing.
    """
    # Shift mask right by 1 to exclude CLS at position 0
    mask = attention_mask[:, 1:].unsqueeze(-1).float()
    embeddings = token_embeddings[:, 1:, :]           # drop CLS column
    summed = (embeddings * mask).sum(dim=1)
    counts  = mask.sum(dim=1).clamp(min=1e-9)
    return (summed / counts).float()


def embed_batch(
    model: EsmModel,
    tokenizer: EsmTokenizer,
    sequences: list[str],
    device: torch.device,
) -> np.ndarray:
    """Return (N, 1280) float32 embeddings for a batch of sequences."""
    truncated = [s[:MAX_SEQ_LEN] for s in sequences]
    enc = tokenizer(
        truncated,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=MAX_SEQ_LEN + 2,  # +2 for CLS/EOS tokens
    )
    enc = {k: v.to(device) for k, v in enc.items()}

    with torch.no_grad():
        out = model(**enc)

    pooled = mean_pool(out.last_hidden_state, enc["attention_mask"])
    return pooled.cpu().numpy()


# ── supabase helpers ──────────────────────────────────────────────────────────

def get_all_species(client) -> list[dict]:
    result = client.from_("species") \
        .select("id, ncbi_tax_id, scientific_name") \
        .order("scientific_name") \
        .execute()
    return result.data


def get_proteins_for_species(client, species_id: int) -> list[dict]:
    """Fetch all proteins for a species, paginating through DB_PAGE_SIZE rows.
    Retries each page up to 3 times on transient Supabase statement timeouts."""
    rows: list[dict] = []
    offset = 0
    while True:
        for attempt in range(3):
            try:
                result = client.from_("proteins") \
                    .select("id, ncbi_protein_accession, species_id, sequence") \
                    .eq("species_id", species_id) \
                    .order("id") \
                    .range(offset, offset + DB_PAGE_SIZE - 1) \
                    .execute()
                break
            except Exception as e:
                if attempt == 2:
                    raise
                log(f"  Page {offset}: retrying after error: {e}")
                time.sleep(10 * (attempt + 1))
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < DB_PAGE_SIZE:
            break
        offset += DB_PAGE_SIZE
    return rows


# ── per-species embedding ─────────────────────────────────────────────────────

def embed_species(
    client,
    model: EsmModel,
    tokenizer: EsmTokenizer,
    device: torch.device,
    species: dict,
) -> None:
    tax_id = species["ncbi_tax_id"]
    name   = species["scientific_name"]
    sid    = species["id"]

    out_path = EMBED_DIR / f"species_{tax_id}.parquet"
    if out_path.exists():
        log(f"  {name}: already done, skipping")
        return

    log(f"  {name} (taxid {tax_id}): fetching sequences...")
    proteins = get_proteins_for_species(client, sid)
    if not proteins:
        log(f"  {name}: no proteins found, skipping")
        return

    # Filter out rows with missing sequences
    valid = [p for p in proteins if p.get("sequence")]
    skipped = len(proteins) - len(valid)
    if skipped:
        log(f"  {name}: skipping {skipped} rows with empty sequences")

    log(f"  {name}: embedding {len(valid):,} proteins...")
    t0 = time.time()

    # Sort by sequence length -- reduces padding, improves GPU utilisation
    valid.sort(key=lambda r: len(r["sequence"]))

    protein_ids:   list[int]   = []
    accessions:    list[str]   = []
    species_ids:   list[int]   = []
    embeddings:    list[np.ndarray] = []

    for i in range(0, len(valid), GPU_BATCH):
        chunk = valid[i : i + GPU_BATCH]
        seqs  = [r["sequence"] for r in chunk]
        embs  = embed_batch(model, tokenizer, seqs, device)

        for row, emb in zip(chunk, embs):
            protein_ids.append(row["id"])
            accessions.append(row["ncbi_protein_accession"])
            species_ids.append(row["species_id"])
            embeddings.append(emb)

        if (i // GPU_BATCH) % 50 == 0:
            done = min(i + GPU_BATCH, len(valid))
            rate = done / (time.time() - t0)
            log(f"    {done:,}/{len(valid):,} ({rate:.0f} seq/s)")

    # Write parquet
    table = pa.table({
        "protein_id":             pa.array(protein_ids, type=pa.int64()),
        "ncbi_protein_accession": pa.array(accessions,  type=pa.string()),
        "species_id":             pa.array(species_ids, type=pa.int64()),
        "embedding":              pa.array(
            [emb.tolist() for emb in embeddings],
            type=pa.list_(pa.float32()),
        ),
    })
    pq.write_table(table, out_path, compression="snappy")

    elapsed = time.time() - t0
    file_mb = out_path.stat().st_size / 1e6
    log(f"  {name}: done -- {len(valid):,} proteins in {elapsed:.0f}s "
        f"({len(valid)/elapsed:.0f} seq/s) | {file_mb:.1f} MB saved")


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Embed bat proteins with ESM2-650M")
    parser.add_argument(
        "--species",
        type=int,
        default=None,
        help="NCBI taxonomy ID to embed a single species (omit for all)",
    )
    args = parser.parse_args()

    load_dotenv(ENV_FILE)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log(f"Device: {device}")
    if device.type == "cuda":
        log(f"GPU: {torch.cuda.get_device_name(0)} | "
            f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    log(f"Loading {MODEL_ID}...")
    os.environ.setdefault(
        "HF_HOME", "/storage3/fs1/shandley/Active/echobase/models"
    )
    tokenizer = EsmTokenizer.from_pretrained(MODEL_ID)
    # bf16 inference: ~2x faster on H100, numerically safe for ESM2
    dtype = torch.bfloat16 if device.type == "cuda" else torch.float32
    model = EsmModel.from_pretrained(MODEL_ID, torch_dtype=dtype).to(device).eval()
    n_params = sum(p.numel() for p in model.parameters())
    log(f"Model ready: {n_params/1e6:.0f}M parameters | dtype: {dtype}")

    log("Connecting to Supabase...")
    client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )

    all_species = get_all_species(client)
    log(f"Found {len(all_species)} species in database")

    if args.species is not None:
        target = [s for s in all_species if s["ncbi_tax_id"] == args.species]
        if not target:
            sys.exit(f"ERROR: taxid {args.species} not found in species table")
        all_species = target

    job_start = time.time()
    for i, sp in enumerate(all_species, 1):
        log(f"\n[{i}/{len(all_species)}] {sp['scientific_name']}")
        embed_species(client, model, tokenizer, device, sp)

    total_elapsed = time.time() - job_start
    files = list(EMBED_DIR.glob("species_*.parquet"))
    total_size_gb = sum(f.stat().st_size for f in files) / 1e9

    log(f"\n=== Complete ===")
    log(f"Species embedded: {len(files)}")
    log(f"Total parquet size: {total_size_gb:.2f} GB")
    log(f"Elapsed: {total_elapsed/3600:.2f} hours")


if __name__ == "__main__":
    main()
