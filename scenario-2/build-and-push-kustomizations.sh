#!/bin/bash
set -e

OCI_REPOSITORY_BASE="konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations"

# Navigate to scenario-1 kustomizations
SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd $SCENARIO_DIR/manifests/kustomizations

# Push kustomizations
oras push "$OCI_REPOSITORY_BASE/reviews:v2.0.0" ./reviews-v2/ --artifact-type application/vnd.kustomize.config.v1+yaml