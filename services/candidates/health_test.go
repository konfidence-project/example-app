package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReadinessFailureKeepsLivenessHealthy(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /readyz", handleReadiness)
	for _, tc := range []struct {
		path   string
		status int
		body   string
	}{
		{"/healthz", http.StatusOK, "ok"},
		{"/readyz", http.StatusServiceUnavailable, "deliberate readiness failure"},
	} {
		t.Run(tc.path, func(t *testing.T) {
			response := httptest.NewRecorder()
			withRoutingKey(mux).ServeHTTP(response, httptest.NewRequest(http.MethodGet, tc.path, nil))
			if response.Code != tc.status || !strings.Contains(response.Body.String(), tc.body) {
				t.Fatalf("got status %d and body %q", response.Code, response.Body.String())
			}
		})
	}
}
