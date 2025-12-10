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

The `ratings:v2` service supports both **MySQL** and **MongoDB** backends. The choice of which database to use is controlled at runtime via an environment variable.

**Note:** While the original Istio Bookinfo source code includes database setup files, this repository uses a GitOps approach to provision the MySQL database. The database is deployed separately via GitOps in the showroom repository, and the application connects to it using environment variables.

##### How it Works

1.  **Database Deployment**: The MySQL database is provisioned externally via GitOps (see [showroom-gitops repo](https://github.com/konfidence-project/gitops-showroom/blob/main/clusters/msp03-kden-showroom/example-app/database.yaml)). The database initialization is handled by a ConfigMap with SQL scripts.
2.  **Application Configuration**: The `ratings:v2` service is configured with environment variables to connect to the MySQL database:
    *   `DB_TYPE=mysql`
    *   `MYSQL_DB_HOST`: The service name for the MySQL instance (e.g., `mysqldb`).
    *   `MYSQL_DB_PORT`: The port for the MySQL instance (e.g., `3306`).
    *   `MYSQL_DB_USER`: The username for the database.
    *   `MYSQL_DB_PASSWORD`: The password for the database user.
3.  **Database Schema**: The MySQL database is initialized with:
    *   Database named `test`
    *   Table named `ratings` with schema: `ReviewID INT NOT NULL, Rating INT, PRIMARY KEY (ReviewID)`
    *   Initial data: Two rows with ratings values 5 and 4


### Source Code Modifications

The original Istio Bookinfo application source code has been **modified** to support Konfidence-specific features:

1. **Vector ID Header Forwarding**: All services have been updated to forward the `x-vector-id` header to downstream services. This enables vector-based routing in Konfidence.
   - **ProductPage**: Added header forwarding in `getForwardHeaders()` function
   - **Details**: Added header forwarding in `get_forward_headers()` function
   - **Reviews**: Added header forwarding in `getRatings()` method
   - **Ratings**: No downstream calls, but logs incoming headers

2. **Enhanced Logging**: All services have been enhanced to log incoming request headers to stdout for debugging and verification of header propagation.

3. **Custom Images**: Modified images are built and published to Artifactory instead of using Istio's pre-built images.

### Build System Overview

This repository uses Docker Buildx with docker-bake (similar to Istio's approach) for creating multi-platform container images. The build configuration is located in [`app-source/docker-bake.hcl`](app-source/docker-bake.hcl).

**Key differences from Istio's original setup:**
- Removed some service versions (e.g., reviews-v3, details-v2) that are not needed for our scenarios
- Images are built for both `linux/amd64` and `linux/arm64` platforms
- Images are published to Artifactory: `konfidence.common.repositories.cloud.sap/example-app-tests/apps`

**Building Images:**

```bash
cd app-source
docker buildx bake --push
```

This will build and push all images defined in `docker-bake.hcl` to the configured registry.

### Available OCI Images

All images are published to `konfidence.common.repositories.cloud.sap/example-app-tests/apps`:

**Application Services:**

- `konfidence.common.repositories.cloud.sap/example-app-tests/apps/examples-bookinfo-productpage-v1:latest`
- `konfidence.common.repositories.cloud.sap/example-app-tests/apps/examples-bookinfo-details-v1:latest`
- `konfidence.common.repositories.cloud.sap/example-app-tests/apps/examples-bookinfo-reviews-v1:latest`
- `konfidence.common.repositories.cloud.sap/example-app-tests/apps/examples-bookinfo-reviews-v2:latest`
- `konfidence.common.repositories.cloud.sap/example-app-tests/apps/examples-bookinfo-ratings-v1:latest`
- `konfidence.common.repositories.cloud.sap/example-app-tests/apps/examples-bookinfo-ratings-v2:latest`

**Database Services:**

- `konfidence.common.repositories.cloud.sap/example-app-tests/apps/examples-bookinfo-mysqldb:latest`
- `konfidence.common.repositories.cloud.sap/example-app-tests/apps/examples-bookinfo-mongodb:latest`

> **Note**: The original Istio images are available on Docker Hub under `docker.io/istio/examples-bookinfo-*:1.20.2`, but this example application uses the modified versions.

### Alternative Approach: Vector Sidecar

Instead of modifying application source code to forward `x-vector-id` headers, we considered using a **custom sidecar proxy** that automatically propagates vector IDs by correlating them with tracing headers. This approach would eliminate the need for application code changes.

**Vector Sidecar Solution:**

The [vector-sidecar](https://github.com/konfidence-project/vector-sidecar) project provides a lightweight Go-based sidecar that:

- **Zero application code changes**: Works with existing apps that propagate tracing headers (e.g., `x-b3-traceid`, `traceparent`)
- **Automatic header injection**: Correlates incoming `x-vector-id` headers with trace IDs and automatically injects the vector ID into outbound requests
- **Transparent traffic interception**: Uses iptables rules (similar to Istio) to intercept traffic without requiring proxy configuration
- **Lightweight**: ~10-15MB memory footprint per sidecar

**How it works:**

1. **Inbound Request**: Sidecar validates `x-vector-id` header, extracts/generates trace ID, and stores the mapping (trace-id → vector-id)
2. **Outbound Request**: Application includes trace ID (already propagated), sidecar looks up the vector ID and injects `x-vector-id` header

**Why we chose application modifications instead:**

While the sidecar approach requires no code changes, we chose to modify the application source code for this example because vector-header forwarding is an essential requirement of konfidence. 

TODO: add more explanations

See the [vector-sidecar repository](https://github.com/konfidence-project/poc-vector-sidecar) for more details.

### Kubernetes Manifests

Istio provides deployment manifests in `samples/bookinfo/platform/kube/`:

- `bookinfo.yaml`: Main deployment with all services
- `bookinfo-versions.yaml`: Version-specific services for Gateway API
- `bookinfo-gateway.yaml`: Istio Gateway and VirtualService configurations
- `bookinfo-db.yaml`: Database deployment configurations


## Demo Scenarios

These scenarios demonstrate how Bookinfo showcases Konfidence's key features. Each scenario builds upon the previous one to illustrate progressively more complex capabilities.

### Prerequisites

- Access to OCI registry: `konfidence.common.repositories.cloud.sap`
- [OCM CLI](https://ocm.software/docs/getting-started/installation/) installed
- Kubernetes cluster with Konfidence installed
- kubectl configured

Docker Images, Kustomizations and OCM componentversions for each application have to be pushed to the OCI registry before deploying the scenarios.
This is usually already done and the artifacts are available in the registry.
If not, use the following commands to push fresh copies of the OCI artifacts to the registry:

```bash
# build and push Docker images
make build-apps

# build and push kustomizations
make build-kustomizations

# build and push OCM ComponentVersions
make build-ocm-components
```

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

### Scenario 2: Multi-Stage Deployment with Artifact Reuse

**Goal**: Demonstrate artifact reuse across multiple stages, where multiple vectors share common artifacts (productpage, details) while using different versions of other services (reviews:v1 vs reviews:v2).

#### Setup

##### Prerequisites

- Make sure the common prerequisites are met: [common prerequisites](../README.md#prerequisites)
- Vector 1 from scenario 1 is deployed and running

##### Manual Setup (Step-by-Step)

##### Step 1: Verify Kustomizations in OCI Registry

Verify that kustomization with respective versions are pushed for each bookinfo microservice:

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

Verify that kustomization with respective versions are pushed for each bookinfo microservice:

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
