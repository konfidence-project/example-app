#!/usr/bin/env bash
# Apply the runtime Konfidence resources for the example app. The Project,
# Landscape, credentials and vector-data-service are set up in step 01; this
# step deploys the app:
#   VectorTemplate         assembles the vector from the published artifacts
#   Stage (empty)          target the promotion fills in
#   VectorPromotionConfig  promotes the template's vector into the Stage
# Konfidence then reconciles the deployment.
#
#   REGISTRY=my-registry.example.com/my-org/example-app ./hack/03-apply-konfidence-resources.sh
set -euo pipefail

: "${REGISTRY:?set REGISTRY to the repo the artifacts were published to (same as step 02)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/hack/_common.sh"

project_ns="$(kubectl get project example-app -o jsonpath='{.status.namespace}')"
managed_ns="$(kubectl -n "$project_ns" get landscape example-app -o jsonpath='{.status.namespace}')"
[ -n "$project_ns" ] && [ -n "$managed_ns" ] || {
  echo "Project/Landscape not ready — run ./hack/01-setup-kind-cluster.sh first" >&2; exit 1; }
echo "==> project ns: $project_ns   managed ns: $managed_ns"

echo "==> VectorTemplate (project ns)"
sed "s|\${REGISTRY}|$REGISTRY|g" "$ROOT/konfidence/vectortemplate.yaml" \
  | kubectl -n "$project_ns" apply -f -

echo "==> Stage (managed ns) + VectorPromotionConfig (project ns)"
kubectl -n "$managed_ns" apply -f "$ROOT/konfidence/stage.yaml"
kubectl -n "$project_ns" apply -f "$ROOT/konfidence/vectorpromotionconfig.yaml"

echo
echo "==> Done. Konfidence assembles the vector, promotes it into the Stage, and deploys. Inspect with:"
echo "  kubectl -n $project_ns get vectortemplate,vectorpromotion"
echo "  kubectl -n $managed_ns get stage,vectordeployment,artifactdeployment,vectormigration,pods"
echo
echo "==> Once the pods are Running, try service-to-service (interviews -> candidates):"
cat <<EOS
  NS=$managed_ns
  VID=\$(kubectl -n "\$NS" get vectordata -o jsonpath='{.items[0].metadata.name}')
  CA=\$(kubectl -n "\$NS" get svc -l app=candidates -o jsonpath='{.items[0].metadata.name}')
  IV=\$(kubectl -n "\$NS" get svc -l app.kubernetes.io/name=interviews -o jsonpath='{.items[0].metadata.name}')
  kubectl -n "\$NS" port-forward "svc/\$CA" 8081:80 >/dev/null 2>&1 &
  kubectl -n "\$NS" port-forward "svc/\$IV" 8080:80 >/dev/null 2>&1 &
  sleep 3
  CID=\$(curl -s -X POST localhost:8081/candidates -H 'Content-Type: application/json' \\
    -H "X-Vector-ID: \$VID" -d '{"name":"Ada Lovelace","email":"ada@example.com"}' \\
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
  curl -s -H "X-Vector-ID: \$VID" "localhost:8080/candidates/\$CID"; echo
EOS
