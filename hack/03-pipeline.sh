#!/usr/bin/env bash
# Build the example-app images and publish all artifacts (container images,
# kustomize bundles, Helm chart, OCM components) to the LOCAL kind registry.
#
# Local setup uses a single name for the registry, kind-registry:5000, served
# over TLS with a certificate trusted by the host (see hack/01). One name is
# required because Konfidence rejects descriptors without resource digests, and
# `ocm add` computes those digests by resolving each imageReference from the host
# at publish time — so the host must resolve (via /etc/hosts) and trust the same
# name the cluster pulls from.
set -euo pipefail

PUSH="kind-registry:5000/example-app"   # single name, host + cluster (TLS)
VERSION="${VERSION:-v0.1.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

services="candidates interviews"

echo "==> Building and pushing container images"
for svc in $services; do
  docker build -t "$PUSH/$svc:$VERSION" "$ROOT/services/$svc"
  docker build -t "$PUSH/$svc-migrations:$VERSION" "$ROOT/services/$svc/migrations"
  docker push "$PUSH/$svc:$VERSION"
  docker push "$PUSH/$svc-migrations:$VERSION"
done

echo "==> Publishing deployment artifacts"
for svc in $services; do
  mtype="$(python3 -c "import json;print(json.load(open('$ROOT/services/$svc/ocm/konfidence-manifest.json'))['type'])")"
  case "$mtype" in
    *.kustomize)
      # deployment.yaml already references kind-registry:5000/example-app/$svc.
      flux push artifact "oci://$PUSH/$svc-kustomization:$VERSION" \
        --path="$ROOT/services/$svc/manifests" \
        --source=example-app --revision="$VERSION"
      ;;
    *.helm)
      work="$(mktemp -d)"
      helm package "$ROOT/services/$svc/chart" --destination "$work" >/dev/null
      helm push "$work/$svc"-chart-*.tgz "oci://$PUSH"
      rm -rf "$work"
      ;;
    *)
      echo "unknown deployer type '$mtype' for $svc" >&2; exit 1
      ;;
  esac
done

echo "==> Pushing OCM components"
# Reuse docker login credentials; the local registry is anonymous so this is a
# no-op, but it keeps the config identical to a real registry.
ocm_cfg="$(mktemp)"
trap 'rm -f "$ocm_cfg"' EXIT
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
  ocm --config "$ocm_cfg" add component-version \
    --repository "oci::https://$PUSH" \
    --constructor "$ROOT/services/$svc/ocm/component-constructor.yaml" \
    --component-version-conflict-policy=replace
done

echo "==> Done. Artifacts published to the local registry (version $VERSION)."
echo "    Registry: kind-registry:5000/example-app  (TLS, one name host + cluster)"
echo "    Next: ./hack/04-apply-konfidence-resources.sh"
