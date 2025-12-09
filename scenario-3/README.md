### Scenario 3: MySQL Database Schema Migration

**Goal**: Demonstrate a simple database schema migration using Konfidence's task engine. This scenario shows how to add
a `created_at` timestamp column to the ratings table using migration tasks that run before the application deployment.
The MySQL database is provisioned externally via GitOps, demonstrating separation of infrastructure and application
deployment.

#### Setup

##### Prerequisites

- Make sure the common prerequisites are met: [common prerequisites](../README.md#prerequisites)
- Vectors from scenarios 1 and 2 are deployed and running
- MySQL database deployed and running, accessible at `mysqldb:3306` (provisioned via GitOps in
  the [showroom-gitops repo](https://github.com/konfidence-project/gitops-showroom/blob/main/clusters/msp03-kden-showroom/example-app/database.yaml))

##### Manual Setup

##### Step 1: Verify Kustomizations in OCI Registry

Verify that a `v1.0.0` kustomization is pushed for each bookinfo microservice:

```bash
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/details
# Expected: v1.0.0

oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/ratings
# Expected: v2.0.0

oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews
# Expected: v3.0.0
```

##### Step 2: Build and Push Vector OCM

Build and push the vector that composes the three service components:

```bash
# build and push componentversion for scenario-3 vector
make scenario-3
```

**What this does:**

- Creates a CTF archive for the vector component
- Vector-3 references:
    - `productpage:v1` (from scenario-1)
    - `details:v1` (from scenario-1)
    - `reviews:v3` (new)
    - `ratings:v2` (new, with 3 database migration tasks)
- Transfers the vector definition to the registry

##### Step 3: Verify OCM Components in OCI Registry

Verify that the OCM ComponentVersions of all artifacts of the vector are correctly pushed to the OCI registry:

```bash
ocm check componentversion https://konfidence.common.repositories.cloud.sap/example-app-tests//github.com/konfidence-project/bookinfo/vector-3
# Expected output:
# COMPONENT                                       VERSION STATUS ERROR
# github.com/konfidence-project/bookinfo/vector-3 v1.0.0  OK   
```

This checks all components of the vector recursively. It will report if any referenced component is missing.
Please check the [common prerequisites](../README.md#prerequisites) to ensure all required components are available in the registry.

##### Step 4: Deploy Stage to Konfidence

Deploy a second stage (dev-2) that uses vector-2. The Stage resource is managed via GitOps and is located in
the [gitops-showroom repository](https://github.com/konfidence-project/gitops-showroom/blob/main/clusters/msp03-kden-showroom/example-app/dev-stage.yaml)

**Stage definition:**
```yaml
apiVersion: common.konfidence.cloud/v1alpha1
kind: Stage
metadata:
  name: dev-3
  namespace: bookinfo-dev
spec:
  name: dev
  vector: konfidence.common.repositories.cloud.sap/example-app-tests//github.com/konfidence-project/bookinfo/vector-3:v1.0.0
```

**Monitor deployment:**

```bash
# Watch Konfidence resources
kubectl get stages -n bookinfo-dev
kubectl get stageversions -n bookinfo-dev
kubectl get vectordeployments -n bookinfo-dev
kubectl get artifactdeployments -n bookinfo-dev
kubectl get vectormigrations -n bookinfo-dev

# Watch task executions (may be empty if tasks completed and were cleaned up)
kubectl get taskexecutions -n bookinfo-dev

# Watch Kubernetes Jobs created by task executions
kubectl get jobs -n bookinfo-dev

# Watch application pods
kubectl get pods -n bookinfo-dev

# Check VectorMigration status
kubectl get vectormigration stage-version-dev-3-<unique-id>-migration -n bookinfo-dev -o yaml
```

#### Expected Results

**External MySQL Database (Provisioned via GitOps):**

- 1 Deployment: `mysqldb-v1`
- 1 Service: `mysqldb` (accessible at `mysqldb:3306`)
- 1 ConfigMap: `mysql-init-script` (contains database initialization SQL)
- Database initialized with:
    - Database: `test`
    - Table: `ratings` with schema `ReviewID INT NOT NULL, Rating INT, PRIMARY KEY (ReviewID)`
    - Initial data: Two rows with ratings values 5 and 4

**Konfidence Resources Created:**

- 1 Stage: `dev-3` (in namespace `bookinfo-dev`)
- 1 StageVersion: `stage-version-dev-3-<unique-id>` (e.g., `stage-version-dev-3-87ggcfbq`)
- 1 VectorDeployment: `github.com.konfidence-project.bookinfo.vector-3-v1.0.0`
- 4 ArtifactDeployments (named by hash):
    - ArtifactDeployments for all components referenced by vector-3:
        - `productpage-kustomization-<hash>` (reused from scenario-1)
        - `details-kustomization-<hash>` (reused from scenario-1)
        - `reviews-kustomization-<hash>` (reused from scenario-2, reviews-v2)
        - `ratings-v2-mysql-kustomization-<hash>` (new, with migration tasks)
- 1 VectorMigration: `stage-version-dev-3-<unique-id>-migration` (created after all artifacts are deployed, status:
  `VectorMigrationSucceeded`)
- 3 TaskExecutions: Created during the migration phase (may not be visible if tasks completed and were cleaned up):
    - `verify-mysql-ready` - Verifies MySQL is accessible
    - `run-schema-migration` - Adds `created_at` column to ratings table (idempotent)
    - `verify-migration` - Verifies the migration was successful

**Flux Resources Created:**

- 4 OciRepositories for vector-3 components:
    - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/details-v1` (reused)
    - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage-v1` (reused)
    - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews-v2` (reused)
    - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/ratings-v2-mysql` (new)
- 4 Kustomizations (named by hash) for vector-3:
    - `details-kustomization-<hash>` (reused)
    - `productpage-kustomization-<hash>` (reused)
    - `reviews-kustomization-<hash>` (reviews-v2, reused)
    - `ratings-v2-mysql-kustomization-<hash>` (new)

**Application Resources Created:**

- 4 Deployments for vector-3:
    - `productpage-v1-<hash>` (reused from scenario-1)
    - `details-v1-<hash>` (reused from scenario-1)
    - `reviews-v2-<hash>` (reused from scenario-2)
    - `ratings-v2-mysql-<hash>` (new)
- 4 Services for vector-3:
    - `productpage-<hash>` (reused)
    - `details-<hash>` (reused)
    - `reviews-<hash>` (reviews-v2, reused)
    - `ratings-<hash>` (new)

**Migration Tasks:**

The migration tasks run in the following order:

1. **verify-mysql-ready**: Uses `mysqladmin ping` to verify MySQL is accessible
2. **run-schema-migration**: Executes SQL to add `created_at` column (idempotent - checks if column exists first)
3. **verify-migration**: Verifies the `created_at` column exists in the database

**Migration Details:**

**Base Schema** (from MySQL init script):

```sql
CREATE TABLE `ratings`
(
    `ReviewID` INT NOT NULL,
    `Rating`   INT,
    PRIMARY KEY (`ReviewID`)
);
```

**Migration** (adds timestamp column):

```sql
ALTER TABLE test.ratings
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

#### Key Konfidence Concepts Demonstrated

- Everything from Scenario 1 + 2
- **Task Orchestration**: Migration tasks are defined in the OCM component and executed automatically during the migration phase
- **Task Dependencies**: Tasks have explicit dependencies (`dependsOn`) ensuring correct execution order
- **Database Migration Pattern**: Demonstrates a real-world pattern for schema migrations using Kubernetes Jobs
- **External Infrastructure**: MySQL database is provisioned externally via GitOps, demonstrating separation of infrastructure and application deployment
