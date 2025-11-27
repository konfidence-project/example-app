#!/bin/bash

set -e

# Configuration
COMPONENTS=("details-v1" "productpage-v1" "reviews-v1" "reviews-v2")
TRANSFER_DIR="./ocm-transfer"
COMPONENTS_DIR="./components"
REMOTE_REPO="https://konfidence.common.repositories.cloud.sap/example-app-tests"

echo "Starting OCM component processing and transfer..."
echo

# Step 1: Add component versions
echo "=== Adding Component Versions ==="
for component in "${COMPONENTS[@]}"; do
    echo "Processing component: $component"
    ocm add componentversions --create \
        --file "${TRANSFER_DIR}/${component}" \
        "${COMPONENTS_DIR}/${component}/component.yaml"
    echo
done

# Step 2: Transfer components to remote repository
echo "=== Transferring Components to Remote Repository ==="
for component in "${COMPONENTS[@]}"; do
    echo "Transferring component: $component"
    ocm transfer ctf "${TRANSFER_DIR}/${component}" "${REMOTE_REPO}" --overwrite
    echo
done

echo "All components processed and transferred successfully!"
