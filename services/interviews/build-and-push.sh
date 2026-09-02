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

echo "==> [$SVC] building and pushing images"
docker build -t "$REGISTRY/$SVC:$VERSION" "$ROOT"
docker build -t "$REGISTRY/$SVC-migrations:$VERSION" "$ROOT/migrations"
docker push "$REGISTRY/$SVC:$VERSION"
docker push "$REGISTRY/$SVC-migrations:$VERSION"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Flux deploys the Helm chart, so publish it as an OCI chart. Chart version is
# set from VERSION here; the image ref in values.yaml is filled from ${REGISTRY}/
# ${VERSION} so the committed chart stays registry/version-agnostic.
echo "==> [$SVC] publishing Helm chart"
cp -r "$ROOT/chart" "$work/chart"
sed -i "s|\${REGISTRY}|$REGISTRY|g; s|\${VERSION}|$VERSION|g" "$work/chart/values.yaml"
helm package "$work/chart" --version "$VERSION" --app-version "$VERSION" --destination "$work" >/dev/null
helm push "$work/$SVC-chart-$VERSION.tgz" "oci://$REGISTRY"

# The OCM component ties the chart, migration tasks and images into one versioned
# Konfidence artifact. kden expands ${REGISTRY}/${VERSION} in the constructor
# itself (os.Expand/os.Getenv), but NOT in the file-input task manifests, so
# substitute those (leaves runtime args like $PGUSER untouched).
echo "==> [$SVC] pushing OCM component"
cp -r "$ROOT/ocm" "$work/ocm"
find "$work/ocm/tasks" -type f -name 'task-manifest.json' -print0 \
  | xargs -0 sed -i "s|\${REGISTRY}|$REGISTRY|g; s|\${VERSION}|$VERSION|g"
( cd "$work/ocm" && kden artifact push --registry "https://$REGISTRY" --file component-constructor.yaml )
