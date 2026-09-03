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

# kden/OCM resolve registry credentials from an OCM config that reuses your
# `docker login`. Use the committed hack/ocmconfig.yaml unless the caller already
# provides their own OCM_CONFIG (which then takes precedence).
export OCM_CONFIG="${OCM_CONFIG:-$ROOT/hack/ocmconfig.yaml}"

echo "==> Publishing example-app artifacts to $REGISTRY (version $VERSION)"
"$ROOT/services/candidates/build-and-push.sh"
"$ROOT/services/interviews/build-and-push.sh"
echo "==> Done. Published under $REGISTRY at version $VERSION."
