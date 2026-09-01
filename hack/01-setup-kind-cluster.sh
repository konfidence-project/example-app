#!/usr/bin/env bash
# Create a local kind cluster with Konfidence installed and set up the static
# resources (credentials, Project, Landscape) for the example app. Cluster
# creation is ours; the Konfidence install is delegated to the official
# quickstart installer. Step 03 then deploys the app.
#
# NOTE: until the required fixes are in a Konfidence release, use
# 01_temp_from_local.sh instead — it builds Konfidence from local checkouts.
# Once released, that temp script goes away and this is the only setup step.
#
# Env:
#   REGISTRY            (required) registry repo prefix the artifacts go to (same as 02)
#   REGISTRY_USERNAME   registry user (prompted if unset)
#   REGISTRY_PASSWORD   registry password/token (prompted if unset)
#   CLUSTER             kind cluster name (default konfidence-example)
#   KONFIDENCE_VERSION  version passed to the installer (default 0.0.1-alpha.1)
#
# TODO(public-release): once Konfidence is public and cutting releases:
#   - default KONFIDENCE_VERSION to the latest release instead of pinning
#     0.0.1-alpha.1 (e.g. resolve the latest tag, or let the installer default).
#   - the installer is fetched from `main`; consider pinning to a released tag.
#   - the konfidence charts/images are private today, so `curl | sh` 404s until
#     the repo is public; no change needed here once it is.
#   - the platform provisions the vector-data-service per landscape.
set -euo pipefail

: "${REGISTRY:?set REGISTRY to the repo the artifacts will be published to (same as step 02)}"
CLUSTER="${CLUSTER:-konfidence-example}"
# TODO(public-release): drop the hardcoded alpha default; use the latest release.
KONFIDENCE_VERSION="${KONFIDENCE_VERSION:-0.0.1-alpha.1}"
# TODO(public-release): consider a tagged installer URL instead of `main`.
INSTALL_URL="https://raw.githubusercontent.com/konfidence-project/konfidence/main/hack/quickstart/install.sh"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/hack/_common.sh"

for bin in kind kubectl helm; do
  command -v "$bin" >/dev/null || { echo "missing dependency: $bin" >&2; exit 1; }
done

echo "==> Creating kind cluster '$CLUSTER'"
if ! kind get clusters | grep -qx "$CLUSTER"; then
  kind create cluster --name "$CLUSTER" --wait 120s
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

echo "==> Installing Konfidence (official quickstart installer)"
curl -fsSL "$INSTALL_URL" | KONFIDENCE_VERSION="$KONFIDENCE_VERSION" sh

# The controller reads registry-credentials in konfidence-system at startup, so
# create it and the Flux auth mapping, then restart the controller to pick it up.
echo "==> Registry credentials (konfidence-system) + Flux auth mapping"
ensure_credentials "$REGISTRY" konfidence-system
ensure_flux_auth_configmap "$REGISTRY"
kubectl -n konfidence-system rollout restart deployment
kubectl -n konfidence-system rollout status deployment --timeout=180s

echo "==> Project + Landscape"
project_ns="$(apply_project "$ROOT")"
managed_ns="$(apply_landscape "$ROOT" "$project_ns")"
echo "    project ns: $project_ns   managed ns: $managed_ns"

echo "==> Registry credentials (project + managed ns)"
ensure_credentials "$REGISTRY" "$project_ns" "$managed_ns"
add_pull_secret_to_default_sa "$managed_ns"

echo "==> Postgres (out-of-band app database)"
deploy_postgres "$ROOT" "$managed_ns"

echo
echo "==> Cluster '$CLUSTER' ready with Konfidence."
echo "    Next: REGISTRY=$REGISTRY ./hack/02-pipeline.sh"
