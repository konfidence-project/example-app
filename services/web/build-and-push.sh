#!/usr/bin/env bash
# Build and publish the web UI artifacts. Driven entirely by REGISTRY + VERSION
# (exported by hack/local-dev/02-pipeline.sh, or set them yourself):
#   REGISTRY=ghcr.io/my-org/example-app VERSION=0.1.0-dev ./services/web/build-and-push.sh
set -euo pipefail

: "${REGISTRY:?set REGISTRY (no scheme)}"
: "${VERSION:?set VERSION}"
export REGISTRY VERSION   # kden expands ${REGISTRY}/${VERSION} in the constructor from the env
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SVC=web
# Quickstart clusters run on amd64 and arm64 (Apple Silicon) hosts.
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

# Generated manifests land in a gitignored dist/ so they can be inspected after a run.
DIST="$ROOT/dist"
rm -rf "$DIST"
mkdir -p "$DIST"

echo "==> [$SVC] building and pushing image for $PLATFORMS"
docker buildx build --platform "$PLATFORMS" --push -t "$REGISTRY/$SVC:$VERSION" "$ROOT"

# web has no database, so unlike candidates it ships no migration image or tasks.
echo "==> [$SVC] publishing kustomize deployment artifact"
cp -r "$ROOT/manifests" "$DIST/manifests"
( cd "$DIST/manifests" && kustomize edit set image "$SVC=$REGISTRY/$SVC:$VERSION" )
flux push artifact "oci://$REGISTRY/$SVC-kustomization:$VERSION" \
  --path="$DIST/manifests" --source="$SVC" --revision="$VERSION"

echo "==> [$SVC] pushing OCM component"
cp -r "$ROOT/ocm" "$DIST/ocm"
( cd "$DIST/ocm" && kden artifact push --registry "https://$REGISTRY" --file component-constructor.yaml )

# Move the floating `edge` alias to this version. The VectorTemplate references
# :edge, so the controller re-resolves it and rolls out a new vector once edge
# points at a different component version.
echo "==> [$SVC] moving edge alias -> $VERSION"
kden artifact alias "https://$REGISTRY//github.com/konfidence-project/example-app/$SVC:$VERSION" edge
