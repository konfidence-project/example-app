#!/bin/bash
set -e

OCI_REPOSITORY_BASE="konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations"
BUILD_DIR=".tmp"

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

    # Build the kustomization overlay
    mkdir -p "$BUILD_DIR/$overlay_name"
    kustomize build "$overlay_dir" > "$BUILD_DIR/$overlay_name/manifests.yaml"

    # Create a kustomization.yaml file that references the manifests.yaml
    cat > "$BUILD_DIR/$overlay_name/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - manifests.yaml
EOF

    # Push the built kustomization file to the OCI repository
    # Use -v (verbose) to specify the file path without the .tmp directory
    oras_repository="$OCI_REPOSITORY_BASE/$overlay_name:$version"
    (cd "$BUILD_DIR" && oras push "$oras_repository" "$overlay_name" --artifact-type application/vnd.kustomize.config.v1+yaml)
done

# Cleanup temporary directory
rm -rf "$BUILD_DIR"