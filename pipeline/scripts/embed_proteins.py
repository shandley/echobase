#!/usr/bin/env python3
"""
EchoBase ESM3 protein embedding pipeline

Reads protein sequences from local NCBI FASTA files, computes
mean-pooled ESM3-small (1536-dim) embeddings on GPU, and saves
per-species parquet files.

Model: EvolutionaryScale/esm3-sm-open-v1
Embedding dim: 1536 (matches vector(1536) in Supabase schema)

Output: one parquet per species at
  $EMBED_DIR/species_{ncbi_tax_id}.parquet

Columns: ncbi_protein_accession (str), species_id (int),
         embedding (list[float], len=1536)

Idempotent: skips species whose parquet file already exists.

Usage:
  python embed_proteins.py              # all species
  python embed_proteins.py --species 9440  # single species by tax_id
"""

import argparse
import json
import os
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import torch
from Bio import SeqIO
from dotenv import load_dotenv
from esm.models.esm3 import ESM3
from esm.tokenization import get_model_tokenizers
from supabase import create_client

# ── configuration ────────────────────────────────────────────────────────────

MODEL_ID    = "esm3-sm-open-v1"
EMBED_DIM   = 1536
MAX_SEQ_LEN = 1022   # truncate very long sequences
GPU_BATCH   = 64     # ESM3-small is larger than ESM2-650M; start conservative

ENV_FILE  = Path("/storage3/fs1/shandley/Active/echobase/.env")
EMBED_DIR = Path("/storage3/fs1/shandley/Active/echobase/embeddings/protein")
DATA_DIR  = Path("/storage3/fs1/shandley/Active/echobase/data/raw/chiroptera_annotated/ncbi_dataset/data")
REPORT    = DATA_DIR / "assembly_data_report.jsonl"

EMBED_DIR.mkdir(parents=True, exist_ok=True)

# ── helpers ──────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ── ESM3 embedding ────────────────────────────────────────────────────────────

def embed_batch_esm3(
    model: ESM3,
    tokenizers,
    sequences: list[str],
    device: torch.device,
) -> np.ndarray:
    """Return (N, 1536) float32 mean-pooled embeddings via ESM3."""
    truncated = [s[:MAX_SEQ_LEN] for s in sequences]

    # Tokenize all sequences
    seq_tokens = tokenizers.sequence.batch_encode_plus(
        truncated,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=MAX_SEQ_LEN + 2,  # +2 for BOS/EOS
    )["input_ids"].to(device)

    with torch.no_grad():
        output = model.forward(sequence_tokens=seq_tokens)

    # output.embeddings: (batch, seq_len, 1536)
    # Create mask: 1 for real tokens (not padding), 0 for pad
    pad_id = tokenizers.sequence.pad_token_id
    mask = (seq_tokens != pad_id).float().unsqueeze(-1)  # (batch, seq_len, 1)

    embeddings = output.embeddings  # (batch, seq_len, 1536)
    pooled = (embeddings * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)
    return pooled.cpu().float().numpy()


# ── data loading ──────────────────────────────────────────────────────────────

def build_assembly_to_taxid() -> dict[str, int]:
    mapping: dict[str, int] = {}
    with open(REPORT) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            accession = rec.get("currentAccession", "")
            tax_id    = rec.get("organism", {}).get("taxId")
            if accession and tax_id:
                mapping[accession] = int(tax_id)
    return mapping


def load_sequences_by_taxid(
    assembly_to_taxid: dict[str, int],
) -> dict[int, list[tuple[str, str]]]:
    seen: set[str] = set()
    by_taxid: dict[int, list[tuple[str, str]]] = defaultdict(list)

    faa_files = sorted(DATA_DIR.glob("*/protein.faa"))
    gcf_first = sorted(faa_files, key=lambda p: (0 if p.parent.name.startswith("GCF") else 1))

    for faa_file in gcf_first:
        assembly = faa_file.parent.name
        tax_id   = assembly_to_taxid.get(assembly)
        if tax_id is None:
            continue
        for record in SeqIO.parse(faa_file, "fasta"):
            acc = record.id
            if acc in seen:
                continue
            seq = str(record.seq)
            if seq:
                seen.add(acc)
                by_taxid[tax_id].append((acc, seq))

    return dict(by_taxid)


