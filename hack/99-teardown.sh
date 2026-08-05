#!/usr/bin/env bash
# Remove the example app from the cluster (leaves Konfidence and Postgres data).
#
# Env:
#   LANDSCAPE_NS  namespace the app was deployed into (default example-landscape)
set -euo pipefail

LANDSCAPE_NS="${LANDSCAPE_NS:-example-landscape}"

kubectl -n "$LANDSCAPE_NS" delete stageconfiguration,vectortemplate example-app --ignore-not-found
kubectl -n "$LANDSCAPE_NS" delete service candidates --ignore-not-found
kubectl delete namespace example-app-db --ignore-not-found

echo "Done."
