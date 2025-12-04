#!/bin/bash
set -e

OCI_REPOSITORY_BASE="konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations"

# Navigate to scenario-1 kustomizations
SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd $SCENARIO_DIR/manifests/kustomizations

# Push kustomizations
oras push "$OCI_REPOSITORY_BASE/mysqldb:v1.0.0" ./mysqldb-v1/ --artifact-type application/vnd.kustomize.config.v1+yaml
oras push "$OCI_REPOSITORY_BASE/ratings:v2.0.0" ./ratings-v2-mysql/ --artifact-type application/vnd.kustomize.config.v1+yaml