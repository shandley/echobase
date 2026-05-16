#!/bin/bash
#SBATCH --job-name=echobase-litembedding
#SBATCH --partition=general-gpu
#SBATCH --gres=gpu:H100:1
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH --time=01:00:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_litembedding.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_litembedding.err

echo "=== EchoBase Literature Embedding ==="
echo "Start: $(date) | Node: $(hostname)"
echo "GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"

module load cuda13.0/toolkit/13.0.1
source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

export HF_HOME=/storage3/fs1/shandley/Active/echobase/models

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/embed_literature.py

echo "=== Done: $(date) ==="
