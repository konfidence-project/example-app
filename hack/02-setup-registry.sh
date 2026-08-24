#!/usr/bin/env bash
# Start the local plain-HTTP registry (docker compose) and tell containerd on
# every kind node to pull kind-registry:5000 over plain HTTP.
#
# Env:
#   CLUSTER     kind cluster name (default konfidence-local)
#   REG_NAME    registry container name / hostname (default kind-registry)
#   REG_PORT    registry port (default 5000)
#   REG_NETWORK docker network the kind nodes are on (default kind)
set -euo pipefail

CLUSTER="${CLUSTER:-konfidence-local}"
REG_NAME="${REG_NAME:-kind-registry}"
REG_PORT="${REG_PORT:-5000}"
REG_NETWORK="${REG_NETWORK:-kind}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REG_NAME REG_PORT REG_NETWORK

for bin in docker kind kubectl; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done
kind get clusters | grep -qx "$CLUSTER" || { echo "kind cluster '$CLUSTER' not found; run 01 first" >&2; exit 1; }

echo "==> Starting the plain-HTTP registry (docker compose)"
docker compose -f "$ROOT/hack/docker-compose.yaml" up -d registry

echo "==> Registering the registry with containerd on every node (plain HTTP)"
for node in $(kind get nodes --name "$CLUSTER"); do
  docker exec "$node" mkdir -p "/etc/containerd/certs.d/${REG_NAME}:${REG_PORT}"
  cat <<EOF | docker exec -i "$node" tee "/etc/containerd/certs.d/${REG_NAME}:${REG_PORT}/hosts.toml" >/dev/null
server = "http://${REG_NAME}:${REG_PORT}"
[host."http://${REG_NAME}:${REG_PORT}"]
  capabilities = ["pull", "resolve"]
EOF
done

echo
echo "==> Local plain-HTTP registry ready: ${REG_NAME}:${REG_PORT}"
echo "    Next: ./hack/03-pipeline.sh"
