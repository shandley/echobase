#!/bin/bash
#SBATCH --job-name=echobase-load-par
#SBATCH --partition=general-cpu
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem=32G
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_load_parallel.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_load_parallel.err

echo "=== EchoBase Parallel Embedding Loader ==="
echo "Job ID:  $SLURM_JOB_ID"
echo "Node:    $(hostname)"
echo "Start:   $(date)"
echo ""

source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/load_embeddings_parallel.py

echo ""
echo "=== Done: $(date) ==="
