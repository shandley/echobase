#!/usr/bin/env python3
"""
EchoBase data ingestion: NCBI Chiroptera assemblies → Supabase

Phase 1: Species  -- assembly_data_report.jsonl → species table
Phase 2: Proteins -- protein.faa files → proteins table

Run via sbatch ingest_ncbi_data.sh, or directly:
  python ingest_ncbi_data.py [--phase species|proteins|all]
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from Bio import SeqIO
from dotenv import load_dotenv
from supabase import create_client, Client

# ── paths ────────────────────────────────────────────────────────────────────

DATA_DIR = Path("/storage3/fs1/shandley/Active/echobase/data/raw/chiroptera_annotated/ncbi_dataset/data")
REPORT_FILE = DATA_DIR / "assembly_data_report.jsonl"
ENV_FILE = Path("/storage3/fs1/shandley/Active/echobase/.env")

BATCH_SIZE = 500

# ── helpers ──────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def load_supabase() -> Client:
    load_dotenv(ENV_FILE)
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


def batch_upsert(client: Client, table: str, records: list[dict], conflict_col: str) -> int:
    """Insert records in batches, return total inserted."""
    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        client.table(table).upsert(batch, on_conflict=conflict_col).execute()
        total += len(batch)
        log(f"  {table}: {total}/{len(records)}")
    return total


# ── phase 1: species ─────────────────────────────────────────────────────────

def parse_assembly_report() -> tuple[list[dict], dict[str, int]]:
    """
    Parse assembly_data_report.jsonl.
    Returns (species_records, accession_to_tax_id).
    """
    species_records: list[dict] = []
    accession_to_tax_id: dict[str, int] = {}
    seen_tax_ids: set[int] = set()

    with open(REPORT_FILE) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)

            organism = rec.get("organism", {})
            assembly_info = rec.get("assemblyInfo", {})
            assembly_stats = rec.get("assemblyStats", {})
            annotation_info = rec.get("annotationInfo", {})

            tax_id: int = organism.get("taxId")
            accession: str = rec.get("currentAccession", "")

            if not tax_id or not accession:
                continue

            accession_to_tax_id[accession] = tax_id

            # Some assemblies share a tax_id (GCA/GCF pairs for same species).
            # Keep the GCF (RefSeq) record when both exist.
            if tax_id in seen_tax_ids:
                if accession.startswith("GCF_"):
                    # Replace the earlier GCA record
                    species_records = [r for r in species_records if r["ncbi_tax_id"] != tax_id]
                else:
                    continue
            seen_tax_ids.add(tax_id)

            scientific_name: str = organism.get("organismName", "")
            parts = scientific_name.split()
            genus = parts[0] if parts else None

            total_len = assembly_stats.get("totalSequenceLength", "0")
            genome_size = int(total_len) if total_len else None

            gene_counts = annotation_info.get("stats", {}).get("geneCounts", {})

            species_records.append({
                "ncbi_tax_id": tax_id,
                "scientific_name": scientific_name,
                "common_name": organism.get("commonName"),
                "genus": genus,
                "genome_assembly_accession": accession,
                "genome_size_bp": genome_size,
                "refseq_category": assembly_info.get("refseqCategory"),
                "annotation_status": assembly_info.get("assemblyLevel"),
                "metadata": {
                    "protein_coding_genes": gene_counts.get("proteinCoding"),
                    "total_genes": gene_counts.get("total"),
                    "scaffold_n50": assembly_stats.get("scaffoldN50"),
                    "contig_n50": assembly_stats.get("contigN50"),
                    "gc_percent": assembly_stats.get("gcPercent"),
                    "genome_coverage": assembly_info.get("assemblyStats", {}).get("genomeCoverage"),
                    "sequencing_tech": assembly_info.get("sequencingTech"),
                    "assembly_level": assembly_info.get("assemblyLevel"),
                    "release_date": assembly_info.get("releaseDate"),
                    "annotation_provider": annotation_info.get("provider"),
                },
            })

    return species_records, accession_to_tax_id


def ingest_species(client: Client) -> dict[str, int]:
    """Load species into Supabase. Returns accession→tax_id map."""
    log("Phase 1: Parsing assembly report...")
    species_records, accession_to_tax_id = parse_assembly_report()
    log(f"  Found {len(species_records)} unique species, {len(accession_to_tax_id)} assemblies")

    log("Phase 1: Upserting species to Supabase...")
    batch_upsert(client, "species", species_records, "ncbi_tax_id")
    log("Phase 1: Species complete.")

    return accession_to_tax_id


# ── phase 2: proteins ────────────────────────────────────────────────────────

def get_species_id_map(client: Client) -> dict[int, int]:
    """Fetch {ncbi_tax_id: id} from Supabase species table."""
    result = client.table("species").select("id, ncbi_tax_id").execute()
    return {row["ncbi_tax_id"]: row["id"] for row in result.data}


def parse_fasta_header(description: str) -> str:
    """Extract clean description from FASTA header, stripping [species name]."""
    # description = "NP_001273946.1 peroxiredoxin-1 [Myotis lucifugus]"
    # We want "peroxiredoxin-1"
    parts = description.split(" ", 1)
    text = parts[1] if len(parts) > 1 else ""
    bracket = text.rfind("[")
    if bracket > 0:
        text = text[:bracket].strip()
    return text


def ingest_proteins(client: Client, accession_to_tax_id: dict[str, int]) -> None:
    """Load proteins from all protein.faa files into Supabase."""
    log("Phase 2: Fetching species ID map from Supabase...")
    species_id_map = get_species_id_map(client)
    log(f"  {len(species_id_map)} species in database")

    faa_files = sorted(DATA_DIR.glob("*/protein.faa"))
    log(f"Phase 2: Processing {len(faa_files)} protein FASTA files...")

    total_proteins = 0
    skipped_assemblies = 0
    batch: list[dict] = []

    def flush_batch() -> None:
        nonlocal total_proteins
        if not batch:
            return
        client.table("proteins").upsert(batch, on_conflict="ncbi_protein_accession").execute()
        total_proteins += len(batch)
        batch.clear()

    for faa_file in faa_files:
        accession = faa_file.parent.name  # e.g. GCF_000147115.1

        tax_id = accession_to_tax_id.get(accession)
        if tax_id is None:
            log(f"  WARNING: no tax_id for {accession}, skipping")
            skipped_assemblies += 1
            continue

        species_id = species_id_map.get(tax_id)
        if species_id is None:
            log(f"  WARNING: no species_id for tax_id {tax_id} ({accession}), skipping")
            skipped_assemblies += 1
            continue

        assembly_protein_count = 0
        for record in SeqIO.parse(faa_file, "fasta"):
            batch.append({
                "ncbi_protein_accession": record.id,
                "species_id": species_id,
                "sequence": str(record.seq),
                "length": len(record.seq),
                "description": parse_fasta_header(record.description),
            })
            assembly_protein_count += 1

            if len(batch) >= BATCH_SIZE:
                flush_batch()
                log(f"  proteins inserted so far: {total_proteins}")

        log(f"  {accession}: {assembly_protein_count} proteins queued")

    flush_batch()

    log(f"Phase 2: Proteins complete.")
    log(f"  Total inserted: {total_proteins}")
    log(f"  Assemblies skipped: {skipped_assemblies}")


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest NCBI bat data into Supabase")
    parser.add_argument(
        "--phase",
        choices=["species", "proteins", "all"],
        default="all",
        help="Which ingestion phase to run (default: all)",
    )
    args = parser.parse_args()

    log("Connecting to Supabase...")
    client = load_supabase()
    log("Connected.")

    accession_to_tax_id: dict[str, int] = {}

    if args.phase in ("species", "all"):
        accession_to_tax_id = ingest_species(client)

    if args.phase == "proteins" and not accession_to_tax_id:
        # Re-parse just for the mapping (species already in DB)
        log("Re-parsing assembly report for accession map...")
        _, accession_to_tax_id = parse_assembly_report()

    if args.phase in ("proteins", "all"):
        ingest_proteins(client, accession_to_tax_id)

    log("Ingestion complete.")


if __name__ == "__main__":
    main()
