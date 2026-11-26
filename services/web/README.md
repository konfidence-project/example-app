# web

Next.js frontend of the example app. One page lists the scheduled interviews and has a form to schedule one. Submitting the form creates the candidate and then the interview.

The server runs on Kubernetes. The files under `/_next/static` can come from a bucket instead. Both are built by one `next build` and published as two OCM components with the same version.

## Files

```
app/
├── page.tsx           the page: loads the flags and the interviews per request
├── schedule-form.tsx  the form (client component)
├── actions.ts         the server action the form submits to
├── data.ts            calls to candidates and interviews, and the two flags
├── layout.tsx         html shell, mounts the devtools widget
├── globals.css
├── healthz/route.ts   probe path of the chart
└── api/konfidence/devtools/route.ts   data endpoint of the devtools widget
next.config.ts         standalone output and the deployment id
Dockerfile             runs the build output
chart/                 Helm chart of the server
ocm/                   the two OCM component constructors
build-and-push.sh      builds and publishes both components
```

## How it talks to the backends

The form submits to a server action. Both the page and the action call the backends from the Next.js server with `serviceFetch("interviews", ...)` from [`packages/next-devtools`](../../packages/next-devtools). That helper looks the service up in the deployment results of the vector that served the request and forwards `X-Konfidence-Routing-Key`, so the backends evaluate their flags for the same vector. The browser only talks to the Next.js server, and every backend call shows up as a hop in the devtools widget.

Two feature flags change the page. The page reads them per request with `features()`:

| Flag                     | Effect when on                                           |
| ------------------------ | -------------------------------------------------------- |
| `allow-video-slots`      | The form offers the video type                           |
| `enable-candidate-notes` | The form has a notes field, and the list shows the notes |

The backends check the same flags and reject what is off.

The page shows nothing about Konfidence. The devtools widget does: routing key, services, flags per service, recent calls, and where the static files came from. It is off unless the server has `KONFIDENCE_DEVTOOLS=1`. See [Devtools](../../packages/next-devtools/README.md#devtools).

## Publish

```bash
REGISTRY=my-registry.example.com/my-org/example-app VERSION=0.1.0-dev ./build-and-push.sh
```

Needs `docker` with buildx, `helm` and `kden`. Node.js and pnpm are pinned by Hermit in `bin/` at the repository root, and the script activates them.

The script:

1. runs `next build`. It writes the server to `.next/standalone` and the browser files to `.next/static`.
2. builds the image from the [Dockerfile](Dockerfile), which copies both directories, and pushes it.
3. packages and pushes the [chart](chart).
4. pushes the OCM components [`web`](ocm/web.component-constructor.yaml) (chart and image, `helm.konfidence.cloud`) and [`web-static`](ocm/web-static.component-constructor.yaml) (`.next/static` as one archive with the route `/_next/static`, `s3.konfidence.cloud`).
5. moves the `edge` alias of both components to the new version, after both pushes succeeded.

`next.config.ts` turns `VERSION` into the Next.js deployment id. Next.js writes it into the page and onto every static file URL, so a browser tab that meets a server of another build reloads instead of mixing two builds.

The image always contains the static files too. Which runtime answers `/_next/static` is decided by the routing in front of the app, not by the image:

| Vector                                               | `/_next/static` comes from             |
| ---------------------------------------------------- | -------------------------------------- |
| `.github/vector/vector-constructor.web.yaml`         | the bucket, filled from `web-static`   |
| `.github/vector/vector-constructor.web-compute.yaml` | the Next.js server, from its own image |

## Routing

The app expects these public paths on one origin per stage:

| Path              | Goes to                                           |
| ----------------- | ------------------------------------------------- |
| `/_next/static/*` | the static content of the active vector, or `web` |
| everything else   | `web` of the active vector                        |

Asset URLs are relative to the origin and the build contains no stage name or host, so the same build is promoted from stage to stage unchanged.

## Develop

```bash
# at the repository root
. bin/activate-hermit
pnpm install                 # also builds packages/next-devtools
cp services/web/.env.example services/web/.env.local
pnpm --filter web dev
pnpm verify                  # typecheck, lint, format check and tests of web and the devtools package
```

`next dev` has no Konfidence routing and no routing key. `.env.example` points the app at locally running services and sets the flags:

| Name                                | Example                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `KONFIDENCE_SERVICE_CANDIDATES_URL` | `http://localhost:8081`                                    |
| `KONFIDENCE_SERVICE_INTERVIEWS_URL` | `http://localhost:8080`                                    |
| `KONFIDENCE_FEATURES`               | `{"allow-video-slots":true,"enable-candidate-notes":true}` |
| `KONFIDENCE_DEVTOOLS`               | `1`                                                        |

Without a routing key the backends read every flag as off and `interviews` cannot resolve `candidates`, so listing works only partly and scheduling fails. Use a cluster to try the whole flow, for example [`hack/nextjs-demo`](../../hack/nextjs-demo) if you have it.

The app imports the package's compiled `dist/`. After a change in it, run `pnpm --filter @konfidence/next-devtools build`.

## Env

| Name                            | Default                      | Meaning                                                |
| ------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `PORT`                          | `3000`                       | Listen port, set in the image                          |
| `VECTOR_CONFIG_URL`             | `http://vector-data-service` | Vector data service, set by the chart                  |
| `KONFIDENCE_DEVTOOLS`           | unset                        | `1` turns on the devtools widget and its data endpoint |
| `KONFIDENCE_SERVICE_<NAME>_URL` | unset                        | Local development only: fixed URL of a service         |
| `KONFIDENCE_FEATURES`           | unset                        | Local development only: feature flags as JSON          |

The chart reads the optional ConfigMap `web-config` in the landscape namespace with `envFrom`, for settings that differ per landscape such as `KONFIDENCE_DEVTOOLS`.
