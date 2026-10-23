package main

import (
	"context"
	"log"
	"net/http"
)

const routingKeyHeader = "X-Konfidence-Routing-Key"

type routingKeyCtx struct{}

func withRoutingKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get(routingKeyHeader)
		if r.URL.Path != "/healthz" {
			log.Printf("candidates: incoming request %s %s routingKey=%q", r.Method, r.URL.Path, key)
		}
		if key != "" {
			w.Header().Set(routingKeyHeader, key)
		}
		ctx := context.WithValue(r.Context(), routingKeyCtx{}, key)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func routingKeyFromContext(ctx context.Context) string {
	v, _ := ctx.Value(routingKeyCtx{}).(string)
	return v
}
