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

For `next dev` without a cluster, set `KONFIDENCE_SERVICE_<NAME>_URL` and `KONFIDENCE_FEATURES`. See [`services/web/README.md`](../../services/web/README.md#develop).

`serviceNames()` lists the services the current vector has, without the server itself. The generated chart sets `KONFIDENCE_DEPLOYMENT_RESULT` so the server knows its own name.

## Devtools

A floating widget that shows how a request travelled through the vector: which stage and routing key it carried, which services the server called and how long they took, which flags each service sees, and where the static files came from. It is meant for demos and debugging, and it stays out of the app.

### Turn it on

1. Add the component to the root layout:

   ```tsx
   import { KonfidenceDevtools } from "@konfidence/next-adapter/devtools";

   // inside <body>, after the app
   <KonfidenceDevtools />;
   ```

2. Mount the data endpoint, for example in `app/api/konfidence/devtools/route.ts`:

   ```ts
   export { GET } from "@konfidence/next-adapter/devtools/route";
   ```

   Another path works too. Pass it as `<KonfidenceDevtools endpoint="/my/path" />`.

3. Set `KONFIDENCE_DEVTOOLS=1` on the server. In a landscape, put it into the ConfigMap `<name>-config`.

When the variable is unset, the component renders nothing, the browser loads none of the widget code, `serviceFetch()` records nothing, and the endpoint answers 404. A page that Next.js prerenders at build time reads the variable at build time. Pages rendered per request read it per request.

The endpoint shows internal host names and the vector document. Turn it on only where that is fine to show.

### What it shows

The widget mounts in a shadow root with its own React root and its own styles, so app CSS and widget CSS cannot reach each other. Closed, it is a small button in the bottom right corner (`position="bottom-left"` moves it). Open, it is a panel docked to the bottom of the window with a dark tooling look. Drag its top edge to resize it. Open state, active tab, height and the Live switch are kept in `localStorage` under `konfidence-devtools`.

| Tab          | Content                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request path | Browser, edge and router, static files, this server and every service, with hop counts and average latency per edge. Browser numbers come from this tab's resource timing                         |
| Vector       | Stage, routing key, build. The flags from the vector data next to the flags each service reports on `/<name>/debug`, with reachability and latency. Service URLs resolved from deployment results |
| Hops         | The hop buffer: time, from and to, request, host or error, status, latency, and whether the call carried this request's routing key                                                               |
| Static files | Whether `/_next/static` came from object storage or the server, the bucket directory and vector the static handler reported, the static content results of the vector, build of server and page   |

While the panel is open and Live is on, the widget polls the endpoint every 3 seconds. Refresh polls once.

### Hops

With devtools on, `serviceFetch()` records every call in a buffer of the last 40 calls: target, method, path, resolved host, status, latency, error text, and routing key. For a status of 400 or more, the `error` field of the JSON body becomes the error text.

The buffer lives in the server process. With more than one pod, each pod keeps its own, and the widget shows the buffer of the pod that answered the poll. The panel says so.

Some calls happen between services, out of sight of this server. The adapter derives them from responses as **implied hops**: a property `x` whose value is an object with an `id`, in a JSON response of service A, counts as a call from A to the service `xs` with `GET /xs/<id>`, if the vector has a service of that name. A `null` value counts as a failed call. In the example app every interview from `GET /interviews` embeds its `candidate`, so each one implies `interviews → candidates`. Implied hops have no latency.

The endpoint calls `/<name>/debug` of every service on each poll. Those calls skip the buffer, so polling does not push the app's own calls out.

### Data endpoint

`GET` on the endpoint returns one JSON document. It is the whole interface between the server and the widget, so another client, a browser extension for example, can read the same thing. The format:

```jsonc
{
  "schema": "cloud.konfidence.devtools/v1",
  "generatedAt": "2026-11-17T12:04:31.120Z",
  "server": {
    "name": "web", // deployment result of this server
    "runtime": "Next.js SSR",
    "pod": "web-0-1-0-demo-3-6c9f-x2v4q",
    "buildId": "0-1-0-demo-3", // NEXT_DEPLOYMENT_ID, null when unversioned
    "node": "22.12.0",
  },
  "request": {
    "routingKey": "dev-5kjvlb7n656d5", // null outside Konfidence
    "stage": "dev", // x-konfidence-stage header, null when absent
  },
  "vector": {
    // null without a routing key
    "features": { "allow-video-slots": false },
    "authored": null,
    "deploymentResults": {
      "interviews": [{ "name": "interviews", "type": "http-k8s-service", "spec": {} }],
    },
  },
  "vectorError": null, // message when the vector data service failed
  "localFeatures": null, // KONFIDENCE_FEATURES when there is no vector
  "services": [
    {
      "name": "interviews",
      "url": "http://interviews-0-1-0-demo-3-c9df.kden-l-dev.svc.cluster.local:80",
      "source": "deployment-result", // or "env" for KONFIDENCE_SERVICE_<NAME>_URL
      "error": null, // set when the URL could not be resolved
      "probe": {
        // GET /<name>/debug, null when unresolved
        "path": "/interviews/debug",
        "status": 200, // null when unreachable
        "latencyMs": 12,
        "reachable": true,
        "runtime": "Node 26.1.0", // the debug response's runtime field
        "routingKey": "dev-5kjvlb7n656d5",
        "flags": { "allow-video-slots": false },
        "error": null,
      },
    },
  ],
  "static": [
    // deployment results that carry a route
    {
      "component": "web-static",
      "name": "next-static",
      "type": "s3.konfidence.cloud/v1alpha1",
      "route": "/_next/static",
      "bucket": "nextjs-demo-static",
      "prefix": "dev/_k/web-static-0-1-0-demo-3-k89/next-static/",
      "endpoint": "http://minio.demo-s3.svc.cluster.local:9000",
    },
  ],
  "hops": [
    // newest first, at most buffer.size
    {
      "id": 118,
      "at": "2026-11-17T12:04:31.010Z",
      "kind": "direct", // or "implied"
      "from": "web",
      "to": "interviews",
      "method": "GET",
      "path": "/interviews?from=2026-11-16T00%3A00%3A00.000Z",
      "host": "interviews-0-1-0-demo-3-c9df.kden-l-dev.svc.cluster.local:80",
      "status": 200, // null when the call failed
      "latencyMs": 14, // null for implied hops
      "error": null,
      "routingKey": "dev-5kjvlb7n656d5",
      "impliedBy": null, // id of the hop whose response implied this one
    },
  ],
  "buffer": { "size": 40, "scope": "pod" },
}
```

Fields are only added within `v1`. A change that removes or renames a field gets a new `schema` value. The endpoint answers with `cache-control: no-store`, and with 404 when devtools are off.

A service that wants its flags in the Vector tab answers `GET /<name>/debug` with `{ "flags": {...}, "routingKey": "...", "runtime": "..." }`. The example services do.

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

The chart's Service carries `konfidence.cloud/deployment-result: <name>`. The Deployment sets `KONFIDENCE_DEPLOYMENT_RESULT` to the same name, and reads an optional ConfigMap `<name>-config` from the landscape namespace for settings that differ per landscape, `KONFIDENCE_DEVTOOLS` for example.

The adapter works with the app in `app/` or in `src/app/`. It reads the build output and `public/` at the project root, not the source layout.

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
