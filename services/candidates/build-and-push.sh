#!/usr/bin/env bash
# Build and publish the candidates service artifacts. Driven entirely by
# REGISTRY + VERSION (exported by hack/02-pipeline.sh, or set them yourself):
#   REGISTRY=ghcr.io/my-org/example-app VERSION=0.1.0-dev ./services/candidates/build-and-push.sh
set -euo pipefail

: "${REGISTRY:?set REGISTRY (no scheme)}"
: "${VERSION:?set VERSION}"
export REGISTRY VERSION   # kden expands ${REGISTRY}/${VERSION} in the constructor from the env
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SVC=candidates

# Generated manifests land in a gitignored dist/ so they can be inspected after a run.
DIST="$ROOT/dist"
rm -rf "$DIST"
mkdir -p "$DIST"

echo "==> [$SVC] building and pushing images"
docker build -t "$REGISTRY/$SVC:$VERSION" "$ROOT"
docker build -t "$REGISTRY/$SVC-migrations:$VERSION" "$ROOT/migrations"
docker push "$REGISTRY/$SVC:$VERSION"
docker push "$REGISTRY/$SVC-migrations:$VERSION"

# Flux deploys the kustomize bundle, so publish it with flux tooling (flux-native
# OCI media types). The image is remapped to the pushed tag via `kustomize edit`
# so the committed manifests stay registry/version-agnostic.
echo "==> [$SVC] publishing kustomize deployment artifact"
cp -r "$ROOT/manifests" "$DIST/manifests"
( cd "$DIST/manifests" && kustomize edit set image "$SVC=$REGISTRY/$SVC:$VERSION" )
flux push artifact "oci://$REGISTRY/$SVC-kustomization:$VERSION" \
  --path="$DIST/manifests" --source="$SVC" --revision="$VERSION"

# The OCM component ties the kustomization, migration tasks and images into one
# versioned Konfidence artifact. kden expands ${REGISTRY}/${VERSION} in the
# constructor itself (os.Expand/os.Getenv), but NOT in the file-input task
# manifests, so substitute those (leaves runtime args like $PGUSER untouched).
echo "==> [$SVC] pushing OCM component"
cp -r "$ROOT/ocm" "$DIST/ocm"
find "$DIST/ocm/tasks" -type f -name 'task-manifest.json' -print0 \
  | xargs -0 sed -i "s|\${REGISTRY}|$REGISTRY|g; s|\${VERSION}|$VERSION|g"
( cd "$DIST/ocm" && kden artifact push --registry "https://$REGISTRY" --file component-constructor.yaml )
