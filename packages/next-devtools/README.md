# @konfidence/next-devtools

> **Demo only.** This package shows what a framework integration for Konfidence could look like. It is not a supported product and is not published. The files Konfidence deploys for the example frontend (Dockerfile, Helm chart, OCM constructors, build script) live in [`services/web`](../../services/web) and do not depend on this package.

Two parts, both used by `services/web`:

- **Server helpers** for code that runs in the Next.js server: find a service of the vector that serves the current request, forward the routing key, read the vector's feature flags.
- **Devtools**: an opt-in widget that shows how a request travelled through the vector.

## Server helpers

```ts
import { features, routingKey, serviceFetch } from "@konfidence/next-devtools/server";

const res = await serviceFetch("interviews", "/interviews"); // by deployment-result name
const flags = await features(); // feature flags of the vector
```

Konfidence tags each request with `X-Konfidence-Routing-Key`. `serviceFetch` reads the vector's deployment results from the vector data service (`VECTOR_CONFIG_URL`), finds the service and forwards the key, so the request stays in one vector. `routingKey()`, `vectorData()` and `serviceUrl()` expose the steps on their own.

For `next dev` without a cluster, set `KONFIDENCE_SERVICE_<NAME>_URL` and `KONFIDENCE_FEATURES`. See [`services/web/README.md`](../../services/web/README.md#develop).

`serviceNames()` lists the services the current vector has, without the server itself. The server knows its own name from `KONFIDENCE_DEPLOYMENT_RESULT`, which the web chart sets.

## Devtools

A floating widget that shows how a request travelled through the vector: which routing key it carried, which services the server called and how long they took, which flags each service sees, and where the static files came from. It is meant for demos and debugging, and it stays out of the app.

### Turn it on

1. Add the component to the root layout:

   ```tsx
   import { KonfidenceDevtools } from "@konfidence/next-devtools/devtools";

   // inside <body>, after the app
   <KonfidenceDevtools />;
   ```

2. Mount the data endpoint, for example in `app/api/konfidence/devtools/route.ts`:

   ```ts
   export { GET } from "@konfidence/next-devtools/devtools/route";
   ```

   Another path works too. Pass it as `<KonfidenceDevtools endpoint="/my/path" />`.

3. Set `KONFIDENCE_DEVTOOLS=1` on the server. In a landscape, put it into the ConfigMap `web-config`, which the web chart reads.

When the variable is unset, the component renders nothing, the browser loads none of the widget code, `serviceFetch()` records nothing, and the endpoint answers 404. A page that Next.js prerenders at build time reads the variable at build time. Pages rendered per request read it per request.

The endpoint shows feature flags, authored configuration, internal service URLs, pod name and build id to anyone who reaches it. Turn it on only in demo and development landscapes.

### What it shows

The widget mounts in a shadow root with its own React root and its own styles, so app CSS and widget CSS cannot reach each other. Closed, it is a small button in the bottom right corner (`position="bottom-left"` moves it). Open, it is a panel docked to the bottom of the window with a dark tooling look. Drag its top edge to resize it. Open state, active tab, height and the Live switch are kept in `localStorage` under `konfidence-devtools`.

| Tab          | Content                                                                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request path | Browser, edge and router, static files, this server and every service, with hop counts and average latency per edge. Browser numbers come from this tab's resource timing                       |
| Vector       | Routing key, build. The flags from the vector data next to the flags each service reports on `/<name>/debug`, with reachability and latency. How each service was resolved                      |
| Hops         | The hops of this routing key: time, from and to, request, error, status, latency                                                                                                                |
| Static files | Whether `/_next/static` came from object storage or the server, the bucket directory and vector the static handler reported, the routes of the static content results, build of server and page |

While the panel is open and Live is on, the widget polls the endpoint every 3 seconds. Refresh polls once.

### Hops

With devtools on, `serviceFetch()` records every call in a buffer of the last 40 calls: target, method, path, resolved host, status, latency, error text, and routing key. The endpoint returns only the hops with the caller's routing key. For a status of 400 or more, the `error` field of the JSON body becomes the error text.

The buffer lives in the server process. With more than one pod, each pod keeps its own, and the widget shows the buffer of the pod that answered the poll. The panel says so. Other routing keys share the buffer, so a busy pod can push this key's calls out.

Some calls happen between services, out of sight of this server. The package derives them from responses as **implied hops**: a property `x` whose value is an object with an `id`, in a JSON response of service A, counts as a call from A to the service `xs` with `GET /xs/<id>`, if the vector has a service of that name. A `null` value counts as a failed call. In the example app every interview from `GET /interviews` embeds its `candidate`, so each one implies `interviews → candidates`. Implied hops have no latency.

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
    // null outside Konfidence. The router strips the stage header before
    // the request reaches the server, so the stage is not part of it.
    "routingKey": "dev-5kjvlb7n656d5",
  },
  "vector": {
    // null without a routing key
    "features": { "allow-video-slots": false },
    "authored": { "...": "..." }, // the vector's authored configuration
    "deploymentResults": { "interviews": [{ "name": "interviews", "type": "...", "spec": {} }] },
  },
  "vectorError": null, // error message when the vector data service failed
  "localFeatures": null, // KONFIDENCE_FEATURES when there is no vector
  "services": [
    {
      "name": "interviews",
      "url": "http://interviews-x.dev.svc.cluster.local:80", // null when unresolved
      "source": "deployment-result", // or "env" for KONFIDENCE_SERVICE_<NAME>_URL
      "error": null, // set when the service could not be resolved
      "probe": {
        // GET /<name>/debug, null when unresolved
        "path": "/interviews/debug",
        "status": 200, // null when unreachable
        "latencyMs": 12,
        "reachable": true,
        "runtime": null, // the debug response's runtime field, if it has one
        "routingKey": "dev-5kjvlb7n656d5",
        "flags": { "allow-video-slots": false },
        "error": null, // "responded <status>" or the fetch error
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
      "bucket": "web-static", // null unless the result names one
      "prefix": "0.1.0/",
      "endpoint": "http://minio",
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
      "path": "/interviews",
      "host": "interviews-x.dev.svc.cluster.local:80",
      "status": 200, // null when the call failed
      "latencyMs": 14, // null for implied hops
      "error": null,
      "routingKey": "dev-5kjvlb7n656d5",
      "impliedBy": null, // id of the hop whose response implied this one
    },
  ],
  "buffer": { "size": 40, "scope": "pod+routing-key" },
}
```

Fields are only added within `v1`. A change that removes or renames a field gets a new `schema` value. This version removed `request.stage`, which the router never forwards. The endpoint answers with `cache-control: no-store`, and with 404 when devtools are off.

A service that wants its flags in the Vector tab answers `GET /<name>/debug` with `{ "flags": {...}, "routingKey": "..." }`, optionally with a `"runtime"` string. The `candidates` and `interviews` services of the example app answer with flags and routing key.

## Develop

The package is written in strict TypeScript and compiles to `dist/` with declarations. pnpm builds it on install (`prepare`). In this directory:

```bash
pnpm verify   # check, lint, fmt:check, build, test
pnpm test     # Vitest, tests next to the code as src/**/*.test.ts
```
