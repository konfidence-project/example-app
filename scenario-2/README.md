### Scenario 2: Multi-Stage Deployment with Artifact Reuse

**Goal**: Demonstrate artifact reuse across multiple stages, where multiple vectors share common artifacts (productpage, details) while using different versions of other services (reviews:v1 vs reviews:v2).

#### Setup

##### Prerequisites

- Make sure the common prerequisites are met: [common prerequisites](../README.md#prerequisites)
- Vector 1 from scenario 1 is deployed and running

##### Manual Setup (Step-by-Step)

##### Step 1: Verify Kustomizations in OCI Registry

Verify that a `v1.0.0` kustomization is pushed for each bookinfo microservice:

```bash
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/details
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/ratings
# Expected: v1.0.0

oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews
# Expected: v2.0.0
```

##### Step 2: Build and Push Vector OCM

Build and push the vector that composes the three service components:

```bash
# build and push componentversion for scenario-2 vector
make scenario-2
```

**What this does:**

- Creates a CTF archive for the vector component
- Vector references productpage, details, reviews and ratings components
- Transfers the vector definition to the registry

##### Step 3: Verify OCM Components in OCI Registry

Verify that the OCM ComponentVersions of all artifacts of the vector are correctly pushed to the OCI registry:

```bash
ocm check componentversion https://konfidence.common.repositories.cloud.sap/example-app-tests//github.com/konfidence-project/bookinfo/vector-2
# Expected output:
# COMPONENT                                       VERSION STATUS ERROR
# github.com/konfidence-project/bookinfo/vector-2 v1.0.0  OK   
```

This checks all components of the vector recursively. It will report if any referenced component is missing.
Please check the [common prerequisites](../README.md#prerequisites) to ensure all required components are available in the registry.

##### Step 4: Deploy Second Stage to Konfidence

Deploy a second stage (dev-2) that uses vector-2. The Stage resource is managed via GitOps and is located in
the [gitops-showroom repository](https://github.com/konfidence-project/gitops-showroom/blob/main/clusters/msp03-kden-showroom/example-app/dev-stage.yaml)

**Stage definition:**
```yaml
apiVersion: common.konfidence.cloud/v1alpha1
kind: Stage
metadata:
  name: dev-2
  namespace: bookinfo-dev
spec:
  name: dev
  vector: "konfidence.common.repositories.cloud.sap/example-app-tests//github.com/konfidence-project/bookinfo/vector-2:v1.0.0"
```

**Monitor deployment:**
```bash
# Watch Konfidence resources
kubectl get stages -n bookinfo-dev
kubectl get stageversions -n bookinfo-dev
kubectl get vectordeployments -n bookinfo-dev
kubectl get artifactdeployments -n bookinfo-dev
# Watch application pods
kubectl get pods -n bookinfo-dev
```

#### Expected Results

**Konfidence Resources Created:**

- 2 Stages: `dev` and `dev-2` (both in namespace `bookinfo-dev`)
- 2 StageVersions: `stage-version-dev-<unique-id>` and `stage-version-dev-2-<unique-id>`
- 2 VectorDeployments:
  - `github.com.konfidence-project.bookinfo.vector-1-v1.0.0`
  - `github.com.konfidence-project.bookinfo.vector-2-v1.0.0`
- 4 ArtifactDeployments (demonstrating reuse):
  - `productpage-kustomization` (shared by both vectors - owned by both VectorDeployments)
  - `details-kustomization` (shared by both vectors - owned by both VectorDeployments)
  - `reviews-v1-kustomization` (owned by vector-1 only)
  - `reviews-v2-kustomization` (owned by vector-2 only)

**Flux Resources Created:**

- 4 OciRepositories:
  - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/details-v1`
  - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage-v1`
  - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews-v1`
  - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews-v2`
- 4 Kustomizations:
  - `details-kustomization-<hash>`
  - `productpage-kustomization-<hash>`
  - `reviews-kustomization-<hash>` (for reviews-v1)
  - `reviews-kustomization-<hash>` (for reviews-v2)

**Application Resources Created:**

- Namespace: `bookinfo-dev` (shared by both stages)
- 4 Deployments:
  - `productpage-v1-<hash>` (shared by both vectors)
  - `details-v1-<hash>` (shared by both vectors)
  - `reviews-v1-<hash>` (from vector-1)
  - `reviews-v2-<hash>` (from vector-2)
- 4 Services:
  - `productpage-<hash>`
  - `details-<hash>`
  - `reviews-<hash>` (for reviews-v1)
  - `reviews-<hash>` (for reviews-v2)
- 4 ServiceAccounts:
  - `bookinfo-productpage-<hash>`
  - `bookinfo-details-<hash>`
  - `bookinfo-reviews-<hash>` (for reviews-v1)
  - `bookinfo-reviews-<hash>` (for reviews-v2)
- 4 Pods (1 per deployment)

#### Key Konfidence Concepts Demonstrated

- Everything from Scenario 1
- **Artifact Reuse**: Multiple vectors (vector-1 and vector-2) share the same artifact deployments for `productpage` and `details` components, but use different versions of the `reviews` component (`reviews:v1` vs `reviews:v2`). By reusing artifacts, Konfidence reduces resource consumption in the cluster.
- **Multi-Stage Deployment**: Two stages (`dev` and `dev-2`) can coexist in the same namespace, each deploying different vector configurations.
- **Vector Header Forwarding**: The `x-vector-id` header is automatically forwarded between services, enabling proper vector-based routing across the service mesh. Each vector has a unique vector ID that is used for routing:
  - Vector-1: `github.com.konfidence-project.bookinfo.vector-1-v1.0.0`
  - Vector-2: `github.com.konfidence-project.bookinfo.vector-2-v1.0.0`
