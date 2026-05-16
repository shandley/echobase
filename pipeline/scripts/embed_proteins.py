#!/usr/bin/env python3
"""
EchoBase ESM2 protein embedding pipeline

Reads protein sequences from local NCBI FASTA files (avoids Supabase
network timeouts on large sequence fetches), computes mean-pooled
ESM2-650M (1280-dim) embeddings on GPU, and saves per-species parquets.

Output: one parquet per species at
  $EMBED_DIR/species_{ncbi_tax_id}.parquet

Columns: ncbi_protein_accession (str), species_id (int),
         embedding (list[float], len=1280)

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
from supabase import create_client
from transformers import EsmModel, EsmTokenizer

# ── configuration ────────────────────────────────────────────────────────────

MODEL_ID    = "facebook/esm2_t33_650M_UR50D"
EMBED_DIM   = 1280
MAX_SEQ_LEN = 1022   # ESM2 hard limit (excluding CLS/EOS tokens)
GPU_BATCH   = 128    # H100 80GB handles this easily

ENV_FILE  = Path("/storage3/fs1/shandley/Active/echobase/.env")
EMBED_DIR = Path("/storage3/fs1/shandley/Active/echobase/embeddings/protein")
DATA_DIR  = Path("/storage3/fs1/shandley/Active/echobase/data/raw/chiroptera_annotated/ncbi_dataset/data")
REPORT    = DATA_DIR / "assembly_data_report.jsonl"

EMBED_DIR.mkdir(parents=True, exist_ok=True)

# ── helpers ──────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def mean_pool(token_embeddings: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    """Mean-pool over sequence length, excluding CLS token and padding."""
    mask = attention_mask[:, 1:].unsqueeze(-1).float()
    embs = token_embeddings[:, 1:, :]
    return (embs * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)


def embed_batch(
    model: EsmModel,
    tokenizer: EsmTokenizer,
    sequences: list[str],
    device: torch.device,
) -> np.ndarray:
    truncated = [s[:MAX_SEQ_LEN] for s in sequences]
    enc = tokenizer(
        truncated,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=MAX_SEQ_LEN + 2,
    )
    enc = {k: v.to(device) for k, v in enc.items()}
    with torch.no_grad():
        out = model(**enc)
    return mean_pool(out.last_hidden_state, enc["attention_mask"]).cpu().numpy()


# ── data loading from local FASTA ─────────────────────────────────────────────

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
    """Parse all protein.faa files, group (accession, sequence) by taxId.
    GCF files take priority over GCA to avoid duplicates."""
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
    model: EsmModel,
    tokenizer: EsmTokenizer,
    device: torch.device,
    tax_id: int,
    species_id: int,
    proteins: list[tuple[str, str]],
) -> None:
    out_path = EMBED_DIR / f"species_{tax_id}.parquet"
    if out_path.exists():
        log(f"  taxid {tax_id}: parquet exists, skipping")
        return

    proteins = sorted(proteins, key=lambda t: len(t[1]))  # minimize padding

    accessions: list[str]        = []
    species_ids: list[int]       = []
    embeddings: list[np.ndarray] = []

    t0 = time.time()
    for i in range(0, len(proteins), GPU_BATCH):
        chunk = proteins[i : i + GPU_BATCH]
        embs  = embed_batch(model, tokenizer, [t[1] for t in chunk], device)

        accessions.extend(t[0] for t in chunk)
        species_ids.extend([species_id] * len(chunk))
        embeddings.extend(embs)

        if (i // GPU_BATCH) % 50 == 0:
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
    dtype = torch.bfloat16 if device.type == "cuda" else torch.float32
    tokenizer = EsmTokenizer.from_pretrained(MODEL_ID)
    model = EsmModel.from_pretrained(MODEL_ID, torch_dtype=dtype).to(device).eval()
    log(f"Model ready: {sum(p.numel() for p in model.parameters())/1e6:.0f}M params | {dtype}")

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
            log("  Skipping")
            continue

        embed_and_save(model, tokenizer, device, tax_id, species_id, proteins)

    files = list(EMBED_DIR.glob("species_*.parquet"))
    total_gb = sum(f.stat().st_size for f in files) / 1e9
    log(f"\n=== Complete: {len(files)} species | {total_gb:.2f} GB | "
        f"{(time.time()-job_start)/3600:.2f} h ===")


if __name__ == "__main__":
    main()
