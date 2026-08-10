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
# Env:
#   CLUSTER             kind cluster name (default konfidence-local)
#   KONFIDENCE_VERSION  version passed to the installer (default 0.0.1-alpha.1)
#
# TODO(public-release): once Konfidence is public and cutting releases:
#   - default KONFIDENCE_VERSION to the latest release instead of pinning
#     0.0.1-alpha.1 (e.g. resolve the latest tag, or let the installer default).
#   - the installer is fetched from the `main` branch; consider pinning to a
#     released tag for reproducibility.
set -euo pipefail

CLUSTER="${CLUSTER:-konfidence-local}"
# TODO(public-release): drop the hardcoded alpha default; use the latest release.
KONFIDENCE_VERSION="${KONFIDENCE_VERSION:-0.0.1-alpha.1}"
INSTALL_URL="https://raw.githubusercontent.com/konfidence-project/konfidence/main/hack/quickstart/install.sh"

for bin in docker kind kubectl helm; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done

echo "==> Creating kind cluster '$CLUSTER'"
if ! kind get clusters | grep -qx "$CLUSTER"; then
  # containerd config_path lets 02-setup-registry.sh register the local registry
  # (kind-registry:5000) as a pull source via a per-host hosts.toml drop-in.
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

echo
echo "==> Cluster '$CLUSTER' ready with Konfidence."
echo "    Next: ./hack/02-setup-registry.sh"
