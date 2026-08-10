#!/usr/bin/env bash
# Set up a local plain-HTTP OCI registry and wire it into the kind cluster from 01.
#
# The registry is a plain `registry:2` container next to the kind node, attached
# to the same docker network, so one name — kind-registry:5000 — resolves from
# both sides (host via /etc/hosts alias, cluster via docker-network DNS).
#
# NOTE: a plain-HTTP registry does NOT fully work with Konfidence today. It is
# scripted here to make the local flow reproducible and to document exactly where
# it breaks. See hack/README-HTTP.md for the blocker list. The TLS variant lives
# on the `local-registry-tls` branch.
#
# Env:
#   CLUSTER    kind cluster name (default konfidence-local)
#   REG_NAME   registry container name / hostname (default kind-registry)
#   REG_PORT   registry port (default 5000)
set -euo pipefail

CLUSTER="${CLUSTER:-konfidence-local}"
REG_NAME="${REG_NAME:-kind-registry}"
REG_PORT="${REG_PORT:-5000}"

for bin in docker kind kubectl; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done
kind get clusters | grep -qx "$CLUSTER" || { echo "kind cluster '$CLUSTER' not found; run 01 first" >&2; exit 1; }

NET="$(docker inspect "${CLUSTER}-control-plane" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1)"
NET="${NET:-kind}"

echo "==> Starting the plain-HTTP registry container '$REG_NAME'"
if ! docker inspect "$REG_NAME" >/dev/null 2>&1; then
  docker run -d --restart=always --name "$REG_NAME" \
    -p "127.0.0.1:${REG_PORT}:5000" \
    registry:2 >/dev/null
fi
docker network connect "$NET" "$REG_NAME" 2>/dev/null || true

echo "==> Host name resolution (/etc/hosts: $REG_NAME -> 127.0.0.1)"
if ! grep -qE "^[^#]*[[:space:]]$REG_NAME(\$|[[:space:]])" /etc/hosts; then
  echo "    (needs sudo to add the alias)"
  echo "127.0.0.1 $REG_NAME" | sudo tee -a /etc/hosts >/dev/null
fi

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
echo "    Blockers with HTTP are documented in hack/README-HTTP.md"
echo "    Next: ./hack/03-pipeline.sh"
