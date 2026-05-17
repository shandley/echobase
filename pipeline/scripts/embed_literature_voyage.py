#!/usr/bin/env python3
"""
EchoBase literature embedding -- Voyage AI voyage-3 (1024-dim)

Re-embeds all bat biology papers using Voyage AI's voyage-3 model.
Replaces PubMedBERT (768-dim) embeddings with higher-quality
voyage-3 (1024-dim) vectors optimized for retrieval.

Cost: ~9,999 papers × 300 tokens avg = ~3M tokens × $0.06/1M = ~$0.18

Usage:
  python embed_literature_voyage.py
"""

import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from supabase import create_client

ENV_FILE = Path("/storage3/fs1/shandley/Active/echobase/.env")

VOYAGE_MODEL  = "voyage-3"
VOYAGE_URL    = "https://api.voyageai.com/v1/embeddings"
VOYAGE_BATCH  = 80    # texts per request (free tier: 3 RPM, ~100K tokens/min)
RATE_LIMIT_SLEEP = 22 # seconds between requests (3 RPM = 1 per 20s, +2s buffer)
DB_PAGE_SIZE  = 1000  # Supabase row cap
DB_UPSERT     = 200   # records per upsert (1024-dim × float32 ≈ 4KB/record)


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def embed_texts(texts: list[str], api_key: str) -> list[list[float]]:
    """Embed a batch of texts with Voyage AI, return list of 1024-dim vectors.
    Retries indefinitely on 429 (rate limit) with 65s wait; raises on other errors."""
    while True:
        resp = requests.post(
            VOYAGE_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": VOYAGE_MODEL, "input": texts},
            timeout=60,
        )
        if resp.status_code == 429:
            log("  Rate limited -- waiting 65s for limit to reset...")
            time.sleep(65)
            continue
        resp.raise_for_status()
        data = resp.json()
        items = sorted(data["data"], key=lambda x: x["index"])
        return [item["embedding"] for item in items]


def main() -> None:
    load_dotenv(ENV_FILE)

    voyage_key = os.environ.get("VOYAGE_API_KEY")
    if not voyage_key:
        raise SystemExit("ERROR: VOYAGE_API_KEY not set in .env")

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    # Fetch all papers, paginating
    log("Fetching papers from Supabase...")
    papers: list[dict] = []
    offset = 0
    while True:
        result = client.from_("papers") \
            .select("id, pmid, title, abstract") \
            .range(offset, offset + DB_PAGE_SIZE - 1) \
            .execute()
        batch = result.data or []
        papers.extend(batch)
        if len(batch) < DB_PAGE_SIZE:
            break
        offset += DB_PAGE_SIZE

    log(f"  {len(papers):,} papers to embed with {VOYAGE_MODEL}")
    log("  Waiting 10s before first request...")
    time.sleep(10)

    upsert_buf: list[dict] = []
    total = 0
    t0 = time.time()

    for i in range(0, len(papers), VOYAGE_BATCH):
        chunk = papers[i : i + VOYAGE_BATCH]
        texts = [
            f"{r['title'] or ''} {r['abstract'] or ''}".strip()
            for r in chunk
        ]

        embeddings = embed_texts(texts, voyage_key)

        for row, emb in zip(chunk, embeddings):
            upsert_buf.append({
                "id":       row["id"],
                "pmid":     row["pmid"],
                "title":    row["title"],
                "embedding": emb,
            })

        if len(upsert_buf) >= DB_UPSERT:
            client.from_("papers").upsert(upsert_buf, on_conflict="id").execute()
            total += len(upsert_buf)
            upsert_buf.clear()
            rate = total / max(time.time() - t0, 1)
            log(f"  {total:,}/{len(papers):,} embedded ({rate:.0f} papers/s)")

        time.sleep(RATE_LIMIT_SLEEP)  # respect 3 RPM free tier limit

    if upsert_buf:
        client.from_("papers").upsert(upsert_buf, on_conflict="id").execute()
        total += len(upsert_buf)

    elapsed = time.time() - t0
    log(f"\nDone: {total:,} papers embedded in {elapsed:.0f}s")
    log(f"Model: {VOYAGE_MODEL} | Dimension: 1024")


if __name__ == "__main__":
    main()
