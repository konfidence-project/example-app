#!/bin/bash

set -e

# Configuration
SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENTS=("ratings-v2-mysql")
TRANSFER_DIR="${SCENARIO_DIR}/ocm/ocm-transfer"
COMPONENTS_DIR="${SCENARIO_DIR}/ocm/components"
VECTORS_DIR="${SCENARIO_DIR}/ocm/vectors"
REMOTE_REPO="konfidence.common.repositories.cloud.sap/example-app-tests"

# Change to scenario directory to ensure relative paths work
cd "${SCENARIO_DIR}"

echo "Starting Scenario 3 OCM build and transfer..."
echo "Working directory: ${SCENARIO_DIR}"
echo

# Step 1: Create transfer directory
echo "=== Step 1: Creating Transfer Directory ==="
mkdir -p "${TRANSFER_DIR}"
echo

# Step 2: Add component versions to CTF
echo "=== Step 2: Adding Component Versions to CTF ==="
for component in "${COMPONENTS[@]}"; do
    echo "Processing component: ${component}"
    ocm add componentversions --create \
        --file "${TRANSFER_DIR}/${component}" \
        "${COMPONENTS_DIR}/${component}/component.yaml"
    echo
done

# Step 3: Transfer components to remote repository
echo "=== Step 3: Transferring Components to Remote Repository ==="
for component in "${COMPONENTS[@]}"; do
    echo "Transferring component: ${component}"
    ocm transfer ctf "${TRANSFER_DIR}/${component}" "${REMOTE_REPO}" --overwrite
    echo
done

# Step 4: Add vector to CTF
echo "=== Step 4: Adding Vector to CTF ==="
echo "Processing vector: vector-3"
ocm add componentversions --create \
    --file "${TRANSFER_DIR}/vector-3" \
    "${VECTORS_DIR}/vector-3/component.yaml"
echo

# Step 5: Transfer vector to remote repository
echo "=== Step 5: Transferring Vector to Remote Repository ==="
echo "Transferring vector: vector-3"
ocm transfer ctf "${TRANSFER_DIR}/vector-3" "${REMOTE_REPO}" --overwrite
echo

echo "Scenario 3 OCM build and transfer completed successfully!"
echo
echo "Verify with:"
echo "  oras repo ls ${REMOTE_REPO}"

