#!/bin/bash
#SBATCH --job-name=echobase-esm2
#SBATCH --partition=general-gpu
#SBATCH --gres=gpu:H100:1
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --mem=64G
#SBATCH --time=12:00:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_esm2.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_esm2.err

echo "=== EchoBase ESM2 Embedding Job ==="
echo "Job ID:    $SLURM_JOB_ID"
echo "Node:      $(hostname)"
echo "GPU:       $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"
echo "Start:     $(date)"
echo ""

module load cuda13.0/toolkit/13.0.1
source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

export HF_HOME=/storage3/fs1/shandley/Active/echobase/models

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/embed_proteins.py

echo ""
echo "=== Done: $(date) ==="
