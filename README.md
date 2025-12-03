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

This repository contains a copy of the Istio Bookinfo application source code, which has been modified to support Konfidence-specific features. The original source code was copied from the Istio project and adapted for use with Konfidence.


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
> ![Bookinfo Architecture](https://istio.io/latest/docs/examples/bookinfo/noistio.svg)

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
*   **Vector ID Header Forwarding**: The service forwards the `x-vector-id` header (configurable via `VECTOR_ID_HEADER` environment variable) to downstream services to enable vector-based routing in Konfidence.
*   **Enhanced Logging**: All incoming request headers are logged to stdout for debugging and verification of header propagation.
* **Source Code:** 
    * Original: [https://github.com/istio/istio/tree/master/samples/bookinfo/src/productpage](https://github.com/istio/istio/tree/master/samples/bookinfo/src/productpage)
    * Modified: [`app-source/productpage/productpage.py`](app-source/productpage/productpage.py) - Added `x-vector-id` header forwarding in `getForwardHeaders()` function (lines 203-206) and enhanced request header logging in `log_request_headers()` function (lines 125-134).

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
    *   `VECTOR_ID_HEADER`: Configurable header name for vector ID forwarding (defaults to `x-vector-id`).
*   **Vector ID Header Forwarding**: The service forwards the `x-vector-id` header to external services when making outbound requests, enabling vector-based routing in Konfidence.
*   **Enhanced Logging**: All incoming request headers are logged to stdout for debugging and verification of header propagation.
* **Source Code**: 
    * Original: [https://github.com/istio/istio/tree/master/samples/bookinfo/src/details](https://github.com/istio/istio/tree/master/samples/bookinfo/src/details)
    * Modified: [`app-source/details/details.rb`](app-source/details/details.rb) - Added `x-vector-id` header forwarding in `get_forward_headers()` function (lines 213-215) and enhanced request header logging in `log_request_headers()` function (lines 36-45).
    * **Kustomization**: [`scenario-1/manifests/kustomizations/details-v1/`](scenario-1/manifests/kustomizations/details-v1/)
    * **OCM Component**: [`scenario-1/ocm/components/details-v1/`](scenario-1/ocm/components/details-v1/)  

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
    *   `VECTOR_ID_HEADER`: Configurable header name for vector ID forwarding (defaults to `x-vector-id`).
*   **Vector ID Header Forwarding**: The service forwards the `x-vector-id` header to the `ratings` service when making outbound requests, enabling vector-based routing in Konfidence.
*   **Enhanced Logging**: All incoming request headers are logged to stdout via a `RequestHeaderLoggingFilter` for debugging and verification of header propagation.
* **Source Code**: 
    * Original: [https://github.com/istio/istio/tree/master/samples/bookinfo/src/reviews](https://github.com/istio/istio/tree/master/samples/bookinfo/src/reviews)
    * Modified: [`app-source/reviews/reviews-application/src/main/java/application/rest/LibertyRestEndpoint.java`](app-source/reviews/reviews-application/src/main/java/application/rest/LibertyRestEndpoint.java) - Added `x-vector-id` header forwarding in `getRatings()` method (lines 177-181) and enhanced request header logging via `RequestHeaderLoggingFilter` class (lines 40-51).
    * **Kustomization (v1)**: [`scenario-1/manifests/kustomizations/reviews-v1/`](scenario-1/manifests/kustomizations/reviews-v1/)
    * **OCM Component (v1)**: [`scenario-1/ocm/components/reviews-v1/`](scenario-1/ocm/components/reviews-v1/)
    * **Kustomization (v2)**: [`scenario-2/manifests/kustomizations/reviews-v2/`](scenario-2/manifests/kustomizations/reviews-v2/)
    * **OCM Component (v2)**: [`scenario-2/ocm/components/reviews-v2/`](scenario-2/ocm/components/reviews-v2/)

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
*   **Enhanced Logging**: All incoming request headers are logged to stdout for debugging and verification of header propagation.
* **Source Code**: 
    * Original: [https://github.com/istio/istio/tree/master/samples/bookinfo/src/ratings](https://github.com/istio/istio/tree/master/samples/bookinfo/src/ratings)
    * Modified: [`app-source/ratings/ratings.js`](app-source/ratings/ratings.js) - Added enhanced request header logging in `logRequestHeaders()` function (lines 252-262).


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

##### Manual Setup (Step-by-Step)

##### Step 1: Build and Push Scenario 1 Components

Use the scenario-specific build script to push kustomizations, build OCM components, and push the vector:

```bash
# Navigate to scenario-1 directory
cd scenario-1

# Run the build script
./build.sh
```

**What the build script does:**

1. **Pushes Kustomizations to OCI Registry**: Pushes each microservice's kustomization directory as an OCI artifact:
   - `productpage-v1:v0.0.3`
   - `details-v1:v0.0.3`
   - `reviews-v1:v0.0.3`

2. **Builds and Pushes OCM Components**: Creates CTF archives for each component and transfers them to the registry

3. **Builds and Pushes Vector**: Creates CTF archive for vector-1 and transfers it to the registry

**Verify:**
```bash
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage-v1
# Expected: v0.0.3
```

> With the current implementation of OCM, `latest` versions are not supported.

**Manual Steps (Alternative to build script):**

If you prefer to run the steps manually:

```bash
# Navigate to scenario-1 directory
cd scenario-1

# Step 1: Push kustomizations
cd manifests/kustomizations
oras push konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/productpage-v1:v0.0.3 \
  ./productpage-v1/ \
  --artifact-type application/vnd.kustomize.config.v1+yaml
oras push konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/details-v1:v0.0.3 \
  ./details-v1/ \
  --artifact-type application/vnd.kustomize.config.v1+yaml
oras push konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews-v1:v0.0.3 \
  ./reviews-v1/ \
  --artifact-type application/vnd.kustomize.config.v1+yaml

# Step 2: Build and push OCM components
cd ../../ocm
mkdir -p ocm-transfer
ocm add componentversions --create --file ocm-transfer/productpage components/productpage-v1/component.yaml
ocm add componentversions --create --file ocm-transfer/details components/details-v1/component.yaml
ocm add componentversions --create --file ocm-transfer/reviews components/reviews-v1/component.yaml
ocm transfer ctf ocm-transfer/productpage konfidence.common.repositories.cloud.sap/example-app-tests --overwrite
ocm transfer ctf ocm-transfer/details konfidence.common.repositories.cloud.sap/example-app-tests --overwrite
ocm transfer ctf ocm-transfer/reviews konfidence.common.repositories.cloud.sap/example-app-tests --overwrite

# Step 3: Build and push vector
ocm add componentversions --create --file ocm-transfer/vector-1 vectors/vector-1/component.yaml
ocm transfer ctf ocm-transfer/vector-1 konfidence.common.repositories.cloud.sap/example-app-tests --overwrite
```

**What this does:**

- Creates CTF (Common Transport Format) archives for each component
- Packages the `konfidence-manifest` (manifest.json) as an OCM resource
- Creates references to the kustomization OCI artifacts (from Step 1)
- Transfers CTF archives to the registry with `--overwrite` for easy re-deployment

> Documentation on creating and storing component versions can be found (here)[https://ocm.software/docs/getting-started/create-component-version/#add-component-version-to-ctf-archive] 

**What the build script does:**

- Creates CTF (Common Transport Format) archives for each component
- Packages the `konfidence-manifest` (manifest.json) as an OCM resource
- Creates references to the kustomization OCI artifacts
- Transfers CTF archives to the registry with `--overwrite` for easy re-deployment
- Creates a CTF archive for the vector component
- Vector references productpage, details, and reviews components
- Transfers the vector definition to the registry

> Documentation on creating and storing component versions can be found (here)[https://ocm.software/docs/getting-started/create-component-version/#add-component-version-to-ctf-archive]

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

**Note:** The component versions referenced in the vector are:
- `github.com/konfidence-project/bookinfo/productpage:v1`
- `github.com/konfidence-project/bookinfo/details:v1`
- `github.com/konfidence-project/bookinfo/reviews:v1`
- Vector version: `github.com/konfidence-project/bookinfo/vector-1:v1.0.2`

##### Step 4: Deploy Stage to Konfidence

The Stage and Namespace resources are managed via GitOps and are located in the [gitops-showroom repository](https://github.com/konfidence-project/gitops-showroom/blob/main/clusters/msp03-kden-showroom/example-app/dev-stage.yaml). The GitOps repository is automatically reconciled inside the showroom cluster, so any changes to the deployment configuration should be made directly in the GitOps repository. The reconciliation process will automatically apply the changes to the cluster.

For manual deployment (if not using GitOps reconciliation), you can apply the Stage resource directly:

```bash
# Apply the Stage from the GitOps repository (manual deployment)
kubectl apply -f https://raw.githubusercontent.com/konfidence-project/gitops-showroom/main/clusters/msp03-kden-showroom/example-app/dev-stage.yaml
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
  vector: "konfidence.common.repositories.cloud.sap/example-app-tests//github.com/konfidence-project/bookinfo/vector-1:v1.0.2"
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

---

### Scenario 2: Multi-Stage Deployment with Vector Reuse

**Goal**: Demonstrate vector and artifact reuse across multiple stages, where multiple vectors share common artifacts (productpage, details) while using different versions of other services (reviews-v1 vs reviews-v2).

**Prerequisites**: Vector 1 already deployed to dev stage (from Scenario 1)

#### Setup

##### Prerequisites

- All prerequisites from Scenario 1
- Vector 1 (v1.0.2) already deployed and running
- Access to OCI registry: `konfidence.common.repositories.cloud.sap`
- ORAS CLI installed
- OCM CLI installed

##### Manual Setup (Step-by-Step)

##### Step 1: Build and Push Scenario 2 Components

Use the scenario-specific build script to push kustomizations, build OCM components, and push the vector:

```bash
# Navigate to scenario-2 directory
cd scenario-2

# Run the build script
./build.sh
```

**What the build script does:**

1. **Pushes Reviews-v2 Kustomization to OCI Registry**: Pushes the reviews-v2 kustomization directory as an OCI artifact (`reviews-v2:v0.0.1`)

2. **Builds and Pushes Reviews-v2 OCM Component**: Creates CTF archive for reviews-v2 component and transfers it to the registry

3. **Builds and Pushes Vector-2**: Creates CTF archive for vector-2 and transfers it to the registry

**Verify:**
```bash
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews-v2
# Expected: v0.0.1
```

**Manual Steps (Alternative to build script):**

If you prefer to run the steps manually:

```bash
# Navigate to scenario-2 directory
cd scenario-2

# Step 1: Push reviews-v2 kustomization
cd manifests/kustomizations
oras push konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/reviews-v2:v0.0.1 \
  ./reviews-v2/ \
  --artifact-type application/vnd.kustomize.config.v1+yaml

# Step 2: Build and push reviews-v2 OCM component
cd ../../ocm
mkdir -p ocm-transfer
ocm add componentversions --create --file ocm-transfer/reviews-v2 components/reviews-v2/component.yaml
ocm transfer ctf ocm-transfer/reviews-v2 konfidence.common.repositories.cloud.sap/example-app-tests --overwrite

# Step 3: Build and push vector-2
ocm add componentversions --create --file ocm-transfer/vector-2 vectors/vector-2/component.yaml
ocm transfer ctf ocm-transfer/vector-2 konfidence.common.repositories.cloud.sap/example-app-tests --overwrite
```

**What this does:**

- Creates a CTF archive for the vector-2 component
- Vector-2 references:
  - `productpage:v1` (shared with vector-1)
  - `details:v1` (shared with vector-1)
  - `reviews:v2` (different from vector-1 which uses reviews:v1)
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
# - component-descriptors/github.com/konfidence-project/bookinfo/vector-2
# - kustomizations/details-v1
# - kustomizations/productpage-v1
# - kustomizations/reviews-v1
# - kustomizations/reviews-v2
```

**Note:** The component versions referenced in vector-2 are:
- `github.com/konfidence-project/bookinfo/productpage:v1` (shared with vector-1)
- `github.com/konfidence-project/bookinfo/details:v1` (shared with vector-1)
- `github.com/konfidence-project/bookinfo/reviews:v2` (different from vector-1)
- Vector version: `github.com/konfidence-project/bookinfo/vector-2:v1.0.0`

##### Step 4: Deploy Second Stage to Konfidence

Deploy a second stage (dev-2) that uses vector-2. The Stage resource can be managed via GitOps or applied manually:

```bash
# Apply the Stage from the GitOps repository (manual deployment)
kubectl apply -f https://raw.githubusercontent.com/konfidence-project/gitops-showroom/main/clusters/msp03-kden-showroom/example-app/dev-stage-2.yaml
```

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
  - `github.com.konfidence-project.bookinfo.vector-1-v1.0.2`
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

- Everything from Scenario 1 +
- **Artifact Reuse**: Multiple vectors (vector-1 and vector-2) share the same artifact deployments for `productpage` and `details` components. This is demonstrated by the fact that these ArtifactDeployments have multiple owner references (one for each VectorDeployment).
- **Vector Reuse**: Both vectors reference the same component versions (`productpage:v1` and `details:v1`), but use different versions of the `reviews` component (`reviews:v1` vs `reviews:v2`).
- **Multi-Stage Deployment**: Two stages (`dev` and `dev-2`) can coexist in the same namespace, each deploying different vector configurations.
- **Vector Header Forwarding**: The `x-vector-id` header is automatically forwarded between services, enabling proper vector-based routing across the service mesh. Each vector has a unique vector ID that is used for routing:
  - Vector-1: `11234567-89ab-cdef-0123-456789abcdef`
  - Vector-2: `67fca383-6d2c-493a-b2be-dc80ecca82f8`
- **Resource Efficiency**: By reusing artifacts, Konfidence avoids duplicate deployments of shared components, reducing resource consumption and simplifying management.


### Scenario 3: MySQL Database Schema Migration

**Goal**: Demonstrate a simple database schema migration using Konfidence's task engine. This scenario shows how to add a `created_at` timestamp column to the ratings table using migration tasks that run before the application deployment.

**Prerequisites**: 
- All prerequisites from Scenario 1
- Vector 1 and Vector 2 already deployed (optional, but demonstrates component reuse)

#### Setup

##### Prerequisites

- All prerequisites from Scenario 1
- Access to OCI registry: `konfidence.common.repositories.cloud.sap`
- ORAS CLI installed
- OCM CLI installed
- Kubernetes cluster with Konfidence installed
- kubectl configured

##### Step 1: Build and Push Scenario 3 Components

Use the scenario-specific build script to push kustomizations, build OCM components (including task manifests), and push the vector:

```bash
# Navigate to scenario-3 directory
cd scenario-3

# Run the build script
./build.sh
```

**What the build script does:**

1. **Pushes Kustomizations to OCI Registry**: Pushes each kustomization directory as an OCI artifact:
   - `mysqldb-v1:v0.0.1`
   - `ratings-v2-mysql:v0.0.1`

2. **Builds and Pushes OCM Components**: Creates CTF archives for each component (including task manifests) and transfers them to the registry

3. **Builds and Pushes Vector-3**: Creates CTF archive for vector-3 and transfers it to the registry

**Verify:**
```bash
oras repo tags konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/mysqldb-v1
# Expected: v0.0.1
```

##### Step 2: Deploy Stage to Konfidence

The Stage resource should be created in the GitOps repository or applied manually:

```bash
# Apply the Stage (manual deployment)
kubectl apply -f - <<EOF
apiVersion: common.konfidence.cloud/v1alpha1
kind: Stage
metadata:
  name: dev-3
  namespace: bookinfo-dev
spec:
  name: dev-3
  vector: "konfidence.common.repositories.cloud.sap/example-app-tests//github.com/konfidence-project/bookinfo/vector-3:v1.0.0"
EOF
```

**Monitor deployment:**
```bash
# Watch Konfidence resources
kubectl get stages -n bookinfo-dev
kubectl get stageversions -n bookinfo-dev
kubectl get vectordeployments -n bookinfo-dev
kubectl get artifactdeployments -n bookinfo-dev
kubectl get vectormigrations -n bookinfo-dev
kubectl get taskexecutions -n bookinfo-dev
# Watch application pods
kubectl get pods -n bookinfo-dev
```

#### Expected Results

**Konfidence Resources Created:**

- 1 Stage: `dev-3` (in namespace `bookinfo-dev`)
- 1 StageVersion: `stage-version-dev-3-<unique-id>`
- 1 VectorDeployment: `github.com.konfidence-project.bookinfo.vector-3-v1.0.0`
- 5 ArtifactDeployments:
  - `productpage-kustomization` (reused from scenario-1)
  - `details-kustomization` (reused from scenario-1)
  - `reviews-kustomization` (reused from scenario-2)
  - `mysqldb-kustomization` (new)
  - `ratings-v2-mysql-kustomization` (new, with migration tasks)
- 1 VectorMigration: Created after all artifacts are deployed
- 3 TaskExecutions:
  - `verify-mysql-ready` - Verifies MySQL is accessible
  - `run-schema-migration` - Adds `created_at` column to ratings table
  - `verify-migration` - Verifies the migration was successful

**Flux Resources Created:**

- 2 new OciRepositories:
  - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/mysqldb-v1`
  - `oci://konfidence.common.repositories.cloud.sap/example-app-tests/kustomizations/ratings-v2-mysql`
- 2 new Kustomizations:
  - `mysqldb-kustomization-<hash>`
  - `ratings-v2-mysql-kustomization-<hash>`

**Application Resources Created:**

- 2 new Deployments:
  - `mysqldb-v1-<hash>`
  - `ratings-v2-mysql-<hash>`
- 2 new Services:
  - `mysqldb-<hash>`
  - `ratings-<hash>`
- 1 new ConfigMap:
  - `mysql-init-script-<hash>` (contains database initialization SQL)

**Migration Tasks:**

The migration tasks run in the following order:

1. **verify-mysql-ready**: Uses `mysqladmin ping` to verify MySQL is accessible
2. **run-schema-migration**: Executes SQL to add `created_at` column (idempotent - checks if column exists first)
3. **verify-migration**: Verifies the `created_at` column exists in the database

#### Migration Details

**Base Schema** (from MySQL init script):
```sql
CREATE TABLE `ratings` (
  `ReviewID` INT NOT NULL,
  `Rating` INT,
  PRIMARY KEY (`ReviewID`)
);
```

**Migration** (adds timestamp column):
```sql
ALTER TABLE test.ratings 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

**Idempotency**: The migration task checks if the column exists before adding it, making it safe to re-run.

#### Key Konfidence Concepts Demonstrated

- Everything from Scenario 1 + 2
- **Task Orchestration**: Migration tasks are defined in the OCM component and executed automatically during the migration phase
- **Task Dependencies**: Tasks have explicit dependencies (`dependsOn`) ensuring correct execution order
- **Idempotent Migrations**: Migration tasks are designed to be safe to re-run
- **Database Migration Pattern**: Demonstrates a real-world pattern for schema migrations using Kubernetes Jobs
- **Component Reuse**: Vector-3 reuses components from scenario-1 (productpage, details) and scenario-2 (reviews)
- **Multi-Phase Deployment**: Deployment → Migration → Activation workflow
- **Migration Example**: Vector migration with database deployment and data migration tasks
