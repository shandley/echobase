#!/bin/bash
#SBATCH --job-name=echobase-voyage
#SBATCH --partition=general-cpu
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=2
#SBATCH --mem=8G
#SBATCH --time=02:00:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_voyage.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_voyage.err

echo "=== EchoBase: Voyage AI Literature Embedding ==="
echo "Start: $(date) | Node: $(hostname)"

source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/embed_literature_voyage.py

echo "=== Done: $(date) ==="
