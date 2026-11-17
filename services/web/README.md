# web

Next.js frontend for the example app. A proof of concept for running Next.js on Konfidence: the server on Kubernetes, the static files in object storage, both from one build and in one vector.

This directory has no Dockerfile, chart or OCM constructor. [`@konfidence/next-adapter`](../../packages/next-adapter) generates them from the build.

## Pages

| Path     | Rendered                   | Shows                                                                                                                                    |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/`      | per request, on the server | The vector, build and pod that answered, where the static files came from, the vector's feature flags, a form and the list of interviews |
| `/about` | once, at build time        | How the app is deployed                                                                                                                  |

Four things on `/` are worth reading in the code:

- **`lib/desk.ts`** loads interviews on the server with `serviceFetch("interviews", "/interviews")`. The helper resolves the service in the vector that received the request.
- **`components/ScheduleForm.tsx`** runs in the browser and posts to `/candidates` and `/interviews` on its own origin. Konfidence routing picks the service.
- **`app/page.tsx`** reads `allow-video-slots` and `enable-candidate-notes` from the vector and shows or hides the matching form fields. A promotion that changes a flag changes the page without a rebuild.
- **`components/StaticOrigin.tsx`** asks for one of the page's own scripts and shows the response headers `x-konfidence-vector` and `x-konfidence-static-origin`. A handler in front of the bucket sets them. The Next.js server does not.

## Publish

```bash
REGISTRY=my-registry.example.com/my-org/example-app VERSION=0.1.0-dev ./build-and-push.sh
```

This publishes two OCM components: `web` (`helm.konfidence.cloud`) and `web-static` (`s3.konfidence.cloud`). Needs Node 22 or newer, `docker`, `helm` and `kden`.

`KONFIDENCE_PUBLISH_ARGS=--no-static-in-image` leaves `/_next/static` out of the server image, for a landscape that serves it from the bucket.

The vectors that include them are in `.github/vector/`: `vector-constructor.web.yaml`, and `vector-constructor.web-compute.yaml` for a landscape without the static content deployer.

## Routing

The app expects these public paths on one origin per stage:

| Path                           | Goes to                             |
| ------------------------------ | ----------------------------------- |
| `/_next/static/*`              | Static content of the active vector |
| `/candidates*`, `/interviews*` | Those services of the active vector |
| everything else                | `web` of the active vector          |

## Local run

```bash
npm install
cp .env.example .env.local   # points at locally running candidates and interviews
npm run dev
```

## Env

| Name                            | Default                      | Meaning                                        |
| ------------------------------- | ---------------------------- | ---------------------------------------------- |
| `PORT`                          | `3000`                       | Listen port                                    |
| `VECTOR_CONFIG_URL`             | `http://vector-data-service` | Vector data service                            |
| `KONFIDENCE_SERVICE_<NAME>_URL` | unset                        | Local development only: fixed URL of a service |
| `KONFIDENCE_FEATURES`           | unset                        | Local development only: feature flags as JSON  |
