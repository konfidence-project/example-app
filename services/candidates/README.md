# candidates

HTTP service in Go. Stores candidates in Postgres.

## Endpoints

| Method | Path                | Body                         | Response                                                                                                             |
| ------ | ------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| GET    | `/healthz`          | none                         | `200 {"status":"ok"}`                                                                                                |
| GET    | `/candidates/debug` | none                         | `200 {"service","runtime","routingKey","flags"}`                                                                     |
| GET    | `/candidates[?q=]`  | none                         | `200 [candidate]`, ordered by name. `q` keeps candidates whose name or email contains it, ignoring case. At most 500 |
| POST   | `/candidates`       | `{"name","email"[,"notes"]}` | `201 candidate` / `400`                                                                                              |
| GET    | `/candidates/:id`   | none                         | `200 candidate` / `400` / `404`                                                                                      |
| PATCH  | `/candidates/:id`   | `{"notes"}`                  | `200 candidate` / `400` / `404`. An empty string or `null` clears the notes                                          |

A candidate is `{"id","name","email"[,"notes"],"created_at"}`, `created_at` in RFC 3339.

`notes` is only accepted when the `enable-candidate-notes` release toggle is on, on create and on update. Reads return stored notes either way.

Migration `002_created_at` adds `created_at`. Rows that existed before get the time of the migration.

The routing key is read from the `X-Konfidence-Routing-Key` request header.

## Env

| Name                                                                  | Default                      |
| --------------------------------------------------------------------- | ---------------------------- |
| `LISTEN_ADDR`                                                         | `:8080`                      |
| `VECTOR_CONFIG_URL`                                                   | `http://vector-data-service` |
| `DATABASE_URL`                                                        | unset                        |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE` | unset                        |

## Local run

```bash
go mod tidy
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/example?sslmode=disable"
export VECTOR_CONFIG_URL="http://localhost:4000"
go run .
```

## Tests

```bash
go test ./...
```

The handler tests use an in-memory store and need no database.
