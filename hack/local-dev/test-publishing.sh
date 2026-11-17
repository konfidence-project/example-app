#!/usr/bin/env bash
# Exercise the real publishing scripts without contacting a registry.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT
mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/hack/local-dev"
cp -R "$ROOT/services" "$TEST_ROOT/services"
cp "$ROOT/hack/local-dev/02-pipeline.sh" "$TEST_ROOT/hack/local-dev/"
cat > "$TEST_ROOT/bin/stub" <<'SH'
#!/usr/bin/env bash
printf '%s' "${0##*/}" >> "$PUBLISH_LOG"
printf ' %s' "$@" >> "$PUBLISH_LOG"
printf '\n' >> "$PUBLISH_LOG"
SH
chmod +x "$TEST_ROOT/bin/stub"
for tool in docker flux helm kustomize kden; do
  ln -s stub "$TEST_ROOT/bin/$tool"
done
export PATH="$TEST_ROOT/bin:$PATH"
export REGISTRY=registry.invalid/example-app
export VERSION=0.1.0-channel-test
export PUBLISH_LOG="$TEST_ROOT/commands"
unset COMPONENT_CHANNEL

for channel in edge failure-readiness failure-migration; do
  if [[ "$channel" != edge ]]; then
    export COMPONENT_CHANNEL="$channel"
  fi
  : > "$PUBLISH_LOG"
  "$TEST_ROOT/hack/local-dev/02-pipeline.sh" > /dev/null
  grep '^kden artifact alias ' "$PUBLISH_LOG" > "$TEST_ROOT/aliases"
  : > "$TEST_ROOT/expected"
  for service in candidates interviews; do
    printf 'kden artifact alias https://%s//github.com/konfidence-project/example-app/%s:%s %s\n' \
      "$REGISTRY" "$service" "$VERSION" "$channel" >> "$TEST_ROOT/expected"
    grep -F -- "-t $REGISTRY/$service:$VERSION" "$PUBLISH_LOG" > /dev/null
    grep -F -- "-t $REGISTRY/$service-migrations:$VERSION" "$PUBLISH_LOG" > /dev/null
  done
  diff -u "$TEST_ROOT/expected" "$TEST_ROOT/aliases"
done
echo 'Publishing channel isolation passed'
