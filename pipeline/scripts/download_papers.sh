#!/bin/bash
#SBATCH --job-name=echobase-papers
#SBATCH --partition=general-cpu
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=2
#SBATCH --mem=8G
#SBATCH --time=06:00:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_papers.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_papers.err

echo "=== EchoBase Literature Pipeline ==="
echo "Start: $(date)"
echo "Node:  $(hostname)"

source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/download_papers.py --phase all

echo ""
echo "=== Done: $(date) ==="
