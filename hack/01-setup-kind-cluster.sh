#!/usr/bin/env bash
# Create a local kind cluster with Konfidence installed, for trying the example
# app end to end on a laptop. Cluster creation is ours; the Konfidence install
# is delegated to the official quickstart installer from the konfidence repo.
#
# Run order for the full local quickstart:
#   01-setup-kind-cluster.sh   # this script: kind cluster + Konfidence
#   02-setup-registry.sh       # local OCI registry wired into the cluster
#   03-pipeline.sh             # build + publish the app artifacts (CI does this)
#   04-apply-konfidence-resources.sh   # apply the Konfidence resources
#
# NOTE: until the required fixes are in a Konfidence release, use
# 01_temp_from_local.sh instead of this script — it builds Konfidence from local
# checkouts. Once released, that temp script goes away and this is the only setup.
#
# Env:
#   CLUSTER             kind cluster name (default konfidence-local)
#   KONFIDENCE_VERSION  version passed to the installer (default 0.0.1-alpha.1)
#
# TODO(public-release): default KONFIDENCE_VERSION to the latest release instead
# of pinning, and pin the installer URL to a released tag for reproducibility.
set -euo pipefail

CLUSTER="${CLUSTER:-konfidence-local}"
LANDSCAPE_NS="${LANDSCAPE_NS:-example-landscape}"
KONFIDENCE_VERSION="${KONFIDENCE_VERSION:-0.0.1-alpha.1}"
INSTALL_URL="https://raw.githubusercontent.com/konfidence-project/konfidence/main/hack/quickstart/install.sh"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for bin in docker kind kubectl helm; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done

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

echo "==> Installing Konfidence (official quickstart installer)"
curl -fsSL "$INSTALL_URL" | KONFIDENCE_VERSION="$KONFIDENCE_VERSION" sh

# Postgres: the app's out-of-band stateful dependency, provisioned at setup.
echo "==> Postgres + credentials"
kubectl apply -f "$ROOT/hack/postgres.yaml"
kubectl -n example-app-db rollout status statefulset/postgres --timeout=120s
kubectl create namespace "$LANDSCAPE_NS" --dry-run=client -o yaml | kubectl apply -f -
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
echo "==> Cluster '$CLUSTER' ready with Konfidence."
echo "    Next: ./hack/02-setup-registry.sh"
