# Example App

The example app showcases the capabilities of Konfidence. 

## Requirements

The example app should showcase following konfidence features:

- **service to service communication**: The App should consist of multiple services that communicate with each other showcasing east-west service communication.
- **external service communication**: The App should include some kind of (frontend) service which allows calling from outside the cluster showcasing north-south traffic.
- **vector reuse**: The App should include some variation of microservices with multiple vectors demonstrating the reuse of vectors
- **migration examples**: The App should include a migration example
- **forwarding of vector headers**: The App should showcase, that vector headers get forwarded between services.

Other considerations of the example app:

- **maintainability**: Preferably, we can reuse an existing app and don't have to maintain the source code ourselves
- **multiple programming languages / forwarded**: The App should include services written in multiple programming languages to showcase the interoperability of Konfidence.


## Implementation - Istio Bookinfo Application

Istio uses a bookinfo application, which we also can use as an example for konfidence.


Description from the Istio Documentation:

> The application displays information about a book, similar to a single catalog entry of an online book store. Displayed on the page is a description of the book, book details (ISBN, number of pages, and so on), and a few book reviews.
>
> The Bookinfo application is broken into four separate microservices:
>
>    - **productpage**. The productpage microservice calls the details and reviews microservices to populate the page.
>    - **details**. The details microservice contains book information.
>    - **reviews**. The reviews microservice contains book reviews. It also calls the ratings microservice.
>    - **ratings**. The ratings microservice contains book ranking information that accompanies a book review.
>
> There are 3 versions of the reviews microservice:
>
>    * Version v1 doesn’t call the ratings service.
>    * Version v2 calls the ratings service, and displays each rating as 1 to 5 black stars.
>    * Version v3 calls the ratings service, and displays each rating as 1 to 5 red stars.
>
> The end-to-end architecture of the application is shown below:
>
> ![Bookinfo Architecture](./istio-bookinfo-application-architecture.svg)

