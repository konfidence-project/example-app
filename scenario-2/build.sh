#!/bin/bash

set -e

# Configuration
SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENTS=("reviews-v2")
TRANSFER_DIR="${SCENARIO_DIR}/ocm/ocm-transfer"
COMPONENTS_DIR="${SCENARIO_DIR}/ocm/components"
VECTORS_DIR="${SCENARIO_DIR}/ocm/vectors"
KUSTOMIZATIONS_DIR="${SCENARIO_DIR}/manifests/kustomizations"
REMOTE_REPO="konfidence.common.repositories.cloud.sap/example-app-tests"

echo "Starting Scenario 2 build and push..."
echo "Working directory: ${SCENARIO_DIR}"
echo

# Step 1: Push Kustomizations to OCI Registry
echo "=== Step 1: Pushing Kustomizations to OCI Registry ==="
for component in "${COMPONENTS[@]}"; do
    echo "Pushing kustomization: ${component}"
    oras push "${REMOTE_REPO}/kustomizations/${component}:v0.0.1" \
        "${KUSTOMIZATIONS_DIR}/${component}/" \
        --artifact-type application/vnd.kustomize.config.v1+yaml
    echo
done

# Step 2: Create transfer directory
echo "=== Step 2: Creating Transfer Directory ==="
mkdir -p "${TRANSFER_DIR}"
echo

# Step 3: Add component versions to CTF
echo "=== Step 3: Adding Component Versions to CTF ==="
for component in "${COMPONENTS[@]}"; do
    echo "Processing component: ${component}"
    ocm add componentversions --create \
        --file "${TRANSFER_DIR}/${component}" \
        "${COMPONENTS_DIR}/${component}/component.yaml"
    echo
done

# Step 4: Transfer components to remote repository
echo "=== Step 4: Transferring Components to Remote Repository ==="
for component in "${COMPONENTS[@]}"; do
    echo "Transferring component: ${component}"
    ocm transfer ctf "${TRANSFER_DIR}/${component}" "${REMOTE_REPO}" --overwrite
    echo
done

# Step 5: Add vector to CTF
echo "=== Step 5: Adding Vector to CTF ==="
echo "Processing vector: vector-2"
ocm add componentversions --create \
    --file "${TRANSFER_DIR}/vector-2" \
    "${VECTORS_DIR}/vector-2/component.yaml"
echo

# Step 6: Transfer vector to remote repository
echo "=== Step 6: Transferring Vector to Remote Repository ==="
echo "Transferring vector: vector-2"
ocm transfer ctf "${TRANSFER_DIR}/vector-2" "${REMOTE_REPO}" --overwrite
echo

echo "Scenario 2 build and push completed successfully!"
echo
echo "Verify with:"
echo "  oras repo tags ${REMOTE_REPO}/kustomizations/reviews-v2"
echo "  oras repo ls ${REMOTE_REPO}"

