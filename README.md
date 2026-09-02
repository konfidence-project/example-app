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

`hack/01-setup-kind-cluster.sh` provisions a Postgres for the app; a
production deployment would point `example-app-db-credentials` at a managed
database instead.

## Layout

```
example-app/
├── services/
│   ├── candidates/   # Go
│   └── interviews/   # TypeScript / Node
├── konfidence/
│   ├── project.yaml
│   ├── landscape.yaml
│   └── registry-credentials.example.yaml
├── vector/
│   ├── vectortemplate.yaml
│   ├── stage.yaml
│   └── vectorpromotionconfig.yaml
├── LICENSE, LICENSES/, REUSE.toml
└── README.md
```

Each service directory holds its own source, Dockerfile, deployment manifests
(Kustomize bundle or Helm chart), OCM descriptor, migration image, and README.

## Deploy it

You need a Kubernetes cluster with Konfidence installed and an HTTPS OCI
registry you can push to and the cluster can pull from (Artifactory, GHCR, ...).

Export three variables before running the scripts:

| Variable            | What it is                                                                 |
| ------------------- | -------------------------------------------------------------------------- |
| `REGISTRY`          | `host/org/repo` prefix the artifacts are published under. **No** `https://`, no trailing `/`. The path must be one you can push to. |
| `REGISTRY_USERNAME` | User for that registry. Step 01 prompts if unset.                          |
| `REGISTRY_PASSWORD` | Password or access token for that user. Step 01 prompts (silently) if unset. |

```bash
export REGISTRY=my-registry.example.com/my-org/example-app
export REGISTRY_USERNAME=my-user
export REGISTRY_PASSWORD=my-token

./hack/01-setup-kind-cluster.sh              # kind + Konfidence + Project/Landscape/credentials/Postgres
./hack/02-pipeline.sh                        # build + publish artifacts (imitates CI)
./hack/03-apply-konfidence-resources.sh      # VectorTemplate + Stage + promotion
./hack/99-teardown.sh                        # remove the app
```

The same `REGISTRY` value is used by all three steps. The scripts publish and
pull images and OCM artifacts under it, e.g. `$REGISTRY/candidates:$VERSION` and
`$REGISTRY//github.com/konfidence-project/example-app/vector`. `VERSION` is
optional and defaults to a unique `0.1.0-<shortsha>` (see [Publishing](#publishing)).

Generic `REGISTRY` examples:

| Registry              | `REGISTRY` value                                  |
| --------------------- | ------------------------------------------------- |
| GitHub Container Reg. | `ghcr.io/my-org/example-app`                      |
| Docker Hub            | `docker.io/my-user/example-app`                   |
| Artifactory           | `my-company.jfrog.io/my-repo/example-app`         |
| Google Artifact Reg.  | `europe-docker.pkg.dev/my-project/my-repo/example-app` |
| AWS ECR               | `123456789.dkr.ecr.eu-central-1.amazonaws.com/example-app` |

> While the required Konfidence fixes are unreleased, run
> `./hack/01_temp_from_local.sh` instead of `01-setup-kind-cluster.sh` — it
> builds Konfidence from sibling checkouts (`../konfidence`, `../kubernetes-landscape-orchestrator`).

Step 01 sets up the *static* resources — a Project (its own `kden-p-*`
namespace), a Landscape (a managed `kden-l-*` namespace) and the app's Postgres —
and creates the registry pull credentials. The cluster pulls artifacts and images
using a single
`registry-credentials` secret (see `konfidence/registry-credentials.example.yaml`);
step 01 creates it from `REGISTRY_USERNAME`/`REGISTRY_PASSWORD` in the three
namespaces that need it (`konfidence-system`, the project ns, the managed ns) and
maps the registry host to it via a `flux-deployer-configuration` ConfigMap.

Step 02 publishes the artifacts (see [Publishing](#publishing)). Step 03 applies
the *runtime* resources — a VectorTemplate, an empty Stage, and a
VectorPromotionConfig that promotes the assembled vector into the Stage.
Konfidence reconciles the rest; the scripts don't deploy the workloads directly.

> No cluster yet? `./hack/01-setup-kind-cluster.sh` spins up a kind cluster and
> installs Konfidence using the official quickstart installer.

## Publishing

Step 02 is the publish pipeline — the same thing CI runs. It is driven by two
variables and nothing else:

| Variable   | Default | Meaning |
| ---------- | ------- | ------- |
| `REGISTRY` | — (required) | OCI repo prefix to publish under, e.g. `ghcr.io/my-org/example-app`. |
| `VERSION`  | `0.1.0-<shortsha>` | Artifact version for images, chart, kustomization and OCM components. A unique value keeps re-runs idempotent (`kden` has no overwrite). |

`hack/02-pipeline.sh` is a thin orchestrator that runs each service's
`services/<svc>/build-and-push.sh`. Each builds and pushes the service +
migration images, publishes the Kustomize bundle (`flux push artifact`) or Helm
chart (`helm push`), and pushes the OCM component with `kden artifact push`.
Credentials come from your `docker login` (a temporary OCM config points at
`~/.docker/config.json`; `~/.ocmconfig` is left untouched).

Run it against your own registry:

```bash
docker login my-registry.example.com
REGISTRY=my-registry.example.com/my-org/example-app ./hack/02-pipeline.sh
```

Or in CI: the `Publish` workflow (`.github/workflows/publish.yaml`,
`workflow_dispatch`) publishes to `ghcr.io/<owner>/example-app` using the repo's
`GITHUB_TOKEN`, with `VERSION=0.1.0-<shortsha>`.

## Notes

- **Service-to-service discovery** — `interviews` resolves the `candidates`
  address from the vector's deployment results (`X-Vector-ID` →
  vector-data-service), so no address is hardcoded. Needs the platform's
  vector-data-service (feature toggles read from it too).
- **`X-Vector-ID` header name is configurable, not fixed** — set via
  `VECTOR_ID_HEADER` because the propagation contract isn't finalized:
  [konfidence-project#293](https://github.com/konfidence-project/konfidence-project/issues/293).
  Once fixed we can rely on the canonical name.

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
