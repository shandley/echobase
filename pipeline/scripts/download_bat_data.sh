#!/bin/bash
#SBATCH --job-name=echobase-ncbi-download
#SBATCH --partition=general-cpu
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=32G
#SBATCH --time=12:00:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_ncbi_download.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_ncbi_download.err

source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

RAWDIR="/storage3/fs1/shandley/Active/echobase/data/raw"
mkdir -p "$RAWDIR"

echo "=== EchoBase: NCBI Bat Data Download ==="
echo "Start: $(date)"
echo "Node: $(hostname)"

# Chiroptera NCBI taxonomy ID: 9397
# Download annotated assemblies only -- includes protein FASTAs, GFF3, assembly metadata
echo ""
echo "=== Downloading annotated Chiroptera genomes ==="
datasets download genome taxon 9397 \
  --annotated \
  --include protein,gff3,seq-report \
  --filename "$RAWDIR/chiroptera_annotated.zip"

echo "Download complete: $(date)"
echo "File size: $(du -sh $RAWDIR/chiroptera_annotated.zip)"

echo ""
echo "=== Unzipping ==="
unzip -o "$RAWDIR/chiroptera_annotated.zip" -d "$RAWDIR/chiroptera_annotated/"
echo "Unzipped: $(date)"

echo ""
echo "=== Summary ==="
echo "Species count (by protein FASTA):"
find "$RAWDIR/chiroptera_annotated/" -name "protein.faa" | wc -l

echo "Total protein files:"
find "$RAWDIR/chiroptera_annotated/" -name "protein.faa" | head -5

echo "Assembly reports:"
find "$RAWDIR/chiroptera_annotated/" -name "sequence_report.jsonl" | wc -l

echo ""
echo "=== Done: $(date) ==="
