# syntax=docker/dockerfile:1
# Cross-compile on the build platform instead of emulating each target.
FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags='-s -w' -o /out/candidates .

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/candidates /candidates
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/candidates"]
