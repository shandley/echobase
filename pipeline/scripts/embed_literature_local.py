#!/usr/bin/env python3
"""
EchoBase literature embedding -- local BAAI/bge-large-en-v1.5 (1024-dim)

Embeds all bat biology papers locally on GPU using BAAI/bge-large-en-v1.5.
No external API needed. Produces 1024-dim vectors matching the Supabase schema.

BAAI/bge-large-en-v1.5 is a top-performing retrieval model on MTEB benchmarks.
"""

import os
import time
from pathlib import Path

import numpy as np
import torch
from dotenv import load_dotenv
from supabase import create_client
from transformers import AutoModel, AutoTokenizer

ENV_FILE = Path("/storage3/fs1/shandley/Active/echobase/.env")

MODEL_ID   = "BAAI/bge-large-en-v1.5"
MAX_TOKENS = 512
GPU_BATCH  = 64
DB_PAGE    = 1000
DB_UPSERT  = 200


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def mean_pool(token_embeddings: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    mask = attention_mask.unsqueeze(-1).float()
    return (token_embeddings * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1e-9)


def embed_texts(texts: list[str], model: AutoModel, tokenizer: AutoTokenizer,
                device: torch.device) -> np.ndarray:
    enc = tokenizer(texts, return_tensors="pt", padding=True,
                    truncation=True, max_length=MAX_TOKENS)
    enc = {k: v.to(device) for k, v in enc.items()}
    with torch.no_grad():
        out = model(**enc)
    pooled = mean_pool(out.last_hidden_state, enc["attention_mask"])
    # bge models benefit from L2 normalisation for cosine similarity
    pooled = torch.nn.functional.normalize(pooled, p=2, dim=1)
    return pooled.cpu().float().numpy()


def main() -> None:
    load_dotenv(ENV_FILE)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log(f"Device: {device}")

    log(f"Loading {MODEL_ID}...")
    os.environ.setdefault("HF_HOME", "/storage3/fs1/shandley/Active/echobase/models")
    dtype = torch.bfloat16 if device.type == "cuda" else torch.float32
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModel.from_pretrained(MODEL_ID, torch_dtype=dtype).to(device).eval()
    log(f"Model ready: {sum(p.numel() for p in model.parameters())/1e6:.0f}M params")

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    log("Fetching papers...")
    papers: list[dict] = []
    offset = 0
    while True:
        result = client.from_("papers").select("id, pmid, title, abstract") \
            .range(offset, offset + DB_PAGE - 1).execute()
        batch = result.data or []
        papers.extend(batch)
        if len(batch) < DB_PAGE:
            break
        offset += DB_PAGE
    log(f"  {len(papers):,} papers")

    upsert_buf: list[dict] = []
    total = 0
    t0 = time.time()

    for i in range(0, len(papers), GPU_BATCH):
        chunk = papers[i : i + GPU_BATCH]
        texts = [f"{r['title'] or ''} {r['abstract'] or ''}".strip() for r in chunk]
        embs  = embed_texts(texts, model, tokenizer, device)

        for row, emb in zip(chunk, embs):
            upsert_buf.append({"id": row["id"], "pmid": row["pmid"],
                               "title": row["title"], "embedding": emb.tolist()})

        if len(upsert_buf) >= DB_UPSERT:
            client.from_("papers").upsert(upsert_buf, on_conflict="id").execute()
            total += len(upsert_buf)
            upsert_buf.clear()
            rate = total / max(time.time() - t0, 1)
            log(f"  {total:,}/{len(papers):,} ({rate:.0f} papers/s)")

    if upsert_buf:
        client.from_("papers").upsert(upsert_buf, on_conflict="id").execute()
        total += len(upsert_buf)

    log(f"Done: {total:,} papers | {MODEL_ID} | 1024-dim | {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
