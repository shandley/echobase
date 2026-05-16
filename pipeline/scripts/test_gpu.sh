#!/bin/bash
#SBATCH --job-name=echobase-gpu-test
#SBATCH --partition=general-gpu
#SBATCH --gres=gpu:H100:1
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH --time=00:10:00
#SBATCH --output=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_test.out
#SBATCH --error=/storage3/fs1/shandley/Active/echobase/pipeline/logs/%j_test.err

echo "=== Job Info ==="
echo "Job ID: $SLURM_JOB_ID"
echo "Node: $(hostname)"
echo "Date: $(date)"
echo "Partition: $SLURM_JOB_PARTITION"

echo ""
echo "=== GPU Info ==="
module load cuda13.0/toolkit/13.0.1
nvidia-smi

echo ""
echo "=== CUDA Version ==="
nvcc --version

echo ""
echo "=== System Python ==="
python3 --version

echo ""
echo "=== Storage Check ==="
ls /storage3/fs1/shandley/Active/echobase/
df -h /storage3/fs1/shandley/

echo ""
echo "=== Done ==="
date
