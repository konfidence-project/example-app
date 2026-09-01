#!/usr/bin/env bash
# Remove the example app from the cluster: deletes the Landscape (its managed
# namespace, Stage and workloads), the Project (its namespace, VectorTemplate
# and promotion config) and the app database. Leaves Konfidence installed.
set -euo pipefail

project_ns="$(kubectl get project example-app -o jsonpath='{.status.namespace}' 2>/dev/null || true)"

# Landscape lives in the project namespace and owns the managed namespace.
if [ -n "$project_ns" ]; then
  kubectl -n "$project_ns" delete landscape example-app --ignore-not-found --wait
fi
# Project owns its namespace (VectorTemplate + VectorPromotionConfig).
kubectl delete project example-app --ignore-not-found --wait
# Out-of-band app database.
kubectl delete namespace example-app-db --ignore-not-found

echo "Done."
