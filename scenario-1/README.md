### Scenario 1: Basic Vector Deployment

**Goal**: Baseline deployment with reviews-v1, demonstrating ingress and internal routing.

#### Setup

##### Prerequisites

- Make sure the common prerequisites are met: [common prerequisites](../README.md#prerequisites)

##### Manual Setup (Step-by-Step)

##### Step 1: Verify Kustomizations in OCI Registry

Verify that a `v1.0.0` kustomization is pushed for each bookinfo microservice:

```bash
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/details
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews
# Expected: v1.0.0
```

##### Step 2: Build and Push Vector OCM

Build and push the vector that composes the three service components:

```bash
# build and push componentversion for scenario-1 vector
make scenario-1 
```

**What this does:**

- Creates a CTF archive for the vector component
- Vector references productpage, details, and reviews components
- Transfers the vector definition to the registry

##### Step 3: Verify OCM Components in OCI Registry

Verify that the OCM ComponentVersions of all artifacts of the vector are correctly pushed to the OCI registry:

```bash
ocm check componentversion https://konfidence.common.repositories.cloud.sap/example-app-tests//github.com/konfidence-project/bookinfo/vector-1
# Expected output:
# COMPONENT                                       VERSION STATUS ERROR
# github.com/konfidence-project/bookinfo/vector-1 v1.0.0  OK   
```

This checks all components of the vector recursively. It will report if any referenced component is missing.
Please check the [common prerequisites](../README.md#prerequisites) to ensure all required components are available in the registry.

##### Step 4: Deploy Stage to Konfidence

The Stage and Namespace resources are managed via GitOps and are located in
the [gitops-showroom repository](https://github.com/konfidence-project/gitops-showroom/blob/main/clusters/msp03-kden-showroom/example-app/dev-stage.yaml).
The GitOps repository is automatically reconciled inside the showroom cluster, so any changes to the deployment
configuration should be made directly in the GitOps repository. The reconciliation process will automatically apply the
changes to the cluster.

**Stage definition:**

```yaml
apiVersion: common.konfidence.cloud/v1alpha1
kind: Stage
metadata:
  name: dev
  namespace: bookinfo-dev
spec:
  name: dev
  vector: "konfidence.common.repositories.cloud.sap/example-app-tests//github.com/konfidence-project/bookinfo/vector-1:v1.0.0"
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

- 1 Stage: `bookinfo-dev`
- 1 StageVersion: `stage-version-dev-<unique-id>`
- 1 VectorDeployment: `github.com.konfidence-project.bookinfo.vector-1-v1.0.2`
- 3 ArtifactDeployments referencing:
    - `reviews-kustomization`
    - `productpage-kustomization`
    - `details-kustomization`

**Flux Resources Created:**

- 3 OciRepositories:
    - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/details-v1`
    - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage-v1`
    - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews-v1`
- 3 Kustomizations:
    - `reviews-kustomization`
    - `productpage-kustomization`
    - `details-kustomization`

**Application Resources Created:**

- Namespace: `bookinfo-dev`
- 3 Deployments: `productpage-v1`, `details-v1`, `reviews-v1`
- 3 Services: `productpage`, `details`, `reviews`
- 3 ServiceAccounts: `bookinfo-productpage`, `bookinfo-details`, `bookinfo-reviews`
- 3 Pods (1 per deployment)

#### Key Konfidence Concepts Demonstrated

- Stage and StageVersion lifecycle
- VectorDeployment and OCM integration
- ArtifactDeployment creation and management
- Multi-phase deployment (Fetch → Deploy → Health)
- Multi-registry support: Kustomizations from SAP registry, images from Docker Hub
- Resource composition: Vector composes multiple service components
- North-south and east-west traffic verification