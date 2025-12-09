#!/bin/bash
set -e

OCI_REPOSITORY_BASE="konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations"

# Navigate to kustomizations directory
KUSTOMIZATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$KUSTOMIZATIONS_DIR"

# Iterate through all overlay folders
for overlay_dir in overlays/*/; do
    overlay_name=$(basename "$overlay_dir")

    # Separate version suffix from overlay name
    # e.g., ratings-v2 -> version: v2.0.0, overlay_name: ratings
    version="v1.0.0"
    if [[ $overlay_name =~ -v([0-9]+)$ ]]; then
        version="v${BASH_REMATCH[1]}.0.0"
        overlay_name="${overlay_name%-v[0-9]*}"
    fi

    # Push the kustomization overlay to the OCI repository
    oras_repository="$OCI_REPOSITORY_BASE/$overlay_name:$version"
    oras push "$oras_repository" "$overlay_dir" --artifact-type application/vnd.kustomize.config.v1+yaml
done
