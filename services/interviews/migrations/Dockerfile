# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM alpine:3.24 AS build
# The build stage only downloads, so it runs natively; TARGETARCH picks the
# binary for the image being built.
ARG TARGETARCH
RUN apk add --no-cache curl \
 && curl -sSfL "https://github.com/golang-migrate/migrate/releases/download/v4.18.1/migrate.linux-${TARGETARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin migrate

FROM alpine:3.24
RUN apk add --no-cache postgresql16-client
COPY --from=build /usr/local/bin/migrate /usr/local/bin/migrate
COPY *.sql /migrations/
