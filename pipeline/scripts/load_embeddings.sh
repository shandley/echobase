#!/bin/bash
#SBATCH --job-name=echobase-load-emb
#SBATCH --partition=general-cpu
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH --time=12:00:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_load_embeddings.out

echo "=== EchoBase Embedding Loader ==="
echo "Job ID:  $SLURM_JOB_ID"
echo "Node:    $(hostname)"
echo "Start:   $(date)"
echo ""

source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/load_embeddings.py

echo ""
echo "=== Done: $(date) ==="
