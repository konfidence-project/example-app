# web

Next.js frontend of the example app: an interview scheduling tool on top of the `candidates` and `interviews` services. It is also the proof of concept for running Next.js on Konfidence. The server runs on Kubernetes, the static files come from object storage, and both ship from one build in one vector.

This directory has no Dockerfile, chart or OCM constructor. [`@konfidence/next-adapter`](../../packages/next-adapter) generates them from the build.

## Pages

| Path           | Shows                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `/`            | Redirects to `/schedule`                                                                       |
| `/schedule`    | Interviews of one week by day, filter by type, week pager, the "Schedule interview" dialog     |
| `/people`      | Candidates sorted by their next interview, search by name or email, the "Add candidate" dialog |
| `/people/[id]` | One candidate: interviews, activity, profile, notes                                            |

All pages render per request on the server. Forms submit through server actions, so every backend call starts on the Next.js server and goes to the services of the vector that received the request.

The app shows nothing about Konfidence. No routing key, pod, build, flag name or static origin appears on a page. Two feature flags change behaviour:

| Flag                     | Effect when on                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `allow-video-slots`      | The video type appears in the schedule filter and in the dialog                                     |
| `enable-candidate-notes` | The notes column on `/people`, the notes field when adding a candidate, editable notes on a profile |

The flag names live in [`src/lib/flags.ts`](src/lib/flags.ts) and nowhere else.

