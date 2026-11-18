# interviews

HTTP service in TypeScript (Node/Fastify). Books interviews for candidates. Calls the `candidates` service to validate the candidate exists; persists the booking in Postgres.

## Endpoints

| Method | Path                                    | Body                                                                     | Response                                                                                                  |
| ------ | --------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| GET    | `/healthz`                              | none                                                                     | `200 {"status":"ok"}`                                                                                     |
| GET    | `/interviews/debug`                     | none                                                                     | `200 {"service","runtime","routingKey","flags"}`                                                          |
| POST   | `/interviews`                           | `{"candidateId","slotTime","slotType"[,"durationMinutes"][,"location"]}` | `201 {"id","candidateId","slotTime","slotType","durationMinutes","location","createdAt"}` / `400` / `502` |
| GET    | `/interviews[?candidate_id=&from=&to=]` | none                                                                     | `200 [interview]` ordered by `slot_time` / `400`                                                          |
| GET    | `/candidates/:id`                       | none                                                                     | the candidate, fetched from `candidates`                                                                  |

An interview is `{"id","candidate_id","slot_time","slot_type","duration_minutes","location","created_at","candidate"}`. `candidate` is fetched from the `candidates` service for every interview, and is `null` when that fails.

`slotType` accepts `onsite` and `phone` by default. `video` is only accepted when the `allow-video-slots` release toggle is on. `durationMinutes` is a whole number from 5 to 480 and defaults to 60. `location` is optional free text of up to 200 characters.

The list filters are optional. `candidate_id` is a UUID. `from` (inclusive) and `to` (exclusive) are ISO 8601 times and bound `slot_time`.

Migration `002_duration_location` adds `duration_minutes`, `location` and `created_at`. Rows that existed before get 60 minutes and the time of the migration.

The routing key is read from the `X-Konfidence-Routing-Key` request header.

## Env

| Name                                                                  | Default                                                                                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `LISTEN_PORT`                                                         | `8080`                                                                                                                                          |
| `VECTOR_CONFIG_URL`                                                   | `http://vector-data-service`                                                                                                                    |
| `CANDIDATES_URL`                                                      | unset. Local development only: base URL of `candidates` (scheme, host, port and path are kept), used instead of the vector's deployment results |
| `DATABASE_URL`                                                        | unset                                                                                                                                           |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE` | unset                                                                                                                                           |

## Local run

```bash
npm install
npm run build
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/example?sslmode=disable"
export VECTOR_CONFIG_URL="http://localhost:4000"
export CANDIDATES_URL="http://localhost:8081"
npm start
```

## Tests

```bash
npm test
```

Needs Node 23.6 or newer, which runs the TypeScript tests without a build step.
