#!/usr/bin/env bash
# Apply the initial Konfidence resources for the example app: a VectorTemplate
# (assembles the vector from the published artifacts) and a StageConfiguration
# (tells Konfidence to deliver it). Konfidence then reconciles everything else —
# this script does not deploy the app workloads itself.
#
# Prereqs: a cluster with Konfidence (01), a local registry (02) and published
# artifacts (03).
#
# Env:
#   LANDSCAPE_NS  namespace for the Stage + workloads (default example-landscape)
#   REG_NAME      registry host the artifacts live under (default kind-registry)
set -euo pipefail

LANDSCAPE_NS="${LANDSCAPE_NS:-example-landscape}"
REG_NAME="${REG_NAME:-kind-registry}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Namespace + Postgres + credentials"
kubectl create namespace "$LANDSCAPE_NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f "$ROOT/hack/postgres.yaml"
kubectl -n example-app-db rollout status statefulset/postgres --timeout=120s
kubectl -n "$LANDSCAPE_NS" apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: example-app-db-credentials
type: Opaque
stringData:
  PGHOST: postgres.example-app-db.svc.cluster.local
  PGPORT: "5432"
  PGUSER: example
  PGPASSWORD: example
  PGDATABASE: example
  PGSSLMODE: disable
EOF

# Registry credentials. The Secret is named after the (sanitized) registry host,
# because that is the name Konfidence gives the pull Secret it references from the
# generated Flux OCIRepository/HelmRepository. The VectorTemplate and
# StageConfiguration also reference it by name for the operator's own OCM fetch.
# The local registry is anonymous, so dummy credentials suffice; a production
# deployment puts real registry credentials here.
echo "==> Registry credentials Secret '$REG_NAME'"
dockercfg="$(printf '{"auths":{"%s:5000":{"auth":"%s"}}}' "$REG_NAME" "$(printf 'x:x' | base64)")"
kubectl -n "$LANDSCAPE_NS" create secret generic "$REG_NAME" \
  --type=kubernetes.io/dockerconfigjson \
  --from-literal=.dockerconfigjson="$dockercfg" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying VectorTemplate"
kubectl apply -f "$ROOT/vector/vectortemplate.yaml"

echo "==> Waiting for the vector to be assembled"
for _ in $(seq 1 60); do
  ready="$(kubectl -n "$LANDSCAPE_NS" get vectortemplate example-app \
    -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || true)"
  [ "$ready" = "True" ] && break
  sleep 2
done
[ "$ready" = "True" ] || { echo "VectorTemplate did not become Ready"; \
  kubectl -n "$LANDSCAPE_NS" get vectortemplate example-app -o yaml; exit 1; }

echo "==> Applying StageConfiguration"
kubectl apply -f "$ROOT/vector/stage.yaml"

echo
echo "==> Done. Konfidence is reconciling the app. Inspect with:"
echo "  kubectl -n $LANDSCAPE_NS get vectortemplate,stageconfiguration,stage,vectordeployment,artifactdeployment"
echo "  kubectl -n $LANDSCAPE_NS get pods"
