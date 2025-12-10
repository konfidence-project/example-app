#!/bin/bash

set -e

# Configuration
SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRANSFER_DIR="${SCENARIO_DIR}/ocm/ocm-transfer"
VECTORS_DIR="${SCENARIO_DIR}/ocm/vectors"
REMOTE_REPO="konfidence.common.repositories.cloud.sap/example-app-tests"

echo "Starting Scenario 1 OCM build and transfer..."
echo "Working directory: ${SCENARIO_DIR}"
echo

# Step 1: Create transfer directory
echo "=== Step 1: Creating Transfer Directory ==="
mkdir -p "${TRANSFER_DIR}"
echo

# Step 2: Add vector to CTF
echo "=== Step 2: Adding Vector to CTF ==="
echo "Processing vector: vector-1"
ocm add componentversions --create \
    --file "${TRANSFER_DIR}/vector-1" \
    "${VECTORS_DIR}/vector-1/component.yaml"
echo

# Step 3: Transfer vector to remote repository
echo "=== Step 3: Transferring Vector to Remote Repository ==="
echo "Transferring vector: vector-1"
ocm transfer ctf "${TRANSFER_DIR}/vector-1" "${REMOTE_REPO}" --enforce
echo

# Step 4: Clean up the transfer directory
echo "=== Step 4: Cleaning Up Transfer Directory ==="
rm -r "${TRANSFER_DIR}"
echo "Cleaned up transfer directory: ${TRANSFER_DIR}"
echo

echo "Scenario 1 OCM build and transfer completed successfully!"
echo
echo "Verify with:"
echo "  oras repo ls ${REMOTE_REPO}"

