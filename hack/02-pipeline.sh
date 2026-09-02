#!/usr/bin/env bash
# Build and publish every example-app service artifact (container images,
# kustomize/helm deployment artifacts, OCM components) to an OCI registry.
#
# Two variables drive everything — nothing else is hardcoded:
#   REGISTRY  (required) repository prefix, no scheme, e.g. ghcr.io/my-org/example-app
#   VERSION   (optional) artifact version; defaults to a unique git-derived
#             SemVer prerelease (0.1.0-<shortsha>). kden has no overwrite, so a
#             unique version keeps re-runs idempotent.
#
# Runs the same locally and in CI:
#   docker login <registry-host>
#   REGISTRY=ghcr.io/my-org/example-app ./hack/02-pipeline.sh
set -euo pipefail

: "${REGISTRY:?set REGISTRY, e.g. ghcr.io/my-org/example-app (no scheme, no trailing slash)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export REGISTRY
export VERSION="${VERSION:-0.1.0-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)}"

# kden/OCM resolve registry credentials from an OCM config. Point it at the
# Docker config that `docker login` (local) or docker/login-action (CI) already
# wrote. Kept in a temp file exported via OCM_CONFIG so we never touch the
# user's ~/.ocmconfig.
OCM_CONFIG="$(mktemp)"
export OCM_CONFIG
trap 'rm -f "$OCM_CONFIG"' EXIT
cat > "$OCM_CONFIG" <<EOF
type: generic.config.ocm.software/v1
configurations:
  - type: credentials.config.ocm.software
    repositories:
      - repository:
          type: DockerConfig/v1
          dockerConfigFile: "${DOCKER_CONFIG:-$HOME/.docker}/config.json"
          propagateConsumerIdentity: true
EOF

echo "==> Publishing example-app artifacts to $REGISTRY (version $VERSION)"
"$ROOT/services/candidates/build-and-push.sh"
"$ROOT/services/interviews/build-and-push.sh"
echo "==> Done. Published under $REGISTRY at version $VERSION."
