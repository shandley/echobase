#!/bin/bash
#SBATCH --job-name=echobase-load-pg
#SBATCH --partition=general-cpu
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=32G
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_load_pg.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_load_pg.err

echo "=== EchoBase Embedding Loader (direct PostgreSQL) ==="
echo "Job ID:  $SLURM_JOB_ID"
echo "Node:    $(hostname)"
echo "Start:   $(date)"
echo ""

source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

# Install psycopg2 if not present
pip install psycopg2-binary -q

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/load_embeddings_pg.py

echo ""
echo "=== Done: $(date) ==="
