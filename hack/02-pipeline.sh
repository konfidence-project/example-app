#!/usr/bin/env bash
# Build and publish artifacts for every example-app service.
#
#   REGISTRY=ghcr.io/my-org/example-app ./hack/02-pipeline.sh
#
# See the service build-and-push.sh scripts for supported environment variables.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT/services/candidates/build-and-push.sh"
"$ROOT/services/interviews/build-and-push.sh"

echo "==> Done. All service artifacts published."
echo "    Next: REGISTRY=$REGISTRY ./hack/03-apply-konfidence-resources.sh"
