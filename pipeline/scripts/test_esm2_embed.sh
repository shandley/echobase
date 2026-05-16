#!/bin/bash
#SBATCH --job-name=echobase-esm2-test
#SBATCH --partition=general-gpu
#SBATCH --gres=gpu:H100:1
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=32G
#SBATCH --time=00:15:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_esm2_test.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_esm2_test.err

echo "=== ESM2 Test: single species (Antrozous pallidus, taxid 9440) ==="
echo "Node: $(hostname) | GPU: $(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)"
echo "Start: $(date)"

module load cuda13.0/toolkit/13.0.1
source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

export HF_HOME=/storage3/fs1/shandley/Active/echobase/models

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/embed_proteins.py --species 9440

echo "Done: $(date)"