To look at the Konfidence side of a request, turn on the devtools widget with `KONFIDENCE_DEVTOOLS=1`. It ships with the adapter and runs outside the app, see [Devtools](../../packages/next-adapter/README.md#devtools). The app's contact with it is one line in `src/app/layout.tsx` and the route file `src/app/api/konfidence/devtools/route.ts`.

## Structure

The layout follows [bulletproof-react](https://github.com/alan2207/bulletproof-react) for the Next.js app router.

```
src/
├── app/                     routes only: fetch data, compose features
│   ├── schedule/            page, loading, error
│   ├── people/              page, loading, error, [id]/
│   ├── api/healthz/route.ts the probe path of the generated chart
│   └── api/konfidence/devtools/route.ts
├── features/
│   ├── schedule/            interviews: api/, components/, types/, utils/
│   └── people/              candidates: api/, components/, types/, utils/
├── components/
│   ├── ui/                  button, badge, avatar, card, dialog, field, segmented control, choice cards, states, icons
│   ├── layouts/             app shell with sidebar, page header, loading and error pages
│   └── interview-type-badge.tsx
├── config/                  env.ts (server settings), paths.ts (every route)
├── lib/                     api-client.ts around serviceFetch(), flags.ts
├── types/                   API shapes shared by both features, and their decoders
├── utils/                   time zone arithmetic, formatting, form submit helper
└── styles/globals.css       design tokens for light and dark
```

Imports flow one way: shared code, then features, then `src/app`. Features do not import each other. A page that needs both, like the candidate page with its "Schedule interview" dialog, composes them in `src/app`. ESLint enforces this with `import/no-restricted-paths`, see [`eslint.config.mjs`](eslint.config.mjs). Imports use `@/` for `src/`.

Styling is plain CSS: tokens as custom properties in `src/styles/globals.css`, one CSS module per component. Light and dark follow `prefers-color-scheme`.

## Develop

`services/web` and `packages/next-adapter` are one pnpm workspace with one lockfile at the repository root. Node.js 24.15.0 and pnpm 11.9.0 are pinned with Hermit in `bin/`, the same versions the Konfidence repository uses. Activate them with `. bin/activate-hermit`, or install those versions yourself.

```bash
# at the repository root
. bin/activate-hermit
pnpm install          # also builds the adapter into packages/next-adapter/dist
pnpm web:dev
pnpm web:verify       # check, lint, fmt:check, test
pnpm web:build
pnpm verify           # adapter and web
pnpm verify:artifacts # next build, package, helm lint and template, image build and smoke test
```

The tooling follows the Konfidence dashboard. `check` runs the TypeScript 7 compiler (the `typescript-native` alias), the package `typescript` is the TypeScript 6 API that Next.js and typescript-eslint still need. `lint` runs Oxlint, then ESLint 9 for the Next.js rules and the import zones Oxlint has no equivalent for. `fmt` and `fmt:check` run Oxfmt. `test` runs Vitest, tests sit next to the code as `*.test.ts`.

`next dev` has no Konfidence routing and no routing key. Point it at locally running services and give it feature flags:

| Name                                | Example                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `KONFIDENCE_SERVICE_CANDIDATES_URL` | `http://localhost:8081`                                    |
| `KONFIDENCE_SERVICE_INTERVIEWS_URL` | `http://localhost:8082`                                    |
| `KONFIDENCE_FEATURES`               | `{"allow-video-slots":true,"enable-candidate-notes":true}` |
| `KONFIDENCE_DEVTOOLS`               | `1`                                                        |

Without a routing key the backends read every flag as off. So with the flags above the UI offers video slots and notes, and the services reject them. The error shows in the dialog. That is a quick way to look at the error states.

`interviews` needs `CANDIDATES_URL` to reach `candidates` without Konfidence, see its README.

The adapter is linked from `packages/next-adapter`, and the app imports its compiled `dist/`. After a change in the adapter, run `pnpm --filter @konfidence/next-adapter build`.

## Publish

```bash
REGISTRY=my-registry.example.com/my-org/example-app VERSION=0.1.0-dev ./build-and-push.sh
```

This publishes two OCM components: `web` (`helm.konfidence.cloud`) and `web-static` (`s3.konfidence.cloud`). Needs Node.js 24.15.0 and pnpm 11.9.0 (activated from `bin/` when present), `docker`, `helm` and `kden`.

`KONFIDENCE_PUBLISH_ARGS=--no-static-in-image` leaves `/_next/static` out of the server image, for a landscape that serves it from the bucket.

The vectors that include them are in `.github/vector/`: `vector-constructor.web.yaml`, and `vector-constructor.web-compute.yaml` for a landscape without the static content deployer.

## Routing

The app expects these public paths on one origin per stage:

| Path                           | Goes to                             |
| ------------------------------ | ----------------------------------- |
| `/_next/static/*`              | Static content of the active vector |
| `/candidates*`, `/interviews*` | Those services of the active vector |
| everything else                | `web` of the active vector          |

The pages themselves no longer call `/candidates` or `/interviews` from the browser. The paths stay routed for the seed script and for direct API use.

## Env

| Name                            | Default                      | Meaning                                                |
| ------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `PORT`                          | `3000`                       | Listen port                                            |
| `VECTOR_CONFIG_URL`             | `http://vector-data-service` | Vector data service                                    |
| `APP_TIME_ZONE`                 | `UTC`                        | IANA time zone the schedule is shown and entered in    |
| `KONFIDENCE_DEVTOOLS`           | unset                        | `1` turns on the devtools widget and its data endpoint |
| `KONFIDENCE_SERVICE_<NAME>_URL` | unset                        | Local development only: fixed URL of a service         |
| `KONFIDENCE_FEATURES`           | unset                        | Local development only: feature flags as JSON          |

In a landscape, set `APP_TIME_ZONE`, `KONFIDENCE_DEVTOOLS` and `VECTOR_CONFIG_URL` in the ConfigMap `web-config`. The generated chart reads it with `envFrom`.

`PORT` is not read from the ConfigMap: the chart sets it from its `port` value, because it has to match the container port and the probes. The chart value `vectorConfigUrl` is empty by default. When it is set, it wins over `VECTOR_CONFIG_URL` in the ConfigMap, because explicit container `env` wins over `envFrom`.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
data:
  APP_TIME_ZONE: "Europe/Berlin"
  VECTOR_CONFIG_URL: "http://vector-data-service"
```

The server checks `APP_TIME_ZONE`, `VECTOR_CONFIG_URL`, `KONFIDENCE_SERVICE_<NAME>_URL` and `KONFIDENCE_FEATURES` and fails with a message naming the variable when one is malformed.
