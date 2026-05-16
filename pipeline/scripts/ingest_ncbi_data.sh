#!/bin/bash
#SBATCH --job-name=echobase-ingest
#SBATCH --partition=general-cpu
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=32G
#SBATCH --time=06:00:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_ingest.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_ingest.err

echo "=== EchoBase: NCBI Data Ingestion ==="
echo "Start: $(date)"
echo "Node: $(hostname)"

source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh
conda activate echobase-ml

pip install python-dotenv -q

python /storage3/fs1/shandley/Active/echobase/pipeline/scripts/ingest_ncbi_data.py --phase all

echo ""
echo "=== Done: $(date) ==="
