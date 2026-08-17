package main

import (
	"context"
	"log"
	"net/http"
)

var vectorIDHeader = envOr("VECTOR_ID_HEADER", "X-Vector-ID")

type vectorIDKey struct{}

func withVectorID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		vid := r.Header.Get(vectorIDHeader)
		if r.URL.Path != "/healthz" {
			log.Printf("candidates: incoming request %s %s vectorId=%q", r.Method, r.URL.Path, vid)
		}
		ctx := context.WithValue(r.Context(), vectorIDKey{}, vid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func vectorIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(vectorIDKey{}).(string)
	return v
}
