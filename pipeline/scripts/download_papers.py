#!/usr/bin/env python3
"""
EchoBase literature pipeline -- PubMed + PubTator3

Phase 1: Fetch all Chiroptera[MeSH] papers from PubMed → papers table
Phase 2: Run PubTator3 entity linking → paper_entities + junction tables

Idempotent: upserts on pmid, safe to restart.

Usage:
  python download_papers.py --phase all      # default
  python download_papers.py --phase pubmed   # download only
  python download_papers.py --phase pubtator # entity linking only
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests
from Bio import Entrez
from dotenv import load_dotenv
from supabase import create_client

# ── config ───────────────────────────────────────────────────────────────────

Entrez.email = "shandley@wustl.edu"
PUBMED_QUERY  = "Chiroptera[MeSH Terms]"
FETCH_BATCH   = 500    # records per efetch call
DB_BATCH      = 500    # records per Supabase upsert
PUBTATOR_BATCH = 100   # PMIDs per PubTator3 API call

ENV_FILE = Path("/storage3/fs1/shandley/Active/echobase/.env")
PUBTATOR_URL = "https://www.ncbi.nlm.nih.gov/research/pubtator3-api/publications/export/biocjson"

# ── helpers ──────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def retry(fn, retries: int = 3, delay: float = 5.0):
    """Retry a function on exception with exponential backoff."""
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            if attempt == retries - 1:
                raise
            log(f"  Retrying after error: {e}")
            time.sleep(delay * (2 ** attempt))


# ── PubMed parsing ────────────────────────────────────────────────────────────

def parse_abstract(article: dict) -> str | None:
    if "Abstract" not in article:
        return None
    texts = article["Abstract"]["AbstractText"]
    if isinstance(texts, list):
        return " ".join(str(t) for t in texts)
    return str(texts) or None


def parse_year(pubdate: dict) -> int | None:
    raw = str(pubdate.get("Year", pubdate.get("MedlineDate", "")))
    digits = "".join(c for c in raw if c.isdigit())
    return int(digits[:4]) if len(digits) >= 4 else None


def parse_doi(article: dict) -> str | None:
    for loc in article.get("ELocationID", []):
        if hasattr(loc, "attributes") and loc.attributes.get("EIdType") == "doi":
            return str(loc)
    # Also check ArticleIdList in PubmedData
    return None


def parse_authors(article: dict) -> list[str]:
    authors = []
    for author in article.get("AuthorList", []):
        last = str(author.get("LastName", ""))
        fore = str(author.get("ForeName", ""))
        if last:
            authors.append(f"{last}, {fore}".strip(", "))
    return authors


def parse_record(pubmed_article: dict) -> dict | None:
    try:
        citation = pubmed_article["MedlineCitation"]
        article  = citation["Article"]

        pmid  = int(str(citation["PMID"]))
        title = str(article["ArticleTitle"])
        abstract = parse_abstract(article)
        journal  = str(article["Journal"]["Title"])
        pubdate  = article["Journal"]["JournalIssue"]["PubDate"]
        year     = parse_year(pubdate)
        doi      = parse_doi(article)
        authors  = parse_authors(article)

        return {
            "pmid":                pmid,
            "title":               title[:2000],   # guard against runaway titles
            "abstract":            abstract,
            "journal":             journal,
            "year":                year,
            "doi":                 doi,
            "authors":             authors,
            "full_text_available": False,
        }
    except Exception as e:
        log(f"  Parse error: {e}")
        return None


# ── phase 1: PubMed download ─────────────────────────────────────────────────

def run_pubmed(client) -> list[int]:
    log(f"Searching PubMed: {PUBMED_QUERY}")
    search_handle = retry(lambda: Entrez.esearch(
        db="pubmed",
        term=PUBMED_QUERY,
        retmax=0,
        usehistory="y",
    ))
    search_results = Entrez.read(search_handle)
    search_handle.close()

    total   = int(search_results["Count"])
    webenv  = search_results["WebEnv"]
    qkey    = search_results["QueryKey"]
    log(f"Found {total:,} papers")

    all_pmids:   list[int]  = []
    records_buf: list[dict] = []
    inserted = 0

    for start in range(0, total, FETCH_BATCH):
        # Non-fatal batch fetch: a single bad batch (400/503) should not crash
        # the whole run. Log it and continue to the next batch.
        try:
            fetch_handle = retry(lambda s=start: Entrez.efetch(
                db="pubmed",
                rettype="xml",
                retmode="xml",
                retstart=s,
                retmax=FETCH_BATCH,
                webenv=webenv,
                query_key=qkey,
            ))
            batch_data = Entrez.read(fetch_handle)
            fetch_handle.close()
        except Exception as e:
            log(f"  Skipping batch {start}-{start+FETCH_BATCH}: {e}")
            time.sleep(5.0)
            continue

        for article in batch_data.get("PubmedArticle", []):
            row = parse_record(article)
            if row:
                records_buf.append(row)
                all_pmids.append(row["pmid"])

        # Flush to Supabase
        if len(records_buf) >= DB_BATCH:
            client.from_("papers").upsert(
                records_buf, on_conflict="pmid"
            ).execute()
            inserted += len(records_buf)
            records_buf.clear()
            log(f"  Inserted {inserted:,}/{total} papers")

        time.sleep(0.34)  # NCBI rate limit: 3 req/s without API key

    if records_buf:
        client.from_("papers").upsert(
            records_buf, on_conflict="pmid"
        ).execute()
        inserted += len(records_buf)

    log(f"Phase 1 complete: {inserted:,} papers loaded")
    return all_pmids


# ── phase 2: PubTator3 entity linking ────────────────────────────────────────

ENTITY_TYPES = {
    "Gene": "gene",
    "Disease": "disease",
    "Chemical": "chemical",
    "Species": "species",
    "Mutation": "variant",
    "CellLine": "cell_line",
}

def fetch_pubtator(pmids: list[int]) -> list[dict]:
    """Call PubTator3 API for a batch of PMIDs, return annotation rows."""
    params = {"pmids": ",".join(str(p) for p in pmids), "full": "true"}
    resp = retry(lambda: requests.get(PUBTATOR_URL, params=params, timeout=60))
    if resp.status_code != 200:
        log(f"  PubTator3 HTTP {resp.status_code} for {len(pmids)} PMIDs")
        return []

    rows: list[dict] = []
    for line in resp.text.strip().split("\n"):
        if not line:
            continue
        try:
            doc = json.loads(line)
        except json.JSONDecodeError:
            continue

        pmid = None
        for passage in doc.get("passages", []):
            for ann in passage.get("annotations", []):
                infons = ann.get("infons", {})
                etype  = infons.get("type", "")
                mapped = ENTITY_TYPES.get(etype)
                if not mapped:
                    continue

                # Get PMID from document id
                if pmid is None:
                    pmid = int(doc.get("id", 0)) or None

                identifier = infons.get("identifier") or infons.get("Identifier")
                text       = ann.get("text", "")

                if pmid and text:
                    rows.append({
                        "paper_pmid":   pmid,
                        "entity_type":  mapped,
                        "entity_name":  text[:500],
                        "normalized_id": str(identifier) if identifier else None,
                    })
    return rows


def run_pubtator(client) -> None:
    log("Phase 2: fetching PMIDs from papers table...")
    # Paginate -- Supabase caps single response at 1,000 rows
    all_rows: list[dict] = []
    offset = 0
    while True:
        result = client.from_("papers").select("pmid, id") \
            .range(offset, offset + 999).execute()
        batch = result.data or []
        all_rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    papers_map = {row["pmid"]: row["id"] for row in all_rows}
    pmids = list(papers_map.keys())
    log(f"  {len(pmids):,} papers to annotate")

    entity_buf: list[dict] = []
    annotated = 0

    for i in range(0, len(pmids), PUBTATOR_BATCH):
        batch = pmids[i : i + PUBTATOR_BATCH]
        rows  = fetch_pubtator(batch)

        for row in rows:
            paper_id = papers_map.get(row.pop("paper_pmid"))
            if paper_id:
                row["paper_id"] = paper_id
                entity_buf.append(row)

        if len(entity_buf) >= DB_BATCH:
            client.from_("paper_entities").upsert(entity_buf).execute()
            entity_buf.clear()

        annotated += len(batch)
        if annotated % 5000 == 0:
            log(f"  PubTator3: {annotated:,}/{len(pmids):,} papers annotated")

        time.sleep(0.5)  # PubTator3 rate limit

    if entity_buf:
        client.from_("paper_entities").upsert(entity_buf).execute()

    log(f"Phase 2 complete")

    # Build species_papers junction from entity annotations
    log("Building species_papers junction table...")
    species_result = client.from_("species").select("id, ncbi_tax_id").execute()
    tax_to_species = {str(row["ncbi_tax_id"]): row["id"] for row in species_result.data}

    species_entities = client.from_("paper_entities") \
        .select("paper_id, normalized_id") \
        .eq("entity_type", "species") \
        .execute()

    junction_buf: list[dict] = []
    seen: set[tuple] = set()
    for row in species_entities.data:
        species_id = tax_to_species.get(row["normalized_id"])
        paper_id   = row["paper_id"]
        if species_id and paper_id and (species_id, paper_id) not in seen:
            junction_buf.append({"species_id": species_id, "paper_id": paper_id})
            seen.add((species_id, paper_id))

    if junction_buf:
        for i in range(0, len(junction_buf), DB_BATCH):
            client.from_("species_papers").upsert(
                junction_buf[i : i + DB_BATCH]
            ).execute()
        log(f"  Added {len(junction_buf):,} species-paper links")


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--phase",
        choices=["pubmed", "pubtator", "all"],
        default="all",
    )
    args = parser.parse_args()

    load_dotenv(ENV_FILE)
    client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )
    log("Connected to Supabase")

    if args.phase in ("pubmed", "all"):
        run_pubmed(client)

    if args.phase in ("pubtator", "all"):
        run_pubtator(client)

    log("Literature pipeline complete")


if __name__ == "__main__":
    main()
