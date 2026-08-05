FROM alpine:3.20 AS build
RUN apk add --no-cache curl \
 && curl -sSfL https://github.com/golang-migrate/migrate/releases/download/v4.18.1/migrate.linux-amd64.tar.gz \
    | tar -xz -C /usr/local/bin migrate

FROM alpine:3.20
RUN apk add --no-cache postgresql16-client
COPY --from=build /usr/local/bin/migrate /usr/local/bin/migrate
COPY *.sql /migrations/
