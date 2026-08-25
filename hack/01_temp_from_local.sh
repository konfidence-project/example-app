#!/usr/bin/env bash
# TEMPORARY: install Konfidence from local sibling checkouts, because the
# required fixes are not in a Konfidence release yet. Use this instead of
# 01-setup-kind-cluster.sh while unreleased; 02 -> 03 are unchanged.
#
# Sets up the static resources: cluster, Konfidence, registry credentials,
# Project, Landscape and (temporarily) the vector-data-service. Step 03 then
# deploys the app.
#
# TODO(public-release): delete this script once Konfidence cuts a release with
# the fixes; 01-setup-kind-cluster.sh (official installer) is then the only setup
# step and the platform provides the vector-data-service.
#
# Env:
#   REGISTRY            (required) registry repo prefix the artifacts go to (same as 02)
#   REGISTRY_USERNAME   registry user (prompted if unset)
#   REGISTRY_PASSWORD   registry password/token (prompted if unset)
#   CLUSTER             kind cluster name (default konfidence-example)
#   KONFIDENCE_SRC      konfidence checkout (default ../konfidence)
#   KLO_SRC             kubernetes-landscape-orchestrator checkout (default ../kubernetes-landscape-orchestrator)
#   IMAGE_TAG           tag for the locally built images (default dev)
set -euo pipefail

: "${REGISTRY:?set REGISTRY to the repo the artifacts will be published to (same as step 02)}"
CLUSTER="${CLUSTER:-konfidence-example}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KONFIDENCE_SRC="${KONFIDENCE_SRC:-$ROOT/../konfidence}"
KLO_SRC="${KLO_SRC:-$ROOT/../kubernetes-landscape-orchestrator}"
IMAGE_TAG="${IMAGE_TAG:-dev}"
source "$ROOT/hack/_common.sh"

for bin in docker kind kubectl helm go; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done
[ -d "$KONFIDENCE_SRC" ] || { echo "konfidence checkout not found at $KONFIDENCE_SRC (set KONFIDENCE_SRC)" >&2; exit 1; }
[ -d "$KLO_SRC" ] || { echo "klo checkout not found at $KLO_SRC (set KLO_SRC)" >&2; exit 1; }

echo "==> Creating kind cluster '$CLUSTER'"
if ! kind get clusters | grep -qx "$CLUSTER"; then
  kind create cluster --name "$CLUSTER" --wait 120s
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

# build_load <src> <name/OPERATOR_NAME> <go-pkg> <image>: build a linux binary +
# image from the repo's Dockerfile and load it into kind. Temp build context so
# the repo's .dockerignore doesn't exclude bin/.
build_load() {
  local src="$1" name="$2" pkg="$3" img="$4" ctx
  echo "==> Building $img from $src"
  ( cd "$src" && GOFLAGS=-mod=mod GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o "bin/$name" "$pkg" )
  git -C "$src" checkout -- go.mod go.sum 2>/dev/null || true
  ctx="$(mktemp -d)"
  mkdir -p "$ctx/bin"
  cp "$src/bin/$name" "$ctx/bin/$name"
  cp "$src/Dockerfile" "$ctx/Dockerfile"
  docker build -q -f "$ctx/Dockerfile" \
    --build-arg TARGETPLATFORM=bin --build-arg OPERATOR_NAME="$name" \
    -t "$img" "$ctx" >/dev/null
  rm -rf "$ctx"
  kind load docker-image "$img" --name "$CLUSTER"
}

echo "==> Installing cluster prerequisites (Gateway API, Flux)"
kubectl apply --server-side -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.1/standard-install.yaml
kubectl apply -f https://github.com/fluxcd/flux2/releases/latest/download/install.yaml
kubectl -n flux-system wait deployment/source-controller --for=condition=Available --timeout=600s

build_load "$KONFIDENCE_SRC" konfidence ./cmd/konfidence "konfidence:$IMAGE_TAG"
build_load "$KLO_SRC" landscape-orchestrator . "landscape-orchestrator:$IMAGE_TAG"
build_load "$KLO_SRC" vector-data-service ./cmd/vectordata "vector-data-service:$IMAGE_TAG"

# The vectordeployment controller reads registry-credentials in konfidence-system
# once at startup, so it must exist before the operator install.
echo "==> Registry credentials (konfidence-system) + Flux auth mapping"
ensure_credentials "$REGISTRY" konfidence-system
ensure_flux_auth_configmap "$REGISTRY"

echo "==> Installing Konfidence operator (local chart)"
helm upgrade --install konfidence "$KONFIDENCE_SRC/charts/konfidence" \
  --namespace konfidence-system --create-namespace \
  --set image.repository=konfidence --set image.tag="$IMAGE_TAG" \
  --set api.enabled=false --set webhook.enabled=false \
  --wait

echo "==> Installing kubernetes-landscape-orchestrator (local chart)"
helm upgrade --install kubernetes-landscape-orchestrator "$KLO_SRC/charts/kubernetes-landscape-orchestrator" \
  --namespace konfidence-system \
  --set image.repository=landscape-orchestrator --set image.tag="$IMAGE_TAG" \
  --wait

echo "==> Project + Landscape"
project_ns="$(apply_project "$ROOT")"
managed_ns="$(apply_landscape "$ROOT" "$project_ns")"
echo "    project ns: $project_ns   managed ns: $managed_ns"

echo "==> Registry credentials (project + managed ns)"
ensure_credentials "$REGISTRY" "$project_ns" "$managed_ns"
add_pull_secret_to_default_sa "$managed_ns"

echo "==> Postgres (out-of-band app database)"
deploy_postgres "$ROOT" "$managed_ns"

install_vds_local "$KLO_SRC" "$managed_ns" "$IMAGE_TAG"

echo
echo "==> Cluster '$CLUSTER' ready with Konfidence (built from local sources)."
echo "    Next: REGISTRY=$REGISTRY ./hack/02-pipeline.sh"
