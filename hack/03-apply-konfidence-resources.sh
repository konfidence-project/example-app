#!/usr/bin/env bash
# Apply the initial Konfidence resources for the example app: a VectorTemplate
# (assembles the vector from the published artifacts) and a StageConfiguration
# (tells Konfidence to deliver it). Konfidence then creates and reconciles
# everything else — this script does not deploy the app workloads itself.
#
# Prereqs: a cluster with Konfidence (01) and published artifacts (02).
#
#   REGISTRY=ghcr.io/my-org/example-app ./hack/03-apply-konfidence-resources.sh
#
# Env:
#   REGISTRY      (required) repository prefix the artifacts were published to
#   LANDSCAPE_NS  namespace for the Stage + workloads (default example-landscape)
set -euo pipefail

: "${REGISTRY:?set REGISTRY to the repo the artifacts were published to (same as step 02)}"
LANDSCAPE_NS="${LANDSCAPE_NS:-example-landscape}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Postgres + credentials"
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

# Konfidence pulls artifacts from the registry using an image-pull secret named
# after the (sanitized) registry host. Create it from your docker login.
reg_host="${REGISTRY%%/*}"
reg_domain="${reg_host%%:*}"
pull_secret="$(printf '%s' "$reg_domain" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g; s/^[^a-z0-9]*//')"
echo "==> Registry pull secret '$pull_secret'"
kubectl -n "$LANDSCAPE_NS" create secret generic "$pull_secret" \
  --type=kubernetes.io/dockerconfigjson \
  --from-file=.dockerconfigjson="$HOME/.docker/config.json" \
  --dry-run=client -o yaml | kubectl apply -f -

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "==> Applying VectorTemplate"
sed "s|\${REGISTRY}|$REGISTRY|g; s|example-landscape|$LANDSCAPE_NS|g" \
  "$ROOT/vector/vectortemplate.yaml" > "$work/vectortemplate.yaml"
kubectl apply -f "$work/vectortemplate.yaml"

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
sed "s|\${REGISTRY}|$REGISTRY|g; s|example-landscape|$LANDSCAPE_NS|g" \
  "$ROOT/vector/stage.yaml" > "$work/stage.yaml"
kubectl apply -f "$work/stage.yaml"

# Stopgap until deployment-result-based service discovery lands: interviews
# calls `candidates` by name, but Konfidence deploys the Service with a version
# suffix.
echo "==> Aliasing the candidates Service"
for _ in $(seq 1 60); do
  target="$(kubectl -n "$LANDSCAPE_NS" get svc -l app=candidates \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  [ -n "$target" ] && break
  sleep 2
done
if [ -n "$target" ]; then
  kubectl -n "$LANDSCAPE_NS" apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: candidates
spec:
  type: ExternalName
  externalName: $target.$LANDSCAPE_NS.svc.cluster.local
EOF
fi

echo
echo "==> Done. Konfidence is reconciling the app. Inspect with:"
echo "  kubectl -n $LANDSCAPE_NS get vectortemplate,stageconfiguration,stage,vectordeployment,artifactdeployment"
echo "  kubectl -n $LANDSCAPE_NS get pods"
