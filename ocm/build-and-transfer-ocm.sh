#!/bin/bash

set -e

# Configuration
OCM_COMPONENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENTS=("details" "productpage" "reviews" "ratings")
TRANSFER_DIR="${OCM_COMPONENT_DIR}/ocm-transfer"
REMOTE_REPO="konfidence.common.repositories.cloud.sap/example-app-tests"

echo "Starting OCM components build and transfer..."
echo "Working directory: ${OCM_COMPONENT_DIR}"
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
        "${OCM_COMPONENT_DIR}/${component}.yaml"
    echo
done

# Step 3: Transfer components to remote repository
echo "=== Step 3: Transferring Components to Remote Repository ==="
for component in "${COMPONENTS[@]}"; do
    echo "Transferring component: ${component}"
    ocm transfer ctf "${TRANSFER_DIR}/${component}" "${REMOTE_REPO}" --enforce
    echo
done

# Step 4: Clean up the transfer directory
echo "=== Step 4: Cleaning Up Transfer Directory ==="
rm -r "${TRANSFER_DIR}"
echo "Cleaned up transfer directory: ${TRANSFER_DIR}"
echo

echo "OCM build and transfer completed successfully!"
echo
echo "Verify with:"
echo "  oras repo ls ${REMOTE_REPO}"

