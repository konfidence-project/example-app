#!/usr/bin/env bash
# Builds the web frontend the way a publish does, without pushing anything,
# and checks what comes out:
#
#   1. next build with the Konfidence adapter
#   2. konfidence-next package: image context, Helm chart, OCM constructors
#   3. helm lint and helm template of the generated chart
#   4. docker build of the generated image context for the local platform
#   5. smoke test: the image runs with the chart's security settings (non-root,
#      read-only root filesystem, no capabilities) and answers /api/healthz
#      and a server-rendered page
#
# SKIP_DOCKER=1 stops after step 3, for machines without a Docker daemon.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$REPO/services/web"
export VERSION="${VERSION:-0.0.0-verify}"
export NEXT_TELEMETRY_DISABLED=1
REGISTRY="${REGISTRY:-registry.invalid/example-app}"
IMAGE="konfidence-web-verify:$VERSION"
PORT="${VERIFY_PORT:-3901}"

log() { echo "==> [verify-web] $*"; }

cd "$WEB"
log "next build (VERSION=$VERSION)"
pnpm exec next build

log "konfidence-next package"
pnpm exec konfidence-next package --registry "$REGISTRY"
OUT="$WEB/.next/konfidence"

log "helm lint and template"
helm lint --strict "$OUT/chart"
helm template web-verify "$OUT/chart" >"$OUT/rendered.yaml"

if [[ "${SKIP_DOCKER:-}" == "1" ]]; then
	log "SKIP_DOCKER=1, not building the image"
	exit 0
fi

log "docker build $IMAGE"
docker build -t "$IMAGE" "$OUT/image"

ENTRY="$(node -e 'console.log(require(process.argv[1]).server.entry)' "$OUT/build.json")"
CACHE_DIR="/app/$(dirname "$ENTRY")/.next/cache"
log "smoke test on port $PORT"
CONTAINER="$(docker run -d --rm -p "127.0.0.1:$PORT:3000" \
	--read-only --tmpfs /tmp --tmpfs "$CACHE_DIR:uid=1000,gid=1000" \
	--user 1000:1000 --cap-drop ALL --security-opt no-new-privileges \
	-e KONFIDENCE_FEATURES='{"allow-video-slots":true}' \
	-e KONFIDENCE_SERVICE_CANDIDATES_URL=http://127.0.0.1:9 \
	-e KONFIDENCE_SERVICE_INTERVIEWS_URL=http://127.0.0.1:9 \
	"$IMAGE")"
trap 'docker logs "$CONTAINER" >&2 || true; docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
	if curl -fsS "http://127.0.0.1:$PORT/api/healthz" >/dev/null 2>&1; then break; fi
	sleep 1
done
curl -fsS "http://127.0.0.1:$PORT/api/healthz"
echo
# The services are unreachable on purpose: the page must still render, with
# its error state, on a read-only filesystem.
status="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/people")"
[[ "$status" == "200" ]] || {
	echo "/people answered $status" >&2
	exit 1
}
log "ok"
