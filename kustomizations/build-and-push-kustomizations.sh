#!/bin/bash
set -e

OCI_REPOSITORY_BASE="konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations"

# Navigate to kustomizations directory
KUSTOMIZATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$KUSTOMIZATIONS_DIR"

# Iterate through all overlay folders
for overlay_dir in overlays/*/; do
    overlay_name=$(basename "$overlay_dir")

    # Extract version from overlay name (e.g., ratings-v2 -> v2.0.0), use v1.0.0 as default
    version="v1.0.0"
    if [[ $overlay_name =~ -v([0-9]+)$ ]]; then
        version="v${BASH_REMATCH[1]}.0.0"
    fi

    oras_repository="$OCI_REPOSITORY_BASE/$overlay_name:$version"
    oras push "$oras_repository" "$overlay_dir" --artifact-type application/vnd.kustomize.config.v1+yaml
done
