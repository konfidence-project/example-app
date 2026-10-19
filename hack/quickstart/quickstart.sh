#!/bin/sh

# Example App Quickstart
#
# Prepares the Example App on the cluster from the Konfidence Quickstart
# (https://konfidence.cloud/docs/getting-started/quickstart), so you can
# play with it right away. It runs the "Prepare the demo environment" steps
# of "Deliver an application" and adds a gateway that routes
# <stage>.example.kden.local on http://localhost:9090 to the stage.
#
# Konfidence ships no gateway (ADR-0037). This script plays the cluster admin
# with Envoy Gateway, as the docs guide "Route traffic to stages with Envoy
# Gateway" describes.
#
#
# Prerequisites
#
# - the running cluster from the Konfidence Quickstart; it maps
#   localhost:9090 to NodePort 30080
# - kubectl
# - helm
#
#
# Run it
#
#   curl -fsSL https://raw.githubusercontent.com/konfidence-project/example-app/main/hack/quickstart/quickstart.sh | sh
#
# Then continue with "Check the starting state" in "Deliver an application".
# The Konfidence Quickstart cleanup deletes the cluster and everything in it.

set -eu

# Use the same KIND_CLUSTER_NAME as for the Konfidence Quickstart.
cluster_name=${KIND_CLUSTER_NAME:-konfidence-quickstart}
envoy_gateway_version=${ENVOY_GATEWAY_VERSION:-v1.9.2}
vector_data_service_version=${VECTOR_DATA_SERVICE_VERSION:-0.0.0-4f194adf3c2e211514d41c59d1a446275bb093e3}
# Git ref of this repository to read the manifests from when the script is
# piped from curl.
example_app_ref=${EXAMPLE_APP_REF:-main}

# Run from a checkout, the script applies the manifests next to it, so local
# edits take effect. Piped from curl, it reads them from GitHub.
script_dir=$(dirname "$0")
manifests() {
  if [ -f "$script_dir/project/kustomization.yaml" ]; then
    printf '%s/%s' "$script_dir" "$1"
  else
    printf 'https://github.com/konfidence-project/example-app/hack/quickstart/%s?ref=%s' "$1" "$example_app_ref"
  fi
}

# Never touch another cluster by accident: every command below runs against
# the Quickstart cluster's context.
select_cluster() {
  kubectl config use-context "kind-$cluster_name"
}

install_gateway() {
  # The CRDs exceed the 1 MiB Helm release limit, so they are rendered and
  # applied server-side as the Envoy Gateway install guide prescribes.
  helm template eg oci://docker.io/envoyproxy/gateway-crds-helm \
    --version "$envoy_gateway_version" \
    --set crds.gatewayAPI.enabled=true \
    --set crds.gatewayAPI.channel=standard \
    --set crds.envoyGateway.enabled=true \
    | kubectl apply --server-side -f -

  # GatewayNamespace mode runs each Gateway's proxy in the Gateway's own
  # namespace, so every landscape's konfidence-router Service lives next to
  # the routes Konfidence creates there.
  helm upgrade --install eg oci://docker.io/envoyproxy/gateway-helm \
    --version "$envoy_gateway_version" \
    --namespace envoy-gateway-system \
    --create-namespace \
    --set crds.enabled=false \
    --set config.envoyGateway.provider.kubernetes.deploy.type=GatewayNamespace \
    --wait

  kubectl apply -k "$(manifests gateway)"
  kubectl wait gateway/edge \
    --namespace edge-gateway \
    --for=condition=Programmed \
    --timeout=180s
}

# The same steps as "Prepare the demo environment" in "Deliver an
# application".
prepare_example_app() {
  kubectl apply -k "$(manifests project)"
  kubectl wait --for=jsonpath='{.status.conditions[?(@.type=="NamespaceReady")].status}'=True \
    project/example-app --timeout=60s

  kubectl apply -k "$(manifests landscapes)"
  kubectl -n kden-p-example-app wait --for=jsonpath='{.status.conditions[?(@.type=="NamespaceReady")].status}'=True \
    landscape/dev landscape/prod --timeout=60s

  kubectl apply -k "$(manifests environment)"

  for ns in kden-l-dev kden-l-prod; do
    helm upgrade --install vector-data-service oci://ghcr.io/konfidence-project/charts/vector-data-service \
      --version "$vector_data_service_version" \
      --namespace "$ns" --wait
  done
}

# The konfidence-router Gateways live in the landscape namespaces, so they can
# only be created after the landscapes.
install_routing() {
  kubectl apply -k "$(manifests routing)"
  for ns in kden-l-dev kden-l-prod; do
    kubectl wait gateway/konfidence-router \
      --namespace "$ns" \
      --for=condition=Programmed \
      --timeout=180s
  done
}

# Tracing is switched off so the guidance is not buried in printf traces.
print_next_steps() {
  { set +x; } 2>/dev/null
  cat <<EOF

The Example App is prepared in the cluster "$cluster_name".

Next steps:

1. Wait until the development stage has an ACTIVE-VERSION:

     kubectl -n kden-l-dev get stage dev-eu12 -w

2. Continue with "Check the starting state" in
   https://konfidence.cloud/docs/getting-started/deliver-an-application

3. Send requests to a stage through the gateway:

     curl -H 'Host: dev-eu12.example.kden.local' http://localhost:9090/
EOF
}

usage() {
  printf 'Usage: sh quickstart.sh [install]\n'
  printf 'The default action is install.\n'
}

if [ "$#" -gt 1 ]; then
  usage >&2
  exit 1
fi

case "${1:-install}" in
  install)
    set -x
    select_cluster
    install_gateway
    prepare_example_app
    install_routing
    print_next_steps
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
