#!/usr/bin/env python3
"""
EchoBase literature embedding pipeline

Fetches all bat biology papers from Supabase, computes PubMedBERT
embeddings (768-dim) over title + abstract, writes back to papers.embedding.

Model: NeuML/pubmedbert-base-embeddings (110M params)
Embedding dim: 768 (matches vector(768) in Supabase schema)

Idempotent: only fetches papers where embedding IS NULL.
"""

import os
import time
from pathlib import Path

import numpy as np
import torch
from dotenv import load_dotenv
from supabase import create_client
from transformers import AutoModel, AutoTokenizer

# ── config ────────────────────────────────────────────────────────────────────

MODEL_ID     = "NeuML/pubmedbert-base-embeddings"
MAX_TOKENS   = 512    # PubMedBERT limit
GPU_BATCH    = 64     # small model, generous batch
DB_PAGE_SIZE = 1000   # Supabase row cap
DB_UPSERT    = 500    # records per upsert call

ENV_FILE = Path("/storage3/fs1/shandley/Active/echobase/.env")


# ── helpers ──────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def mean_pool(token_embeddings: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    mask = attention_mask.unsqueeze(-1).float()
    return (token_embeddings * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)


def embed_texts(
    model: AutoModel,
    tokenizer: AutoTokenizer,
    texts: list[str],
    device: torch.device,
) -> np.ndarray:
    enc = tokenizer(
        texts,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=MAX_TOKENS,
    )
    enc = {k: v.to(device) for k, v in enc.items()}
    with torch.no_grad():
        out = model(**enc)
    return mean_pool(out.last_hidden_state, enc["attention_mask"]).cpu().float().numpy()


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    load_dotenv(ENV_FILE)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log(f"Device: {device}")

    log(f"Loading {MODEL_ID}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    dtype = torch.float16 if device.type == "cuda" else torch.float32
    model = AutoModel.from_pretrained(MODEL_ID, torch_dtype=dtype).to(device).eval()
    log(f"Model ready: {sum(p.numel() for p in model.parameters())/1e6:.0f}M params")

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    # Fetch all unembedded papers, paginating
    log("Fetching unembedded papers from Supabase...")
    papers: list[dict] = []
    offset = 0
    while True:
        result = client.from_("papers") \
            .select("id, pmid, title, abstract") \
            .is_("embedding", "null") \
            .range(offset, offset + DB_PAGE_SIZE - 1) \
            .execute()
        batch = result.data or []
        papers.extend(batch)
        if len(batch) < DB_PAGE_SIZE:
            break
        offset += DB_PAGE_SIZE

    log(f"  {len(papers):,} papers to embed")
    if not papers:
        log("Nothing to do.")
        return

    upsert_buf: list[dict] = []
    total_embedded = 0
    t0 = time.time()

    for i in range(0, len(papers), GPU_BATCH):
        chunk = papers[i : i + GPU_BATCH]

        # Concatenate title + abstract for embedding
        texts = [
            f"{r['title'] or ''} {r['abstract'] or ''}".strip()
            for r in chunk
        ]
        embs = embed_texts(model, tokenizer, texts, device)

        for row, emb in zip(chunk, embs):
            upsert_buf.append({"id": row["id"], "embedding": emb.tolist()})

        if len(upsert_buf) >= DB_UPSERT:
            client.from_("papers").upsert(upsert_buf, on_conflict="id").execute()
            total_embedded += len(upsert_buf)
            upsert_buf.clear()
            rate = total_embedded / max(time.time() - t0, 1)
            log(f"  {total_embedded:,}/{len(papers):,} embedded ({rate:.0f} papers/s)")

    if upsert_buf:
        client.from_("papers").upsert(upsert_buf, on_conflict="id").execute()
        total_embedded += len(upsert_buf)

    elapsed = time.time() - t0
    log(f"\nDone: {total_embedded:,} papers embedded in {elapsed:.0f}s "
        f"({total_embedded/elapsed:.0f} papers/s)")


if __name__ == "__main__":
    main()
