#!/usr/bin/env bash
# Build and publish artifacts for every example-app service.
#
#   ./hack/02-pipeline.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker login ghcr.io </dev/null >/dev/null 2>&1; then
  cat >&2 <<EOF
Docker is not authenticated to ghcr.io.

Run "docker login ghcr.io" with an account that can push to the
konfidence-project organization, then run this pipeline again.
EOF
  exit 1
fi

if ! ocm get config >/dev/null; then
  cat >&2 <<EOF
OCM could not load its configuration.

Configure OCM so that we can use the shared credentials, for example in $HOME/.ocmconfig:

type: generic.config.ocm.software/v1
configurations:
  - type: credentials.config.ocm.software
    repositories:
      - repository:
          type: DockerConfig/v1
          dockerConfigFile: "${DOCKER_CONFIG:-$HOME/.docker}/config.json"
          propagateConsumerIdentity: true
EOF
  exit 1
fi

"$ROOT/services/candidates/build-and-push.sh"
"$ROOT/services/interviews/build-and-push.sh"

echo "==> Done. All service artifacts published."
