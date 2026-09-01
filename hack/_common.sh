#!/usr/bin/env bash
# Shared helpers for the example-app hack scripts. Sourced, not executed.
#
# Conventions (no hardcoded namespaces): the Project/Landscape controllers
# derive and report their namespaces in .status.namespace, which we read back.
# One docker-registry secret named "registry-credentials" serves every
# consumer; a flux-deployer-configuration ConfigMap maps the registry host to
# that name so Flux does not require a host-derived secret name.

CRED_SECRET="registry-credentials"

log() { echo "$@" >&2; }

# registry_host <REGISTRY>: hostname of the registry (strip path and port).
registry_host() {
  local h="${1%%/*}"
  echo "${h%%:*}"
}

# ensure_credentials <REGISTRY> <ns>...: create/refresh the registry-credentials
# docker-registry secret in each namespace from REGISTRY_USERNAME/REGISTRY_PASSWORD
# (prompted if unset and interactive). The user owns these credentials.
ensure_credentials() {
  local registry="$1"; shift
  local host user pass
  host="$(registry_host "$registry")"
  user="${REGISTRY_USERNAME:-}"
  pass="${REGISTRY_PASSWORD:-${REGISTRY_TOKEN:-}}"
  if [ -z "$user" ] || [ -z "$pass" ]; then
    if [ ! -t 0 ]; then
      log "ERROR: set REGISTRY_USERNAME and REGISTRY_PASSWORD (or run interactively)"
      return 1
    fi
    [ -n "$user" ] || { printf 'Registry username for %s: ' "$host" >&2; read -r user; }
    [ -n "$pass" ] || { printf 'Registry password/token for %s: ' "$host" >&2; read -rs pass; echo >&2; }
  fi
  local ns
  for ns in "$@"; do
    kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    kubectl -n "$ns" create secret docker-registry "$CRED_SECRET" \
      --docker-server="$host" --docker-username="$user" --docker-password="$pass" \
      --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    log "    credentials in $ns"
  done
}

# ensure_flux_auth_configmap <REGISTRY>: map the registry host to registry-credentials
# so klo/Flux resolves auth without a host-named secret.
ensure_flux_auth_configmap() {
  local host; host="$(registry_host "$1")"
  kubectl -n konfidence-system create configmap flux-deployer-configuration \
    --from-literal=authenticationSecretRefs="{\"$host\": \"$CRED_SECRET\"}" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
}

# apply_project <root>: apply the Project, wait, print its namespace.
apply_project() {
  local root="$1"
  kubectl apply -f "$root/konfidence/project.yaml" >&2
  kubectl wait --for=jsonpath='{.status.conditions[?(@.type=="NamespaceReady")].status}'=True \
    project/example-app --timeout=60s >&2
  kubectl get project example-app -o jsonpath='{.status.namespace}'
}

# apply_landscape <root> <project-ns>: apply the Landscape into the project ns,
# wait, print the managed namespace.
apply_landscape() {
  local root="$1" project_ns="$2"
  kubectl -n "$project_ns" apply -f "$root/konfidence/landscape.yaml" >&2
  kubectl -n "$project_ns" wait --for=jsonpath='{.status.conditions[?(@.type=="NamespaceReady")].status}'=True \
    landscape/example-app --timeout=60s >&2
  kubectl -n "$project_ns" get landscape example-app -o jsonpath='{.status.namespace}'
}

# add_pull_secret_to_default_sa <ns>: let the kubelet pull workload images.
add_pull_secret_to_default_sa() {
  kubectl -n "$1" patch serviceaccount default \
    -p "{\"imagePullSecrets\":[{\"name\":\"$CRED_SECRET\"}]}" >&2
}

# deploy_postgres <root> <managed-ns>: out-of-band app database + its credentials
# secret in the managed ns. A production deployment would point
# example-app-db-credentials at a managed database instead.
deploy_postgres() {
  local root="$1" ns="$2"
  kubectl apply -f "$root/hack/postgres.yaml" >&2
  kubectl -n example-app-db rollout status statefulset/postgres --timeout=120s >&2
  kubectl -n "$ns" apply -f - >&2 <<'EOF'
apiVersion: v1
kind: Secret
metadata: {name: example-app-db-credentials}
type: Opaque
stringData: {PGHOST: postgres.example-app-db.svc.cluster.local, PGPORT: "5432", PGUSER: example, PGPASSWORD: example, PGDATABASE: example, PGSSLMODE: disable}
EOF
}

# install_vds_local <klo-src> <managed-ns> <tag>: TEMPORARY — install the
# vector-data-service from a local klo checkout (until the platform provisions
# it per landscape). No-op if the chart is not present.
install_vds_local() {
  local klo_src="$1" ns="$2" tag="${3:-dev}"
  [ -d "$klo_src/charts/vector-data-service" ] || return 0
  log "==> vector-data-service into $ns (local chart)"
  helm upgrade --install vector-data-service "$klo_src/charts/vector-data-service" \
    --namespace "$ns" \
    --set image.repository=vector-data-service --set image.tag="$tag" --wait >&2
}
