#!/usr/bin/env bash
# Build the app images and publish all artifacts (images, kustomize, Helm chart,
# OCM components) to the local registry — what a CI pipeline does.
#
# Push to localhost:5000 (host); artifacts reference kind-registry:5000 (what the
# cluster pulls). The http:// scheme on the OCM refs makes kden digest over plain
# HTTP and the orchestrator pull insecurely — no workaround flags/labels.
set -euo pipefail

PUSH="localhost:5000/example-app"                 # docker/flux/helm push target
OCM_REPO="http://kind-registry:5000/example-app"  # OCM component target (cluster-pullable)
VERSION="${VERSION:-v0.1.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KDEN="$ROOT/hack/kden"  # always the container wrapper; no host kden CLI

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

echo "==> Pushing OCM components with kden"
for svc in $services; do
  # run from the ocm dir: kden resolves constructor input paths relative to CWD
  ( cd "$ROOT/services/$svc/ocm" && "$KDEN" artifact push \
      --file component-constructor.yaml \
      --registry "$OCM_REPO" )
done

echo "==> Done. Artifacts published (version $VERSION). Next: ./hack/04-apply-konfidence-resources.sh"
