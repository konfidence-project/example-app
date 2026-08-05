#!/usr/bin/env bash
# Build the example-app images and publish all artifacts (container images,
# kustomize bundles, OCM components) to an OCI registry.
#
# This imitates what a CI pipeline would do. Point it at any registry with
# REGISTRY; nothing else needs to change.
#
#   REGISTRY=ghcr.io/my-org/example-app ./hack/02-pipeline.sh
#   REGISTRY=konfidence-registry:5000/example-app ./hack/02-pipeline.sh   # local kind
#
# Env:
#   REGISTRY   (required) target repository prefix, no scheme
#   VERSION    image/artifact version tag (default v0.1.0)
#   KIND_LOAD  if set, also `kind load` the runtime images into KIND_CLUSTER
#   KIND_CLUSTER  kind cluster name for KIND_LOAD (default konfidence-example)
set -euo pipefail

: "${REGISTRY:?set REGISTRY, e.g. konfidence-registry:5000/example-app}"
VERSION="${VERSION:-v0.1.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

services="candidates interviews"

echo "==> Building and pushing container images"
for svc in $services; do
  docker build -t "$REGISTRY/$svc:$VERSION" "$ROOT/services/$svc"
  docker build -t "$REGISTRY/$svc-migrations:$VERSION" "$ROOT/services/$svc/migrations"
  docker push "$REGISTRY/$svc:$VERSION"
  docker push "$REGISTRY/$svc-migrations:$VERSION"
  if [ -n "${KIND_LOAD:-}" ]; then
    kind load docker-image "$REGISTRY/$svc:$VERSION" --name "${KIND_CLUSTER:-konfidence-example}"
  fi
done

echo "==> Publishing deployment artifacts"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
for svc in $services; do
  mtype="$(python3 -c "import json;print(json.load(open('$ROOT/services/$svc/ocm/konfidence-manifest.json'))['type'])")"
  case "$mtype" in
    *.kustomize)
      cp -r "$ROOT/services/$svc/manifests" "$work/$svc"
      # Point the workload image at the target registry without touching the repo.
      cat >> "$work/$svc/kustomization.yaml" <<EOF
images:
  - name: $svc:$VERSION
    newName: $REGISTRY/$svc
    newTag: $VERSION
EOF
      flux push artifact "oci://$REGISTRY/$svc-kustomization:$VERSION" \
        --path="$work/$svc" --source=example-app --revision="$VERSION"
      ;;
    *.helm)
      cp -r "$ROOT/services/$svc/chart" "$work/$svc-chart"
      sed -i "s|\${REGISTRY}|$REGISTRY|g" "$work/$svc-chart/values.yaml"
      helm package "$work/$svc-chart" --destination "$work" >/dev/null
      helm push "$work/$svc"-chart-*.tgz "oci://$REGISTRY"
      ;;
    *)
      echo "unknown deployer type '$mtype' for $svc" >&2; exit 1
      ;;
  esac
done

echo "==> Pushing OCM components"
# Let the OCM CLI reuse the credentials from `docker login` so a single login
# covers image, bundle, and OCM pushes.
ocm_cfg="$work/ocmconfig.yaml"
cat > "$ocm_cfg" <<EOF
type: generic.config.ocm.software
configurations:
  - type: credentials.config.ocm.software
    repositories:
      - repository:
          type: DockerConfig/v1
          dockerConfigFile: "$HOME/.docker/config.json"
          propagateConsumerIdentity: true
EOF
for svc in $services; do
  sed "s|\${REGISTRY}|$REGISTRY|g" "$ROOT/services/$svc/ocm/component-constructor.yaml" > "$work/$svc-cc.yaml"
  cp "$ROOT/services/$svc/ocm/konfidence-manifest.json" "$work/"
  mkdir -p "$work/tasks"
  cp -r "$ROOT/services/$svc/ocm/tasks" "$work/"
  for t in "$work/tasks"/*/task-manifest.json; do
    sed -i "s|\${REGISTRY}|$REGISTRY|g" "$t"
  done
  ( cd "$work" && ocm --config "$ocm_cfg" add component-version \
      --repository "OCI::https://$REGISTRY" \
      --constructor "$svc-cc.yaml" \
      --component-version-conflict-policy=replace )
  rm -rf "$work/tasks"
done

echo "==> Done. Artifacts published under $REGISTRY (version $VERSION)."
echo "    Next: REGISTRY=$REGISTRY ./hack/03-apply-konfidence-resources.sh"
