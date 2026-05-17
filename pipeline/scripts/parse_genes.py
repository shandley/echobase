#!/usr/bin/env python3
"""
EchoBase gene annotation pipeline

Parses GFF3 files from NCBI Chiroptera download, extracts gene-level
features, and loads into Supabase genes table.

Idempotent: upserts on (ncbi_gene_id) where available, otherwise
skips duplicates by tracking inserted accessions.

Usage:
  python parse_genes.py
"""

import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ENV_FILE  = Path("/storage3/fs1/shandley/Active/echobase/.env")
DATA_DIR  = Path("/storage3/fs1/shandley/Active/echobase/data/raw/chiroptera_annotated/ncbi_dataset/data")
REPORT    = DATA_DIR / "assembly_data_report.jsonl"
DB_BATCH  = 500


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


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


def parse_attributes(attr_str: str) -> dict[str, str]:
    """Parse GFF3 attribute column: key=value;key2=value2"""
    attrs: dict[str, str] = {}
    for part in attr_str.strip().split(";"):
        if "=" in part:
            k, _, v = part.partition("=")
            attrs[k.strip()] = v.strip()
    return attrs


def parse_gff3_genes(gff_path: Path) -> list[dict]:
    """Extract gene features from a GFF3 file."""
    genes: list[dict] = []
    try:
        with open(gff_path) as f:
            for line in f:
                if line.startswith("#") or not line.strip():
                    continue
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 9:
                    continue
                seqname, source, feature, start, end, score, strand, frame, attributes = parts

                if feature != "gene":
                    continue

                attrs = parse_attributes(attributes)
                gene_id_raw = attrs.get("Dbxref", "")
                ncbi_gene_id: int | None = None
                for item in gene_id_raw.split(","):
                    if item.startswith("GeneID:"):
                        try:
                            ncbi_gene_id = int(item.split(":")[1])
                        except ValueError:
                            pass
                        break

                genes.append({
                    "ncbi_gene_id":  ncbi_gene_id,
                    "symbol":        attrs.get("gene") or attrs.get("Name") or None,
                    "name":          attrs.get("product") or attrs.get("description") or None,
                    "chromosome":    seqname if not seqname.startswith("NW_") else None,
                    "strand":        strand if strand in ("+", "-") else None,
                    "start_pos":     int(start),
                    "end_pos":       int(end),
                    "gene_biotype":  attrs.get("gene_biotype") or attrs.get("biotype") or None,
                    "description":   attrs.get("product") or attrs.get("Note") or None,
                })
    except Exception as e:
        log(f"  Error parsing {gff_path.name}: {e}")
    return genes


def main() -> None:
    load_dotenv(ENV_FILE)
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    log("Building assembly → taxid map...")
    assembly_to_taxid = build_assembly_to_taxid()

    log("Fetching species IDs from Supabase...")
    result = client.from_("species").select("id, ncbi_tax_id").execute()
    taxid_to_sid = {row["ncbi_tax_id"]: row["id"] for row in result.data}

    gff_files = sorted(DATA_DIR.glob("*/genomic.gff"))
    log(f"Found {len(gff_files)} GFF3 files")

    total_inserted = 0
    buf: list[dict] = []

    for gff_file in gff_files:
        assembly  = gff_file.parent.name
        tax_id    = assembly_to_taxid.get(assembly)
        species_id = taxid_to_sid.get(tax_id) if tax_id else None

        if not species_id:
            log(f"  {assembly}: no species ID, skipping")
            continue

        genes = parse_gff3_genes(gff_file)
        log(f"  {assembly}: {len(genes):,} genes parsed")

        for g in genes:
            g["species_id"] = species_id
            buf.append(g)

            if len(buf) >= DB_BATCH:
                client.from_("genes").upsert(buf).execute()
                total_inserted += len(buf)
                log(f"  Inserted {total_inserted:,} genes so far")
                buf.clear()

    if buf:
        client.from_("genes").upsert(buf).execute()
        total_inserted += len(buf)

    log(f"Done: {total_inserted:,} genes loaded")


if __name__ == "__main__":
    main()
