#!/usr/bin/env bash
# Build and publish the web frontend artifacts. Driven entirely by
# REGISTRY + VERSION (exported by hack/local-dev/02-pipeline.sh, or set them yourself):
#   REGISTRY=ghcr.io/my-org/example-app VERSION=0.1.0-dev ./services/web/build-and-push.sh
#
# Unlike the other services there is no Dockerfile, chart or OCM constructor
# in this directory. The Konfidence Next.js adapter generates all of them from
# the build, see packages/next-adapter.
set -euo pipefail

: "${REGISTRY:?set REGISTRY (no scheme)}"
: "${VERSION:?set VERSION}"
export REGISTRY VERSION
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "==> [web] installing dependencies"
# `npm ci` also takes a fresh copy of the adapter from ../../packages.
npm ci --no-audit --no-fund

# The adapter runs inside the build. It records what was built and stages the
# static files in .next/konfidence/.
echo "==> [web] building"
npx next build

# Builds and pushes the server image and its chart, then pushes two OCM
# components: web (helm.konfidence.cloud) and web-static (s3.konfidence.cloud).
# KONFIDENCE_PUBLISH_ARGS takes extra options, for example --no-static-in-image
# for a landscape that serves /_next/static from object storage.
# shellcheck disable=SC2086
npx konfidence-next publish ${KONFIDENCE_PUBLISH_ARGS:-}
