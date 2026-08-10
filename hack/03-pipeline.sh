#!/usr/bin/env bash
# Build the example-app images and publish all artifacts (container images,
# kustomize bundles, Helm chart, OCM components) to the LOCAL kind registry.
# This is the step a real CI pipeline runs; locally it targets the plain-HTTP
# registry from 02-setup-registry.sh.
#
# Two names for the SAME registry container:
#   - localhost:5000     : push target. docker and `flux push` only speak plain
#                          HTTP automatically to localhost, not to a named host.
#   - kind-registry:5000 : baked into the artifacts (the name the cluster pulls).
#                          Needs an /etc/hosts alias so `ocm add` can resolve it.
#
# KNOWN BLOCKER (plain HTTP): `ocm add` computes resource digests by issuing a
# HEAD against each imageReference, and the OCM CLI always uses HTTPS for a named
# host (kind-registry) — there is no plain-HTTP switch for that path. We pass
# --skip-reference-digest-processing so publishing succeeds, BUT the resulting
# descriptor has no resource digests, and Konfidence rejects it downstream with
# "descriptor is not safely digestible: missing digest". See hack/README-HTTP.md.
set -euo pipefail

PUSH="localhost:5000/example-app"   # push target (plain HTTP via localhost)
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
      flux push artifact "oci://$PUSH/$svc-kustomization:$VERSION" \
        --path="$ROOT/services/$svc/manifests" \
        --source=example-app --revision="$VERSION" \
        --insecure-registry
      ;;
    *.helm)
      work="$(mktemp -d)"
      helm package "$ROOT/services/$svc/chart" --destination "$work" >/dev/null
      helm push "$work/$svc"-chart-*.tgz "oci://$PUSH" --plain-http
      rm -rf "$work"
      ;;
    *)
      echo "unknown deployer type '$mtype' for $svc" >&2; exit 1
      ;;
  esac
done

echo "==> Pushing OCM components"
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
  # --skip-reference-digest-processing: works around the HTTPS-only digest HEAD
  # (see BLOCKER above). Konfidence will reject the digest-less descriptor.
  ocm --config "$ocm_cfg" add component-version \
    --repository "oci::http://$PUSH" \
    --constructor "$ROOT/services/$svc/ocm/component-constructor.yaml" \
    --skip-reference-digest-processing \
    --component-version-conflict-policy=replace
done

echo "==> Done. Artifacts published to the local registry (version $VERSION)."
echo "    Push name: localhost:5000/example-app        (flux/docker plain HTTP)"
echo "    Ref  name: kind-registry:5000/example-app    (baked in; cluster pull)"
echo "    Next: ./hack/04-apply-konfidence-resources.sh"
