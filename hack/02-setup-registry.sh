#!/usr/bin/env bash
# Set up a local OCI registry and wire it into the kind cluster from 01, so the
# whole example can run on a laptop with no external registry.
#
# The registry is a plain `registry:2` container that lives NEXT TO the kind node
# (not inside it) but is attached to the same docker network, so a single name —
# kind-registry:5000 — resolves from both sides:
#   - from the host (push): via an /etc/hosts alias to 127.0.0.1 (published port)
#   - from the cluster (pull): via docker-network DNS
#
# It is served over TLS with a locally-trusted certificate (mkcert). TLS — rather
# than plain HTTP — is required because Konfidence rejects OCM descriptors without
# resource digests, and `ocm add` (in 03-pipeline.sh) computes those digests by
# resolving each imageReference from the host; the OCM CLI only talks HTTPS to a
# named host, so the registry must present a certificate the host trusts.
#
# Everything here is local-quickstart glue. A production deployment points at a
# real registry with a CA-signed certificate and needs none of it.
#
# Env:
#   CLUSTER    kind cluster name (default konfidence-local)
#   REG_NAME   registry container name / hostname (default kind-registry)
#   REG_PORT   registry port (default 5000)
set -euo pipefail

CLUSTER="${CLUSTER:-konfidence-local}"
REG_NAME="${REG_NAME:-kind-registry}"
REG_PORT="${REG_PORT:-5000}"
TLS_DIR="${TLS_DIR:-$HOME/.config/konfidence-local/tls}"

for bin in docker kind kubectl mkcert; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done
kind get clusters | grep -qx "$CLUSTER" || { echo "kind cluster '$CLUSTER' not found; run 01 first" >&2; exit 1; }
kubectl config use-context "kind-$CLUSTER" >/dev/null

# The docker network kind attaches its nodes to (usually "kind").
NET="$(docker inspect "${CLUSTER}-control-plane" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1)"
NET="${NET:-kind}"

echo "==> Trusting the local CA (mkcert)"
mkcert -install >/dev/null 2>&1 || true
CAROOT="$(mkcert -CAROOT)/rootCA.pem"

echo "==> Issuing a TLS certificate for $REG_NAME"
mkdir -p "$TLS_DIR"
if [ ! -s "$TLS_DIR/cert.pem" ] || ! openssl x509 -in "$TLS_DIR/cert.pem" -noout -checkhost "$REG_NAME" >/dev/null 2>&1; then
  ( cd "$TLS_DIR" && mkcert -cert-file cert.pem -key-file key.pem "$REG_NAME" localhost 127.0.0.1 >/dev/null 2>&1 )
fi

echo "==> Starting the registry container '$REG_NAME'"
if ! docker inspect "$REG_NAME" >/dev/null 2>&1; then
  docker run -d --restart=always --name "$REG_NAME" \
    -p "127.0.0.1:${REG_PORT}:5000" \
    -v "$TLS_DIR:/certs:ro" \
    -e REGISTRY_HTTP_TLS_CERTIFICATE=/certs/cert.pem \
    -e REGISTRY_HTTP_TLS_KEY=/certs/key.pem \
    registry:2 >/dev/null
fi
# Attach to the cluster's docker network so pods/nodes resolve $REG_NAME.
docker network connect "$NET" "$REG_NAME" 2>/dev/null || true

echo "==> Host name resolution (/etc/hosts: $REG_NAME -> 127.0.0.1)"
if ! grep -qE "^[^#]*[[:space:]]$REG_NAME(\$|[[:space:]])" /etc/hosts; then
  echo "    (needs sudo to add the alias)"
  echo "127.0.0.1 $REG_NAME" | sudo tee -a /etc/hosts >/dev/null
fi

echo "==> Registering the registry with containerd on every node"
for node in $(kind get nodes --name "$CLUSTER"); do
  docker exec "$node" mkdir -p "/etc/containerd/certs.d/${REG_NAME}:${REG_PORT}"
  # skip_verify: the node trusts the registry without importing the CA (local only).
  cat <<EOF | docker exec -i "$node" tee "/etc/containerd/certs.d/${REG_NAME}:${REG_PORT}/hosts.toml" >/dev/null
server = "https://${REG_NAME}:${REG_PORT}"
[host."https://${REG_NAME}:${REG_PORT}"]
  capabilities = ["pull", "resolve"]
  skip_verify = true
EOF
done

echo "==> Teaching the in-cluster controllers to trust the registry CA"
# Konfidence operator and Flux controllers fetch OCM/OCI artifacts in-process
# (Go TLS), so they need the CA. SSL_CERT_FILE points them at the mounted rootCA.
patch_ca() {
  local ns="$1" deploy="$2"
  kubectl -n "$ns" get deploy "$deploy" >/dev/null 2>&1 || { echo "    skip $ns/$deploy (not found)"; return; }
  kubectl -n "$ns" create configmap konfidence-local-ca \
    --from-file=rootCA.pem="$CAROOT" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  local cname; cname="$(kubectl -n "$ns" get deploy "$deploy" -o jsonpath='{.spec.template.spec.containers[0].name}')"
  kubectl -n "$ns" patch deployment "$deploy" --type=strategic -p "$(cat <<EOF
spec:
  template:
    spec:
      volumes:
        - name: konfidence-local-ca
          configMap:
            name: konfidence-local-ca
      containers:
        - name: $cname
          env:
            - name: SSL_CERT_FILE
              value: /etc/konfidence-local-ca/rootCA.pem
          volumeMounts:
            - name: konfidence-local-ca
              mountPath: /etc/konfidence-local-ca
              readOnly: true
EOF
)" >/dev/null
  kubectl -n "$ns" rollout status deploy "$deploy" --timeout=120s >/dev/null 2>&1 || true
  echo "    patched $ns/$deploy"
}
patch_ca konfidence-system konfidence
patch_ca flux-system source-controller
patch_ca flux-system helm-controller

echo
echo "==> Local registry ready: ${REG_NAME}:${REG_PORT} (TLS, trusted by host + cluster)"
echo "    Next: ./hack/03-pipeline.sh"
