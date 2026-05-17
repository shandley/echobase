#!/bin/bash
#SBATCH --job-name=echobase-genes
#SBATCH --partition=general-cpu
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH --time=04:00:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_genes.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_genes.err

echo "=== EchoBase Gene Annotation Pipeline ==="
echo "Start: $(date) | Node: $(hostname)"

source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/parse_genes.py

echo "=== Done: $(date) ==="
