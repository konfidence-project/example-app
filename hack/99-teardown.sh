#!/usr/bin/env bash
# Tear down the local quickstart: remove the app, the local registry, and the
# kind cluster. Leaves you at a clean slate for a fresh 01 -> 04 run.
#
# Env:
#   CLUSTER       kind cluster name (default konfidence-local)
#   REG_NAME      local registry container name (default kind-registry)
#   REG_NETWORK   docker network the registry is on (default kind)
set -euo pipefail

CLUSTER="${CLUSTER:-konfidence-local}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REG_NAME="${REG_NAME:-kind-registry}"
export REG_NETWORK="${REG_NETWORK:-kind}"

# Remove registry/kden containers while the kind network still exists, then the cluster.
echo "Removing local registry (docker compose down)"
docker compose -f "$ROOT/hack/docker-compose.yaml" down --remove-orphans >/dev/null 2>&1 || true

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
  echo "Deleting kind cluster '$CLUSTER'"
  kind delete cluster --name "$CLUSTER"
fi

echo "Done."
