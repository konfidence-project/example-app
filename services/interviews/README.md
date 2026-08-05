# interviews

HTTP service in TypeScript (Node/Fastify). Books interviews for candidates. Calls the `candidates` service to validate the candidate exists; persists the booking in Postgres.

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET  | `/healthz` | — | `200 {"status":"ok"}` |
| POST | `/interviews` | `{"candidateId","slotTime","slotType"}` | `201 {…}` / `400` / `502` |
| GET  | `/interviews` | — | `200 [{…}]` |

`slotType` accepts `onsite` and `phone` by default. `video` is only accepted when the `allow-video-slots` release toggle is on for the request's vector.

## Env

| Name | Default |
|---|---|
| `LISTEN_PORT` | `8080` |
| `VECTOR_ID_HEADER` | `X-Vector-ID` |
| `VECTOR_CONFIG_URL` | `http://vector-data-service` |
| `CANDIDATES_URL` | `http://candidates.example-landscape.svc.cluster.local` |
| `DATABASE_URL` | — |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE` | — |

## Local run

```bash
npm install
npm run build
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/example?sslmode=disable"
export VECTOR_CONFIG_URL="http://localhost:4000"
export CANDIDATES_URL="http://localhost:8081"
npm start
```
