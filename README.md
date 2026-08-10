[![REUSE status](https://api.reuse.software/badge/github.com/konfidence-project/example-app)](https://api.reuse.software/info/github.com/konfidence-project/example-app)

# Konfidence example app

A two-service app delivered through [Konfidence](https://github.com/konfidence-project/konfidence). Small enough to read end to end; every file is here to demonstrate one concept.

## What it demonstrates

- **`X-Vector-ID` forwarding** between services — see `services/*/vectorid.*` and `services/interviews/src/candidatesClient.ts`.
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

`hack/03-apply-konfidence-resources.sh` provisions a Postgres for the app; a
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
export REGISTRY=ghcr.io/my-org/example-app

./hack/01-setup-kind-cluster.sh              # kind + Konfidence (skip if you have a cluster)
./hack/02-pipeline.sh                        # build + publish artifacts (imitates CI)
./hack/03-apply-konfidence-resources.sh      # apply VectorTemplate + StageConfiguration
./hack/99-teardown.sh                        # remove the app
```

Step 02 is what a CI pipeline would run in production; step 03 applies the
initial Konfidence resources and Konfidence reconciles the rest — the scripts
don't deploy the workloads directly.

> No cluster yet? `./hack/01-setup-kind-cluster.sh` spins up a kind cluster and
> installs Konfidence using the official quickstart installer.
>
> No registry handy? Run a local one and a kind cluster — see the
> [kind local registry guide](https://kind.sigs.k8s.io/docs/user/local-registry/).
> A local registry must be served over TLS (or configured as insecure) so the
> OCM CLI, Flux, and kubelet can all use it. For the Helm-deployed service,
> Flux's helm-controller also needs an auth entry for the registry host in the
> pull secret even if the registry is anonymous — create it with
> `kubectl create secret docker-registry <sanitized-host> --docker-server=<host> --docker-username=x --docker-password=x`.

## TODOs / interim workarounds

A few things are implemented as interim workarounds because the platform
capability they need is still in flight. Each will be simplified once the
corresponding platform work lands.

- **Service-to-service discovery is a hardcoded URL** — `interviews` reaches
  `candidates` via `CANDIDATES_URL` plus an `ExternalName` alias created by
  `hack/03-apply-konfidence-resources.sh`. The intended design is to resolve the
  address from the vector-data-service's deployment results (evaluate the
  vector-id, read `deploymentResults`), so nothing is hardcoded. This depends on
  east-west routing via deployment results. That same routing work also gates
  the rest of the chain today: `VectorAssignment`s only become `Ready` once their
  HTTPRoute is accepted by a Gateway, and the `VectorData` ConfigMap (and thus
  live toggle values) is only materialized after the assignments are ready — so
  until east-west routing via deployment results is available, the feature
  toggles fall back to their defaults.
- **`X-Vector-ID` header name is configurable, not fixed** — set via
  `VECTOR_ID_HEADER` because the vector context propagation contract isn't
  finalized. Once fixed we can rely on the canonical name.
- **Artifacts are published with `ocm`, not `kden`** — `hack/02-pipeline.sh` uses
  the OCM CLI. `kden artifact push` would be the canonical tool (our descriptors
  already pass `kden artifact validate`), but it currently panics:
  [konfidence/#121](https://github.com/konfidence-project/konfidence/issues/121).
  Switch the pipeline to `kden` once fixed.

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
