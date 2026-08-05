# candidates

HTTP service in Go. Stores candidates in Postgres.

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET  | `/healthz` | — | `200 {"status":"ok"}` |
| POST | `/candidates` | `{"name","email"[,"notes"]}` | `201 {"id","name","email"[,"notes"]}` / `400` |
| GET  | `/candidates/:id` | — | `200 {…}` / `404` |

`notes` is only accepted when the `enable-candidate-notes` release toggle is on for the request's vector.

## Env

| Name | Default |
|---|---|
| `LISTEN_ADDR` | `:8080` |
| `VECTOR_ID_HEADER` | `X-Vector-ID` |
| `VECTOR_CONFIG_URL` | `http://vector-data-service` |
| `DATABASE_URL` | — |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE` | — |

## Local run

```bash
go mod tidy
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/example?sslmode=disable"
export VECTOR_CONFIG_URL="http://localhost:4000"
go run .
```
