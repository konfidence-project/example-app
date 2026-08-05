# syntax=docker/dockerfile:1
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/candidates .

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/candidates /candidates
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/candidates"]