# ── per-species embedding ─────────────────────────────────────────────────────

def embed_and_save(
    model: ESM3,
    tokenizers,
    device: torch.device,
    tax_id: int,
    species_id: int,
    proteins: list[tuple[str, str]],
) -> None:
    out_path = EMBED_DIR / f"species_{tax_id}.parquet"
    if out_path.exists():
        log(f"  taxid {tax_id}: parquet exists, skipping")
        return

    proteins = sorted(proteins, key=lambda t: len(t[1]))  # sort for padding efficiency

    accessions: list[str]        = []
    species_ids: list[int]       = []
    embeddings: list[np.ndarray] = []

    t0 = time.time()
    for i in range(0, len(proteins), GPU_BATCH):
        chunk = proteins[i : i + GPU_BATCH]
        embs  = embed_batch_esm3(model, tokenizers, [t[1] for t in chunk], device)

        accessions.extend(t[0] for t in chunk)
        species_ids.extend([species_id] * len(chunk))
        embeddings.extend(embs)

        if (i // GPU_BATCH) % 25 == 0:
            done = min(i + GPU_BATCH, len(proteins))
            rate = done / max(time.time() - t0, 1)
            log(f"    {done:,}/{len(proteins):,} ({rate:.0f} seq/s)")

    table = pa.table({
        "ncbi_protein_accession": pa.array(accessions,   type=pa.string()),
        "species_id":             pa.array(species_ids,  type=pa.int64()),
        "embedding":              pa.array(
            [e.tolist() for e in embeddings],
            type=pa.list_(pa.float32()),
        ),
    })
    pq.write_table(table, out_path, compression="snappy")

    elapsed = time.time() - t0
    size_mb = out_path.stat().st_size / 1e6
    log(f"  taxid {tax_id}: {len(proteins):,} proteins in {elapsed:.0f}s "
        f"({len(proteins)/elapsed:.0f} seq/s) | {size_mb:.1f} MB")


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--species", type=int, default=None)
    args = parser.parse_args()

    load_dotenv(ENV_FILE)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log(f"Device: {device}")
    if device.type == "cuda":
        log(f"GPU: {torch.cuda.get_device_name(0)} | "
            f"{torch.cuda.get_device_properties(0).total_memory/1e9:.1f} GB")

    log(f"Loading {MODEL_ID}...")
    os.environ.setdefault("HF_HOME", "/storage3/fs1/shandley/Active/echobase/models")
    model: ESM3 = ESM3.from_pretrained(MODEL_ID, device=device)
    model = model.eval()
    tokenizers = get_model_tokenizers(MODEL_ID)
    log("ESM3 model ready")

    log("Building assembly → taxid map...")
    assembly_to_taxid = build_assembly_to_taxid()

    log("Loading sequences from FASTA files...")
    sequences_by_taxid = load_sequences_by_taxid(assembly_to_taxid)
    total = sum(len(v) for v in sequences_by_taxid.values())
    log(f"  {total:,} proteins across {len(sequences_by_taxid)} species")

    log("Fetching species IDs from Supabase...")
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    result = client.from_("species").select("id, ncbi_tax_id").execute()
    taxid_to_sid = {row["ncbi_tax_id"]: row["id"] for row in result.data}

    tax_ids = [args.species] if args.species else sorted(sequences_by_taxid.keys())

    job_start = time.time()
    for i, tax_id in enumerate(tax_ids, 1):
        proteins   = sequences_by_taxid.get(tax_id, [])
        species_id = taxid_to_sid.get(tax_id)
        log(f"\n[{i}/{len(tax_ids)}] taxid {tax_id} | {len(proteins):,} proteins")

        if not proteins or species_id is None:
            log("  Skipping -- no proteins or not in DB")
            continue

        embed_and_save(model, tokenizers, device, tax_id, species_id, proteins)

    files = list(EMBED_DIR.glob("species_*.parquet"))
    total_gb = sum(f.stat().st_size for f in files) / 1e9
    log(f"\n=== Complete: {len(files)} species | {total_gb:.2f} GB | "
        f"{(time.time()-job_start)/3600:.2f} h ===")


if __name__ == "__main__":
    main()
