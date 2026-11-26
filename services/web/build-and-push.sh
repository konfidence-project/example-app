#!/usr/bin/env bash
# Build and publish the web frontend artifacts. Driven entirely by
# REGISTRY + VERSION (exported by hack/local-dev/02-pipeline.sh, or set them yourself):
#   REGISTRY=ghcr.io/my-org/example-app VERSION=0.1.0-dev ./services/web/build-and-push.sh
#
# One `next build` produces both OCM components, so they always come from the
# same build and carry the same version:
#   web         the server: image and Helm chart (helm.konfidence.cloud)
#   web-static  the browser files under /_next/static, for a bucket (s3.konfidence.cloud)
set -euo pipefail

: "${REGISTRY:?set REGISTRY (no scheme)}"
: "${VERSION:?set VERSION}"
# kden expands ${REGISTRY}/${VERSION} in the constructors from the env.
# next.config.ts turns VERSION into the Next.js deployment id.
export REGISTRY VERSION
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
SVC=web
# Quickstart clusters run on amd64 and arm64 (Apple Silicon) hosts.
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

# Portable in-place substitution of ${REGISTRY}/${VERSION} (avoids `sed -i`,
# which differs between GNU and BSD/macOS).
render() {
	local tmp
	tmp="$(mktemp)"
	sed "s|\${REGISTRY}|$REGISTRY|g; s|\${VERSION}|$VERSION|g" "$1" >"$tmp" && mv "$tmp" "$1"
}

# Hermit pins Node.js and pnpm for the repository, see bin/hermit.hcl.
if [[ -f "$REPO/bin/activate-hermit" ]]; then
	# shellcheck disable=SC1091
	source "$REPO/bin/activate-hermit"
fi

# Generated files land in a gitignored dist/ so they can be inspected after a run.
DIST="$ROOT/dist"
rm -rf "$DIST"
mkdir -p "$DIST"

# The app and packages/next-devtools share one pnpm lockfile at the repository
# root. Installing also compiles that package, which the app imports.
echo "==> [$SVC] building the Next.js app"
(cd "$REPO" && pnpm install --frozen-lockfile)
rm -rf "$ROOT/.next"
(cd "$ROOT" && pnpm exec next build)
# The build writes the server to .next/standalone and the browser files to
# .next/static. Everything below packs these two directories.

echo "==> [$SVC] building and pushing images for $PLATFORMS"
# The Dockerfile only copies the build output, so this needs no Node.js
# toolchain inside Docker.
docker buildx build --platform "$PLATFORMS" --push -t "$REGISTRY/$SVC:$VERSION" "$ROOT"

# Flux deploys the Helm chart, so publish it as an OCI chart. The chart/app
# version come from VERSION (the image tag defaults to .Chart.AppVersion); only
# the registry is filled into values.yaml, so the committed chart stays
# registry/version-agnostic.
echo "==> [$SVC] publishing Helm chart"
cp -r "$ROOT/chart" "$DIST/chart"
render "$DIST/chart/values.yaml"
helm package "$DIST/chart" --version "$VERSION" --app-version "$VERSION" --destination "$DIST" >/dev/null
helm push "$DIST/$SVC-chart-$VERSION.tgz" "oci://$REGISTRY"

# kden reads the web-static input path (./.next/static) relative to the
# working directory, so both pushes run from services/web.
echo "==> [$SVC] pushing OCM components web and web-static"
(cd "$ROOT" && kden artifact push --registry "https://$REGISTRY" --file ocm/web.component-constructor.yaml)
(cd "$ROOT" && kden artifact push --registry "https://$REGISTRY" --file ocm/web-static.component-constructor.yaml)

# Move the floating `edge` aliases only now that both versions exist, so a
# failed push leaves both aliases where they were. The VectorTemplate
# references :edge and rolls out a new vector once edge moves. web-static
# moves first, so a server behind edge never names static files that edge
# does not reach.
echo "==> [$SVC] moving edge aliases -> $VERSION"
kden artifact alias "https://$REGISTRY//github.com/konfidence-project/example-app/web-static:$VERSION" edge
kden artifact alias "https://$REGISTRY//github.com/konfidence-project/example-app/web:$VERSION" edge
