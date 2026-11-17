# @konfidence/next-adapter

A [Next.js deployment adapter](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath) that turns one `next build` into Konfidence artifacts. This is a proof of concept. The package is private and lives in this repo.

A Next.js app has two parts that belong on different runtimes. The Node server renders pages and runs on Kubernetes. The files under `/_next/static` are plain static content and belong in object storage behind a CDN. The adapter builds one Konfidence artifact for each:

| OCM component        | Artifact type           | Content                                                            | Deployer                                                                                    |
| -------------------- | ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `<component>`        | `helm.konfidence.cloud` | Server image and Helm chart                                        | Flux deployer                                                                               |
| `<component>-static` | `s3.konfidence.cloud`   | `/_next/static` as a tar.gz, with the label `route: /_next/static` | Static content deployer ([ADR-0042](https://github.com/konfidence-project/konfidence-docs)) |

Put both into a vector, next to your other services, and Konfidence deploys each to its runtime.

## Use it

Three additions to a Next.js app, shown in [`services/web`](../../services/web).

1. Name the component in `package.json`:

   ```json
   "konfidence": { "component": "github.com/acme/shop/web" }
   ```

2. Register the adapter in `next.config.ts`:

   ```ts
   import { withKonfidence } from "@konfidence/next-adapter/config";
   export default withKonfidence({/* your config */});
   ```

3. Build and publish:

   ```bash
   export REGISTRY=ghcr.io/acme/shop VERSION=1.4.0
   npx next build
   npx konfidence-next publish
   ```

You write no Dockerfile, no chart and no OCM constructor. The adapter generates them into `.next/konfidence/`, where you can read them. `konfidence-next package` generates without pushing anything.

`publish` needs `docker` with buildx, `helm` and `kden` on the PATH.

By default the server image also contains `/_next/static`, so the app works
in a landscape that has no static content deployer and sends every path to
the server. Where the bucket serves that path, leave the files out of the
image with `konfidence-next publish --no-static-in-image`.

## What the app must not know

A vector is promoted from stage to stage without a rebuild. So the build contains no stage name, no host name and no vector id.

- **Asset URLs are relative to the origin.** The adapter rejects an `assetPrefix` that names a host.
- **The browser calls backend services by path**, for example `fetch("/candidates")`. The routing in front of Konfidence maps the path to a service of the active vector.
- **The browser loads static files by path too.** The serving setup in front of the bucket maps `/_next/static` to the files of the active vector.
- **The server resolves services at request time** with the helpers below.
- **Do not read stage-specific values while prerendering.** Next.js runs a page without request data once at build time and stores the result in the image.

The one build input is `VERSION`. The adapter sets it as the Next.js `deploymentId`, so a browser tab reloads when it meets a server from another build.

## Server helpers

```ts
import { features, routingKey, serviceFetch } from "@konfidence/next-adapter/server";

const res = await serviceFetch("interviews", "/interviews"); // by deployment-result name
const flags = await features(); // feature flags of the vector
```

Konfidence tags each request with `X-Konfidence-Routing-Key`. `serviceFetch` reads the vector's deployment results from the vector data service (`VECTOR_CONFIG_URL`), finds the service and forwards the key, so the request stays in one vector.

For `next dev` without a cluster, set `KONFIDENCE_SERVICE_<NAME>_URL` and `KONFIDENCE_FEATURES`. See [`services/web/.env.example`](../../services/web/.env.example).

## What gets generated

```
.next/konfidence/
├── build.json                           what was built, and which paths go to which runtime
├── static/                              the /_next/static files, input of the static component
├── image/Dockerfile, image/app/         the standalone server as a Docker context
├── chart/                               Deployment and Service for the server
├── server.component-constructor.yaml    OCM component <component>
└── static.component-constructor.yaml    OCM component <component>-static
```

The chart's Service carries `konfidence.cloud/deployment-result: <name>`. The Deployment reads an optional ConfigMap `<name>-config` from the landscape namespace for settings that differ per landscape.

`build.json` lists the routes per runtime, including routes that use the Edge runtime. Nothing consumes that list yet. It is where an edge-worker artifact would start.

## Settings

All optional except `component`, under `konfidence` in `package.json`:

| Key                | Default                     | Meaning                                   |
| ------------------ | --------------------------- | ----------------------------------------- |
| `component`        | required                    | OCM component name of the server artifact |
| `staticComponent`  | `<component>-static`        | OCM component name of the static artifact |
| `name`             | last segment of `component` | Image, chart and Kubernetes name          |
| `deploymentResult` | `name`                      | Name other services resolve the server by |
| `provider`         | `konfidence-project`        | OCM provider                              |
| `port`             | `3000`                      | Container port                            |

Environment variables for `konfidence-next publish`:

| Variable                              | Default                    | Meaning                                                                                                          |
| ------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `REGISTRY`                            | required                   | Repository prefix without scheme                                                                                 |
| `VERSION`                             | required                   | Artifact version. Must be set for `next build` too                                                               |
| `PLATFORMS`                           | `linux/amd64,linux/arm64`  | Image platforms                                                                                                  |
| `KONFIDENCE_REGISTRY_URL`             | `https://$REGISTRY`        | OCM repository URL. With `http://`, the chart and image references in the component are marked as plain HTTP too |
| `HELM_PUSH_ARGS`, `DOCKER_BUILD_ARGS` | empty                      | Extra arguments, for example `--plain-http`                                                                      |
| `KONFIDENCE_NODE_IMAGE`               | `node:<host major>-alpine` | Base image of the server                                                                                         |

## Known limits

- **Two steps, not one.** Next.js calls the adapter before it writes the standalone server, so the adapter cannot build the image inside `next build`. `konfidence-next publish` does that afterwards.
- **Static content follows the active vector.** A preview of another vector, or a browser tab opened before a switch, can ask for a chunk the active vector does not have. Vector stickiness in Konfidence is the planned answer. The adapter does not work around it.
- **The two components are not tied together.** Both carry the same version, but nothing stops a vector from combining a server with the static bundle of another build.
- **The server and the static files switch separately.** An activation updates the route to the server and the pointer to the static files in two steps, with no order between them. For a moment a new page can ask for files that are not active yet.
- **`public/` stays in the server image.** Static content routes are path prefixes, and files in `public/` sit at arbitrary root paths.
- **Native modules.** The build runs on your machine, the image runs on Linux. The adapter replaces the binaries of `sharp`, which Next.js uses for image optimization. It warns about any other native module it finds.
- **Standalone output.** The adapter sets `output: "standalone"`. A comment in the Next.js source says this combination may be disallowed in a future version.

Tested with Next.js 16.4.6, including an end-to-end local deployment with
Kubernetes compute and S3-compatible static storage. Environment provisioning
is outside this package.

## Tests

```bash
npm test
```
