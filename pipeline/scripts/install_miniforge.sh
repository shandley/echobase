#!/bin/bash
# Run this once interactively on a login node -- not as a SLURM job.
# Installs Miniforge to storage3 so environments don't fill home (50GB limit).
#
# Usage: bash install_miniforge.sh

set -e

INSTALL_DIR="/storage3/fs1/shandley/Active/echobase/miniforge"

echo "Installing Miniforge to $INSTALL_DIR"

# Download Miniforge installer
curl -L -O "https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh"

# Install to storage3
bash Miniforge3-Linux-x86_64.sh -b -p "$INSTALL_DIR"
rm Miniforge3-Linux-x86_64.sh

# Initialize for this shell session
source "$INSTALL_DIR/etc/profile.d/conda.sh"
conda activate base

echo "Miniforge installed at $INSTALL_DIR"
echo ""
echo "Add this to your ~/.bashrc on Compute2:"
echo "  source /storage3/fs1/shandley/Active/echobase/miniforge/etc/profile.d/conda.sh"
