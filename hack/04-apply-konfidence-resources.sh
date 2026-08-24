#!/usr/bin/env bash
# Apply the initial Konfidence resources for the example app: a VectorTemplate
# (assembles the vector from the published artifacts) and a Stage (tells
# Konfidence to deliver it). Konfidence then reconciles everything else — this
# script does not deploy the app workloads itself.
#
# Prereqs: a cluster with Konfidence + Postgres (01), a local registry (02) and
# published artifacts (03).
#
# Env:
#   LANDSCAPE_NS  namespace for the Stage + workloads (default example-landscape)
#   REG_NAME      registry host the artifacts live under (default kind-registry)
set -euo pipefail

LANDSCAPE_NS="${LANDSCAPE_NS:-example-landscape}"
REG_NAME="${REG_NAME:-kind-registry}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Namespace + registry credentials"
kubectl create namespace "$LANDSCAPE_NS" --dry-run=client -o yaml | kubectl apply -f -

# Registry pull credentials, named after the (sanitized) registry host — the name
# Konfidence uses for the Secret referenced by the generated Flux sources and by
# the VectorTemplate/Stage. Local registry is anonymous, so a dummy secret works;
# production would hold real credentials.
echo "==> Registry credentials Secret '$REG_NAME'"
dockercfg="$(printf '{"auths":{"%s:5000":{"auth":"%s"}}}' "$REG_NAME" "$(printf 'x:x' | base64)")"
kubectl -n "$LANDSCAPE_NS" create secret generic "$REG_NAME" \
  --type=kubernetes.io/dockerconfigjson \
  --from-literal=.dockerconfigjson="$dockercfg" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Applying VectorTemplate"
kubectl apply -f "$ROOT/vector/vectortemplate.yaml"

echo "==> Waiting for the vector to be assembled"
vector=""
for _ in $(seq 1 60); do
  vector="$(kubectl -n "$LANDSCAPE_NS" get vectortemplate example-app \
    -o jsonpath='{.status.latestVector}' 2>/dev/null || true)"
  [ -n "$vector" ] && break
  sleep 2
done
[ -n "$vector" ] || { echo "VectorTemplate did not assemble a vector"; \
  kubectl -n "$LANDSCAPE_NS" get vectortemplate example-app -o yaml; exit 1; }

# The Stage references the concrete assembled vector. status.latestVector holds
# it (a version-less uploadTarget assembles a fresh, timestamped version each run).
echo "==> Applying Stage for vector $vector"
sed "s|__VECTOR__|$vector|" "$ROOT/vector/stage.yaml" | kubectl apply -f -

echo
echo "==> Done. Konfidence is reconciling the app. Inspect with:"
echo "  kubectl -n $LANDSCAPE_NS get vectortemplate,stage,vectordeployment,artifactdeployment,vectormigration"
echo "  kubectl -n $LANDSCAPE_NS get pods"
echo
echo "==> Once the pods are Running, try service-to-service (interviews -> candidates):"
cat <<'EOS'
  NS=example-landscape
  VID=$(kubectl -n "$NS" get vectordata -o jsonpath='{.items[0].metadata.name}')
  CA=$(kubectl -n "$NS" get svc -l app=candidates -o jsonpath='{.items[0].metadata.name}')
  IV=$(kubectl -n "$NS" get svc -l app.kubernetes.io/name=interviews -o jsonpath='{.items[0].metadata.name}')

  kubectl -n "$NS" port-forward "svc/$CA" 8081:80 >/dev/null 2>&1 &
  kubectl -n "$NS" port-forward "svc/$IV" 8080:80 >/dev/null 2>&1 &
  sleep 3

  # create a candidate on the candidates service
  CID=$(curl -s -X POST localhost:8081/candidates -H 'Content-Type: application/json' \
    -H "X-Vector-ID: $VID" -d '{"name":"Ada Lovelace","email":"ada@example.com"}' \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

  # fetch it THROUGH interviews: interviews resolves the candidates address from
  # the vector's deployment results (X-Vector-ID) and calls it service-to-service
  curl -s -H "X-Vector-ID: $VID" "localhost:8080/candidates/$CID"; echo
EOS
