#!/usr/bin/env bash
# TEMPORARY: install Konfidence from local sibling checkouts instead of a
# release, because the required fixes are not in a Konfidence release yet.
#
# Use this INSTEAD of 01-setup-kind-cluster.sh while unreleased; the rest of the
# flow (02 -> 03 -> 04) is identical.
#
# TODO(public-release): delete this script once Konfidence cuts a release
# containing the fixes; 01-setup-kind-cluster.sh (official installer) is then the
# only setup step, and the platform provides the vector-data-service.
#
# Env:
#   CLUSTER          kind cluster name (default konfidence-local)
#   LANDSCAPE_NS     landscape namespace for the vector-data-service (default example-landscape)
#   KONFIDENCE_SRC   konfidence checkout (default ../konfidence)
#   KLO_SRC          kubernetes-landscape-orchestrator checkout (default ../kubernetes-landscape-orchestrator)
#   IMAGE_TAG        tag for the locally built images (default dev)
set -euo pipefail

CLUSTER="${CLUSTER:-konfidence-local}"
LANDSCAPE_NS="${LANDSCAPE_NS:-example-landscape}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KONFIDENCE_SRC="${KONFIDENCE_SRC:-$ROOT/../konfidence}"
KLO_SRC="${KLO_SRC:-$ROOT/../kubernetes-landscape-orchestrator}"
IMAGE_TAG="${IMAGE_TAG:-dev}"

for bin in docker kind kubectl helm go; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done
[ -d "$KONFIDENCE_SRC" ] || { echo "konfidence checkout not found at $KONFIDENCE_SRC (set KONFIDENCE_SRC)" >&2; exit 1; }
[ -d "$KLO_SRC" ] || { echo "klo checkout not found at $KLO_SRC (set KLO_SRC)" >&2; exit 1; }

echo "==> Creating kind cluster '$CLUSTER'"
if ! kind get clusters | grep -qx "$CLUSTER"; then
  # config_path lets 02 register the local registry as a plain-HTTP pull source
  kind create cluster --name "$CLUSTER" --wait 120s --config=- <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
containerdConfigPatches:
  - |-
    [plugins."io.containerd.grpc.v1.cri".registry]
      config_path = "/etc/containerd/certs.d"
EOF
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

# kden CLI image, built via compose from local source (see hack/docker-compose.yaml).
# 03 runs it via hack/kden on the kind network; the host needs no kden CLI.
# TODO(public-release): drop this; point the compose kden image at the release.
echo "==> Building kden image (docker compose)"
KONFIDENCE_SRC="$KONFIDENCE_SRC" docker compose -f "$ROOT/hack/docker-compose.yaml" build kden

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

# vector-data-service is per-landscape; a release would provision it (temp here).
echo "==> Installing vector-data-service into $LANDSCAPE_NS (local chart)"
kubectl create namespace "$LANDSCAPE_NS" --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install vector-data-service "$KLO_SRC/charts/vector-data-service" \
  --namespace "$LANDSCAPE_NS" \
  --set image.repository=vector-data-service --set image.tag="$IMAGE_TAG" \
  --wait

# Postgres: the app's out-of-band stateful dependency, provisioned at setup.
echo "==> Postgres + credentials"
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

echo
echo "==> Cluster '$CLUSTER' ready with Konfidence (built from local sources)."
echo "    Next: ./hack/02-setup-registry.sh"
