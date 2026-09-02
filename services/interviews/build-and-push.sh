#!/usr/bin/env bash
# Build and publish the interviews service artifacts to an OCI registry.
#
#   ./services/interviews/build-and-push.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The service and its database migrations run as separate workloads. Publishing
# both images gives the deployment and migration task independently versioned
# runtime artifacts that Kubernetes can pull from the same registry.
echo "==> Building and pushing interviews container images"
docker build -t "ghcr.io/konfidence-project/interviews:v0.1.0" "$ROOT"
docker build -t "ghcr.io/konfidence-project/interviews-migrations:v0.1.0" "$ROOT/migrations"
docker push "ghcr.io/konfidence-project/interviews:v0.1.0"
docker push "ghcr.io/konfidence-project/interviews-migrations:v0.1.0"

# Konfidence's kubernetes-landscape-orchestrator needs the deployment content as
# a versioned Helm chart. Publishing it to the registry makes the exact chart
# referenced by the component available to Flux for deployment.
echo "==> Publishing interviews Helm chart"
mkdir -p "$ROOT/dist"
helm package "$ROOT/chart" --destination "$ROOT/dist" >/dev/null
helm push "$ROOT/dist/interviews-chart-0.1.0.tgz" "oci://ghcr.io/konfidence-project"

# The OCM component ties the deployable Helm chart, migration tasks, and
# referenced images into a versioned Konfidence artifact. This artifact can be
# used in a vector to deploy the multi-service application with Konfidence.
echo "==> Pushing interviews OCM component"
(
  # TODO kden CLI does not have a --overwrite flag at the moment, pushing same component version again fails
  cd "$ROOT/ocm" && kden artifact push --registry "https://ghcr.io/konfidence-project/artifacts" --file "$ROOT/ocm/component-constructor.yaml"
)
