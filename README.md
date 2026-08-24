[![REUSE status](https://api.reuse.software/badge/github.com/konfidence-project/example-app)](https://api.reuse.software/info/github.com/konfidence-project/example-app)

# Konfidence example app

A two-service app delivered through [Konfidence](https://github.com/konfidence-project/konfidence). Small enough to read end to end; every file is here to demonstrate one concept.

## What it demonstrates

- **`X-Vector-ID` forwarding** between services — see `services/*/vectorid.*` and `services/interviews/src/candidatesClient.ts`.
- **East-west service discovery via deployment results** — `interviews` resolves the
  `candidates` address from the vector-data-service's `deploymentResults` (evaluate the
  vector-id, read the component's Service host) instead of a hardcoded URL. A Service opts
  into the deployment results with the `konfidence.cloud/deployment-result` annotation.
- **Vector-scoped configuration via OpenFeature/OFREP.** Two release toggles:
  - `allow-video-slots` on `interviews` — whether `"video"` is an accepted slot type.
  - `enable-candidate-notes` on `candidates` — whether the `notes` field on a candidate is accepted.
- **Schema migrations as Konfidence tasks** — one per service, packaged as `cloud.konfidence.artifact.task.manifest` OCM resources and run as k8s Jobs.
- **OCM component descriptors** — one per service, one for the vector.
- **Two deployer types** — `candidates` ships as a Kustomize bundle, `interviews`
  as a Helm chart, so both Konfidence deployers (`cloud.konfidence.flux.kustomize`
  and `cloud.konfidence.flux.helm`) are exercised.

## Flow

```
  POST /interviews {candidateId, slotTime, slotType}
     │
     ▼
  interviews (TypeScript)               ── OFREP ──▶  vector-data-service
     │ • allow-video-slots?
     │ • forwards X-Vector-ID
     ▼
  candidates (Go)                       ── OFREP ──▶  vector-data-service
     │ • enable-candidate-notes?
     │ • writes to Postgres
     ▼
  Postgres  (external, not part of the vector)
```

## Prerequisites

- CLI tools: `docker`, `kind`, `kubectl`, `helm`, `flux`, `ocm`, `python3`.
- A Kubernetes cluster with Konfidence installed — or run
  `hack/01-setup-kind-cluster.sh` to create a local kind cluster with Konfidence.
- A container registry you can push to and the cluster can pull from.

`hack/04-apply-konfidence-resources.sh` provisions a Postgres for the app; a
production deployment would point `example-app-db-credentials` at a managed
database instead.

## Layout

```
example-app/
├── services/
│   ├── candidates/   # Go
│   └── interviews/   # TypeScript / Node
├── vector/
│   ├── vectortemplate.yaml
│   └── stage.yaml
├── LICENSE, LICENSES/, REUSE.toml
└── README.md
```

Each service directory holds its own source, Dockerfile, deployment manifests
(Kustomize bundle or Helm chart), OCM descriptor, migration image, and README.

## Deploy it

You need a Kubernetes cluster with Konfidence installed and a container
registry you can push to and the cluster can pull from (Artifactory, GHCR, ...).

```bash
./hack/01-setup-kind-cluster.sh              # kind + Konfidence (skip if you have a cluster)
./hack/02-setup-registry.sh                  # local plain-HTTP registry wired into kind
./hack/03-pipeline.sh                        # build + publish artifacts (imitates CI)
./hack/04-apply-konfidence-resources.sh      # apply VectorTemplate + Stage
./hack/99-teardown.sh                        # remove the app + reset the registry
```

> While the required Konfidence fixes are not in a release yet, run
> `./hack/01_temp_from_local.sh` instead of `01-setup-kind-cluster.sh` — it
> builds Konfidence from sibling checkouts (`../konfidence`,
> `../kubernetes-landscape-orchestrator`). Everything else is identical.

Step 03 is what a CI pipeline would run in production; step 04 applies the
initial Konfidence resources and Konfidence reconciles the rest — the scripts
don't deploy the workloads directly.

> No cluster yet? `./hack/01-setup-kind-cluster.sh` spins up a kind cluster and
> installs Konfidence using the official quickstart installer.
>
> No registry handy? `./hack/02-setup-registry.sh` runs a local plain-HTTP
> registry wired into the kind cluster (`kind-registry:5000`). The OCM references
> carry an explicit `http://` scheme, so `kden` digests over plain HTTP and the
> orchestrator pulls insecurely — no TLS or per-resource insecure flag needed.
> For the Helm-deployed service, Flux's helm-controller still needs an auth entry
> for the registry host in the pull secret even if the registry is anonymous;
> `04-apply-konfidence-resources.sh` creates a dummy one.

## Verify service-to-service routing

`interviews` calls `candidates` by resolving its address from the vector's
deployment results — no hard-coded URL. Both Services are `ClusterIP`, so
port-forward them and drive a request:

```bash
NS=example-landscape

# The vector id is the name of the deployed vector's data object.
VID=$(kubectl -n "$NS" get vectordata -o jsonpath='{.items[0].metadata.name}')

# Deployed Service names carry a per-vector suffix; select them by label.
kubectl -n "$NS" port-forward "svc/$(kubectl -n "$NS" get svc -l app=candidates -o jsonpath='{.items[0].metadata.name}')" 19090:80 &
kubectl -n "$NS" port-forward "svc/$(kubectl -n "$NS" get svc -l app.kubernetes.io/name=interviews -o jsonpath='{.items[0].metadata.name}')" 18081:80 &

# Create a candidate directly on the candidates service.
CID=$(curl -s -X POST localhost:19090/candidates \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com"}' | jq -r '.id')

# Create an interview. interviews reads the candidates address from the vector's
# deployment results (X-Vector-ID selects the vector) and calls it.
curl -i -X POST localhost:18081/interviews \
  -H 'Content-Type: application/json' \
  -H "X-Vector-ID: $VID" \
  -d "{\"candidateId\":\"$CID\",\"slotTime\":\"2026-09-01T10:00:00Z\",\"slotType\":\"onsite\"}"
```

`201 Created` confirms the east-west call succeeded. With an unknown
`X-Vector-ID` (no deployment results) the same call returns `502`, showing the
peer address comes from the vector data, not a hard-coded URL.

For a read-only check, `GET /candidates/{id}` on the interviews service performs
the same service-to-service call (resolve via deployment results, then fetch):

```bash
curl -s "http://localhost:18081/candidates/$CID" -H "X-Vector-ID: $VID" | jq .
```

Both services log the flow verbosely. Watch them with:

```bash
kubectl -n "$NS" logs -f deploy/"$(kubectl -n "$NS" get deploy -l app.kubernetes.io/name=interviews -o jsonpath='{.items[0].metadata.name}')"
# interviews: incoming request + vectorId, [discovery] OFREP call + resolved host, [s2s] GET + response status
kubectl -n "$NS" logs -f deploy/"$(kubectl -n "$NS" get deploy -l app=candidates -o jsonpath='{.items[0].metadata.name}')"
# candidates: incoming request <method> <path> vectorId=...
```

## TODOs / interim workarounds

A few things are implemented as interim workarounds because the platform
capability they need is still in flight. Each will be simplified once the
corresponding platform work lands.

- **`X-Vector-ID` header name is configurable, not fixed** — set via
  `VECTOR_ID_HEADER` because the header/propagation contract isn't finalized:
  [konfidence-project#293](https://github.com/konfidence-project/konfidence-project/issues/293)
  (ADR: vector context propagation). Once fixed we can rely on the canonical name.

## Concepts, at a glance

| Concept | Where |
|---|---|
| OCM component | `services/*/ocm/component-constructor.yaml` |
| Deployer manifest | `services/*/ocm/konfidence-manifest.json` (kustomize for candidates, helm for interviews) |
| Migration task | `services/*/ocm/tasks/*/task-manifest.json` |
| Vector assembly | `vector/vectortemplate.yaml` |
| Vector-scoped config | `vector/vectortemplate.yaml` → `spec.vectorConfig.features` |
| OpenFeature client | `services/candidates/openfeature.go`, `services/interviews/src/openfeature.ts` |
| `X-Vector-ID` forwarding | `services/candidates/vectorid.go`, `services/interviews/src/{vectorid,candidatesClient}.ts` |

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/konfidence-project/example-app/issues).
Contribution and feedback are encouraged and always welcome.
For more information about how to contribute see our [Contribution Guidelines](https://github.com/konfidence-project/.github/blob/main/CONTRIBUTING.md).

## Security / Disclosure

If you find any bug that may be a security problem, please follow our instructions [in our security policy](https://github.com/konfidence-project/.github/blob/main/SECURITY.md) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/konfidence-project/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2026 SAP SE or an SAP affiliate company and konfidence contributors.
Please see our [LICENSES](LICENSES) for copyright and license information.
Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/konfidence-project/example-app).
