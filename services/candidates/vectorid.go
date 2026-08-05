package main

import (
	"context"
	"net/http"
)

var vectorIDHeader = envOr("VECTOR_ID_HEADER", "X-Vector-ID")

type vectorIDKey struct{}

func withVectorID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), vectorIDKey{}, r.Header.Get(vectorIDHeader))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func vectorIDFromContext(ctx context.Context) string {
	v, _ := ctx.Value(vectorIDKey{}).(string)
	return v
}
