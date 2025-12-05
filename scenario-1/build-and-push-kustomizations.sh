#!/bin/bash
set -e

OCI_REPOSITORY_BASE="konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations"

# Navigate to scenario-1 kustomizations
SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd $SCENARIO_DIR/manifests/kustomizations

# Push kustomizations
oras push "$OCI_REPOSITORY_BASE/productpage:v1.0.0" ./productpage-v1/ --artifact-type application/vnd.kustomize.config.v1+yaml
oras push "$OCI_REPOSITORY_BASE/details:v1.0.0" ./details-v1/ --artifact-type application/vnd.kustomize.config.v1+yaml
oras push "$OCI_REPOSITORY_BASE/reviews:v1.0.0" ./reviews-v1/ --artifact-type application/vnd.kustomize.config.v1+yaml