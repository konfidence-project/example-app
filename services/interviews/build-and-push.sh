#!/usr/bin/env bash
# Build and publish the interviews service artifacts. Driven entirely by
# REGISTRY + VERSION (exported by hack/02-pipeline.sh, or set them yourself):
#   REGISTRY=ghcr.io/my-org/example-app VERSION=0.1.0-dev ./services/interviews/build-and-push.sh
set -euo pipefail

: "${REGISTRY:?set REGISTRY (no scheme)}"
: "${VERSION:?set VERSION}"
export REGISTRY VERSION   # kden expands ${REGISTRY}/${VERSION} in the constructor from the env
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SVC=interviews

# Portable in-place substitution of ${REGISTRY}/${VERSION} (avoids `sed -i`,
# which differs between GNU and BSD/macOS).
render() {
  local tmp
  tmp="$(mktemp)"
  sed "s|\${REGISTRY}|$REGISTRY|g; s|\${VERSION}|$VERSION|g" "$1" > "$tmp" && mv "$tmp" "$1"
}

# Generated manifests land in a gitignored dist/ so they can be inspected after a run.
DIST="$ROOT/dist"
rm -rf "$DIST"
mkdir -p "$DIST"

echo "==> [$SVC] building and pushing images"
docker build -t "$REGISTRY/$SVC:$VERSION" "$ROOT"
docker build -t "$REGISTRY/$SVC-migrations:$VERSION" "$ROOT/migrations"
docker push "$REGISTRY/$SVC:$VERSION"
docker push "$REGISTRY/$SVC-migrations:$VERSION"

# Flux deploys the Helm chart, so publish it as an OCI chart. The chart/app
# version come from VERSION (the image tag defaults to .Chart.AppVersion); only
# the registry is filled into values.yaml, so the committed chart stays
# registry/version-agnostic.
echo "==> [$SVC] publishing Helm chart"
cp -r "$ROOT/chart" "$DIST/chart"
render "$DIST/chart/values.yaml"
helm package "$DIST/chart" --version "$VERSION" --app-version "$VERSION" --destination "$DIST" >/dev/null
helm push "$DIST/$SVC-chart-$VERSION.tgz" "oci://$REGISTRY"

# The OCM component ties the chart, migration tasks and images into one versioned
# Konfidence artifact. kden expands ${REGISTRY}/${VERSION} in the constructor
# itself (os.Expand/os.Getenv), but NOT in the file-input task manifests, so
# substitute those (leaves runtime args like $PGUSER untouched).
echo "==> [$SVC] pushing OCM component"
cp -r "$ROOT/ocm" "$DIST/ocm"
find "$DIST/ocm/tasks" -type f -name 'task-manifest.json' -print0 \
  | while IFS= read -r -d '' f; do render "$f"; done
( cd "$DIST/ocm" && kden artifact push --registry "https://$REGISTRY" --file component-constructor.yaml )

# Move the floating `edge` alias to this version. The VectorTemplate references
# :edge, so the controller re-resolves it and rolls out a new vector once edge
# points at a different component version.
echo "==> [$SVC] moving edge alias -> $VERSION"
kden artifact alias "https://$REGISTRY//github.com/konfidence-project/example-app/$SVC:$VERSION" edge
