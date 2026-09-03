#!/usr/bin/env bash
# Tear down the demo by deleting the kind cluster created in step 01.
#
#   CLUSTER   kind cluster name (default konfidence-example; match step 01)
set -euo pipefail

CLUSTER="${CLUSTER:-konfidence-example}"

echo "==> Deleting kind cluster '$CLUSTER'"
kind delete cluster --name "$CLUSTER"
echo "Done."
