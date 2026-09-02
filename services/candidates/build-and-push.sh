#!/usr/bin/env bash
# Build and publish the candidates service artifacts to an OCI registry.
#
#   ./services/candidates/build-and-push.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The service and its database migrations run as separate workloads. Publishing
# both images gives the deployment and migration task independently versioned
# runtime artifacts that Kubernetes can pull from the same registry.
echo "==> Building and pushing candidates container images"
docker build -t "ghcr.io/konfidence-project/candidates:v0.1.0" "$ROOT"
docker build -t "ghcr.io/konfidence-project/candidates-migrations:v0.1.0" "$ROOT/migrations"
docker push "ghcr.io/konfidence-project/candidates:v0.1.0"
docker push "ghcr.io/konfidence-project/candidates-migrations:v0.1.0"

# Konfidence's kubernetes-landscape-orchestrator needs the deployment content as a versioned
# OCI artifact. It uses Flux to execute the deployment, that's why we're also using Flux
# tooling here to publish the kustomization. This makes sure that the resulting OCI artifact
# uses flux-compatible OCI media types.
echo "==> Publishing candidates Kustomize artifact"
flux push artifact "oci://ghcr.io/konfidence-project/candidates-kustomization:v0.1.0" \
  --path="$ROOT/kustomization" --source=candidates --revision="v0.1.0"

# The OCM component ties the deployable kustomization, migration tasks, and referenced
# images into a versioned Konfidence artifact. This artifact can be used in a vector
# to deploy a multi-service application with Konfidence.
echo "==> Pushing candidates OCM component"
(
  # TODO kden CLI does not have a --overwrite flag at the moment, pushing same component version again fails
  cd "$ROOT/ocm" && kden artifact push --registry "https://ghcr.io/konfidence-project/artifacts" --file "$ROOT/ocm/component-constructor.yaml"
)