copied from [https://istio.io/latest/docs/examples/bookinfo/](https://istio.io/latest/docs/examples/bookinfo/)


### Services in details

The Services consist of the following 4 applications. Each version is actually the same source code, but the behavior is different based on the version and environment. All applications are build with a similar

#### ProductPage Service

This is the primary user-facing service and the main entry point of the application. It acts as an aggregator, dynamically generating a webpage by fetching data from the `details` and `reviews` services. It is heavily instrumented with OpenTelemetry to propagate tracing headers, making it "service-mesh aware."

*   **Language/Framework**: Python (Flask)
*   **Inputs**:
    *   Accepts inbound HTTP requests from end-users (north-south traffic) on endpoints like `/productpage`.
    *   Listens on port `9080`.
    *   Reads a wide range of tracing headers (`x-b3-*`, `x-request-id`, `traceparent`, etc.) and user context headers (`cookie`, `end-user`).
*   **Outputs**:
    *   Makes outbound HTTP GET requests to `http://details:9080/details/{product_id}`.
    *   Makes outbound HTTP GET requests to `http://reviews:9080/reviews/{product_id}`.
    *   Returns an HTML webpage to the end-user.
    *   Exposes a `/metrics` endpoint for Prometheus scraping.
*   **Environment Variables**: Configurable hostnames and ports for downstream services (`DETAILS_HOSTNAME`, `REVIEWS_HOSTNAME`, etc.).
* **Source Code:** [https://github.com/istio/istio/tree/master/samples/bookinfo/src/productpage](https://github.com/istio/istio/tree/master/samples/bookinfo/src/productpage)

#### Details Service

A microservice that provides book metadata. It can operate in two modes: returning static, hardcoded data, or calling an external public API to fetch live book details. This makes it a great example for both internal and external (egress) traffic.

*   **Language/Framework**: Ruby (WEBrick)
*   **Inputs**:
    *   Accepts inbound HTTP GET requests on `/details/{product_id}` from the `productpage` service.
    *   Accepts inbound HTTP GET requests on `/health`.
    *   Listens on port `9080`.
*   **Outputs**:
    *   By default, returns a hardcoded JSON object with book details.
    *   If `ENABLE_EXTERNAL_BOOK_SERVICE=true`, it makes an outbound HTTPS/HTTP request to `www.googleapis.com` to fetch real data.
    *   Example response:
        ~~~json
        {
          "id": 0,
          "author": "William Shakespeare",
          "year": 1595,
          "type": "paperback",
          "pages": 200,
          "publisher": "PublisherA",
          "language": "English",
          "ISBN-10": "1234567890",
          "ISBN-13": "123-1234567890"
        }
        ~~~
*   **Environment Variables**:
    *   `ENABLE_EXTERNAL_BOOK_SERVICE`: If set to `"true"`, the service will call the external Google Books API.
    *   `DO_NOT_ENCRYPT`: If set to `"true"`, the external API call will use HTTP instead of HTTPS.
* **Source Code**: [https://github.com/istio/istio/tree/master/samples/bookinfo/src/details](https://github.com/istio/istio/tree/master/samples/bookinfo/src/details)  

#### Reviews Service

This service provides book review information and is the primary component for demonstrating version-based routing. The same application code can be configured to behave like `v1`, `v2`, or `v3` using environment variables.

*   **Language/Framework**: Java (JAX-RS using Open Liberty)
*   **Inputs**:
    *   Accepts inbound HTTP GET requests on `/reviews/{product_id}` from the `productpage` service.
    *   Accepts inbound HTTP GET requests on `/health`.
    *   Listens on port `9080`.
*   **Outputs**:
    *   Returns a JSON object with review text.
    *   If `ENABLE_RATINGS=true` (for `v2`/`v3`), it makes an outbound HTTP GET request to `http://ratings:9080/ratings/{product_id}`.
    *   The final JSON response includes reviewer text, pod name, cluster name, and optionally star ratings.
*   **Environment Variables**:
    *   `ENABLE_RATINGS`: If `"true"`, the service calls the `ratings` service. If `false` or unset (`v1` behavior), it does not.
    *   `STAR_COLOR`: Sets the color of the rating stars in the JSON response (e.g., `"black"` for `v2`, `"red"` for `v3`). Defaults to `"black"`.
    *   `SERVICES_DOMAIN`, `RATINGS_HOSTNAME`, `RATINGS_SERVICE_PORT`: Configures the downstream `ratings` service URL.
    *   `HOSTNAME`, `CLUSTER_NAME`: Environment variables passed from the Kubernetes Downward API, which are reflected in the service's JSON output for debugging.
* **Source Code**: [https://github.com/istio/istio/tree/master/samples/bookinfo/src/reviews](https://github.com/istio/istio/tree/master/samples/bookinfo/src/reviews)

#### Ratings Service

A backend service providing rating data. This service is highly configurable and has multiple versions designed to showcase database migration, fault injection, and latency testing scenarios.

*   **Language/Framework**: Node.js (httpdispatcher)
*   **Inputs**:
    *   `GET /ratings/{product_id}`: Retrieves ratings.
    *   `POST /ratings/{product_id}`: Adds a new rating (in-memory `v1` only).
    *   `GET /health`: Health check endpoint.
    *   Listens on port `9080`.
*   **Outputs**:
    *   Returns a JSON object with a rating. Example: `{"ratings": {"Reviewer1": 5, "Reviewer2": 4}}`.
    *   Can return HTTP `503` or `500` in fault-injection modes.
*   **Environment Variables**:
    *   `SERVICE_VERSION`: The most critical variable.
        *   `v1` (default): In-memory ratings.
        *   `v2`: Database-backed ratings. Requires DB variables below.
        *   `v-faulty`: Returns a 503 error 50% of the time.
        *   `v-delayed`: Delays the response by 7 seconds 50% of the time.
        *   `v-unavailable`, `v-unhealthy`: Simulates service outages for health checking tests.
    *   `DB_TYPE`: For `v2`, specifies the database. Can be `mysql` or `mongodb` (default).
    *   `MONGO_DB_URL`: For `v2` with MongoDB, the database connection URL.
    *   `MYSQL_DB_HOST`, `MYSQL_DB_PORT`, `MYSQL_DB_USER`, `MYSQL_DB_PASSWORD`: For `v2` with MySQL.
* **Source Code**: [https://github.com/istio/istio/tree/master/samples/bookinfo/src/ratings](https://github.com/istio/istio/tree/master/samples/bookinfo/src/ratings)


#### Database Setup
The `ratings` service is unique within the Bookinfo application because its `v2` version is designed to be a **stateful service** that connects to an external database. This provides a clear example of migrating a service from a simple in-memory store (`v1`) to a persistent, database-backed implementation (`v2`).

The `ratings:v2` service is flexible and supports two different database backends: **MySQL** and **MongoDB**. The choice of which database to use is controlled at runtime via an environment variable.

##### How it Works

1.  **Deployment**: To use `ratings:v2`, you must deploy both the `ratings:v2` application pod and a corresponding database pod (`mysqldb` or `mongodb`) within the cluster.
2.  **Configuration**: The `ratings:v2` service is configured with environment variables to tell it which database to connect to and where to find it.
3.  **Initialization**: The provided database images (`examples-bookinfo-mysqldb` and `examples-bookinfo-mongodb`) are pre-configured with initialization scripts. When the database container starts, it automatically creates the necessary database, table/collection, and seeds it with initial data.

---

##### 1. MySQL Setup

To use the MySQL backend, you configure the `ratings` service to point to a MySQL instance.

*   **Database Service**: A Kubernetes `Deployment` and `Service` for `mysqldb` must be running in the cluster. The provided `examples-bookinfo-mysqldb` container image handles the setup.
*   **Initialization Script (`init.sql`)**:
    *   Creates a database named `test`.
    *   Creates a table named `ratings` with the schema:
        ~~~sql
        CREATE TABLE ratings (RatingID INT, Rating INT);
        ~~~
    *   Inserts two initial rows of data:
        ~~~sql
        INSERT INTO ratings (RatingID, Rating) VALUES (1, 5);
        INSERT INTO ratings (RatingID, Rating) VALUES (2, 4);
        ~~~
* **Application Configuration (`ratings:v2`)**: To connect to this database, the `ratings:v2` deployment must have the following environment variables set:
    *   `DB_TYPE=mysql`
    *   `MYSQL_DB_HOST`: The service name for the MySQL instance (e.g., `mysqldb`).
    *   `MYSQL_DB_PORT`: The port for the MySQL instance (e.g., `3306`).
    *   `MYSQL_DB_USER`: The username for the database.
    *   `MYSQL_DB_PASSWORD`: The password for the database user.

---

##### 2. MongoDB Setup

To use the MongoDB backend, you configure the `ratings` service to point to a MongoDB instance. This is the default behavior if `DB_TYPE` is not set to `mysql`.

*   **Database Service**: A Kubernetes `Deployment` and `Service` for `mongodb` must be running in the cluster. The `examples-bookinfo-mongodb` container image handles the setup.
*   **Initialization Script (`ratings-db.js`)**:
    *   Connects to a database named `test`.
    *   Creates a collection named `ratings`.
    *   Inserts two initial documents:
        ```javascript
        db.ratings.insert({rating: 5});
        db.ratings.insert({rating: 4});
        ```
*  **Application Configuration (`ratings:v2`)**: To connect to this database, the `ratings:v2` deployment must have the following environment variable set:
*   `MONGO_DB_URL`: The full connection string for the MongoDB instance (e.g., `mongodb://mongodb:27017/test`).


### Provided Artifacts

Istio provides pre-built container images for all Bookinfo services.

### Build System Overview

Istio uses Docker Buildx with docker-bake for creating multi-platform container images. The entire process is orchestrated through a single script (`src/build-services.sh`) located in the (samples/bookinfo)[https://github.com/istio/istio/blob/master/samples/bookinfo/src/build-services.sh] directory that handles compilation, containerization, and registry publishing.

### Available OCI Images

Istio maintains official pre-built images on Docker Hub under the `istio` organization. The current stable release (1.20.2) provides:

**Application Services:**

- `docker.io/istio/examples-bookinfo-productpage-v1:1.20.2`
- `docker.io/istio/examples-bookinfo-details-v1:1.20.2`
- `docker.io/istio/examples-bookinfo-reviews-v1:1.20.2`
- `docker.io/istio/examples-bookinfo-reviews-v2:1.20.2`
- `docker.io/istio/examples-bookinfo-reviews-v3:1.20.2`
- `docker.io/istio/examples-bookinfo-ratings-v1:1.20.2`
- `docker.io/istio/examples-bookinfo-ratings-v2:1.20.2`

**Database Services:**

- `docker.io/istio/examples-bookinfo-mysqldb:1.20.2`
- `docker.io/istio/examples-bookinfo-mongodb:1.20.2`

Additional specialized images are available for fault injection testing (`v-faulty`, `v-delayed`, `v-unavailable`, `v-unhealthy`).

### Kubernetes Manifests

Istio provides deployment manifests in `samples/bookinfo/platform/kube/`:

- `bookinfo.yaml`: Main deployment with all services
- `bookinfo-versions.yaml`: Version-specific services for Gateway API
- `bookinfo-gateway.yaml`: Istio Gateway and VirtualService configurations
- `bookinfo-db.yaml`: Database deployment configurations


## Demo Scenarios

These scenarios demonstrate how Bookinfo showcases Konfidence's key features. Each scenario builds upon the previous one to illustrate progressively more complex capabilities.

### Scenario 1: Basic Vector Deployment

**Goal**: Baseline deployment with reviews-v1, demonstrating ingress and internal routing.

#### Setup

##### Prerequisites
- Access to OCI registry: `konfidence.common.repositories.cloud.sap`
- ORAS CLI installed
- OCM CLI installed
- Kubernetes cluster with Konfidence installed
- kubectl configured
- Make (for automated workflow)

##### Quick Start with Makefile

The repository includes a Makefile for automated workflows:

```bash
# Show available commands
make help

# Build OCM components and vector (creates CTF archives)
make build-components

# Push components and vector to OCI registry
make push-components

# Clean build artifacts
make clean

# Build and push everything (complete workflow)
make all
```

**Note:** To use a different registry, set the `REGISTRY` variable:
```bash
make push-components REGISTRY=my-registry.example.com/my-project
```

##### Manual Setup (Step-by-Step)

##### Step 1: Push Kustomizations to OCI Registry

Push each microservice's kustomization directory as an OCI artifact:

```bash
# Navigate to kustomizations directory
cd manifests/kustomizations

# Push productpage kustomization
oras push konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage-v1:v0.0.1 \
  ./productpage-v1/ \
  --artifact-type application/vnd.kustomize.config.v1+yaml

# Push details kustomization
oras push konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/details-v1:v0.0.1 \
  ./details-v1/ \
  --artifact-type application/vnd.kustomize.config.v1+yaml

# Push reviews kustomization
oras push konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews-v1:v0.0.1 \
  ./reviews-v1/ \
  --artifact-type application/vnd.kustomize.config.v1+yaml
```

**Verify:**
```bash
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage-v1
# Expected: v0.0.1
```

> With the current implementation of OCM, `latest` versions are not supported.

##### Step 2: Push OCM Components

Build and push OCM components that reference the kustomizations:

```bash
# Navigate to components directory
cd ../../ocm/components

# Create temporary transfer directory
mkdir -p ocm-transfer

# Add productpage, details and reviews components to CTF
ocm add componentversions --create --file ocm-transfer/productpage productpage-v1/component.yaml
ocm add componentversions --create --file ocm-transfer/details details-v1/component.yaml
ocm add componentversions --create --file ocm-transfer/reviews reviews-v1/component.yaml

# Transfer all components to registry
ocm transfer ctf ocm-transfer/productpage konfidence.common.repositories.cloud.sap/example-app-tests --overwrite
ocm transfer ctf ocm-transfer/details konfidence.common.repositories.cloud.sap/example-app-tests --overwrite
ocm transfer ctf ocm-transfer/reviews konfidence.common.repositories.cloud.sap/example-app-tests --overwrite
```


**What this does:**
- Creates CTF (Common Transport Format) archives for each component
- Packages the `konfidence-manifest` (manifest.json) as an OCM resource
- Creates references to the kustomization OCI artifacts (from Step 1)
- Transfers CTF archives to the registry with `--overwrite` for easy re-deployment

> Documentation on creating and storing component versions can be found (here)[https://ocm.software/docs/getting-started/create-component-version/#add-component-version-to-ctf-archive] 

##### Step 3: Push OCM Vector

Build and push the vector that composes the three service components:

```bash
# Navigate to vectors directory
cd ../vectors

# Create temporary transfer directory
mkdir -p ocm-transfer

# Add vector to CTF
ocm add componentversions --create --file ocm-transfer/vector-1 vector-1/component.yaml

# Transfer vector to registry
ocm transfer ctf ocm-transfer/vector-1 konfidence.common.repositories.cloud.sap/example-app-tests --overwrite
```

**What this does:**
- Creates a CTF archive for the vector component
- Vector references productpage, details, and reviews components
- Transfers the vector definition to the registry

**Verify:**
```bash
# Check all artifacts are in registry
oras repo ls konfidence.common.repositories.cloud.sap/example-app-tests

# Expected output should include:
# - component-descriptors/github.com/konfidence-project/bookinfo/details
# - component-descriptors/github.com/konfidence-project/bookinfo/productpage
# - component-descriptors/github.com/konfidence-project/bookinfo/reviews
# - component-descriptors/github.com/konfidence-project/bookinfo/vector-1
# - kustomizations/details-v1
# - kustomizations/productpage-v1
# - kustomizations/reviews-v1
```

##### Step 4: Deploy Stage to Konfidence

Apply the Stage resource that references the vector:

```bash
# Navigate back to repo root
cd ../..

# Apply the Stage
kubectl apply -f examples/dev-stage.yaml
```

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
- 1 VectorDeployment: `github.com.konfidence-project.bookinfo.vector-1-v1.0.0` 
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

---

### Scenario 2: Multi-Stage Deployment with Vector Reuse

**Goal**: Demonstrate vector and artifact reuse across multiple stages (dev, test, prod)

**Prerequisites**: Vector 1 already deployed to dev stage (from Scenario 1)

**Key Konfidence Concepts Demonstrated**:

- Everything from Scenario 1 +
- **Artifact / Vector Reuse**: Vectors reference shared artifacts (productpage, details, rating, db)
- forwarding of vector headers (?)


### Scenario 3: Vector Migration with Database

**Goal**: Demonstrate the migration phase with database deployment and data migration tasks

**Key Konfidence Concepts Demonstrated**:

- Everything from Scenario 1 + 2
- **Migration Example**: Vector migration with database deployment and data migration tasks
