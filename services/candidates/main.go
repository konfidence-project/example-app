package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	ctx, stop := context.WithCancel(context.Background())
	defer stop()

	db, err := openDB(ctx)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer db.Close()

	if err := initOpenFeature(ctx); err != nil {
		log.Fatalf("openfeature: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("POST /candidates", handleCreateCandidate(db))
	mux.HandleFunc("GET /candidates/{id}", handleGetCandidate(db))

	addr := envOr("LISTEN_ADDR", ":8080")
	srv := &http.Server{
		Addr:         addr,
		Handler:      withVectorID(mux),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	log.Printf("candidates listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server: %v", err)
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

type createCandidateRequest struct {
	Name  string  `json:"name"`
	Email string  `json:"email"`
	Notes *string `json:"notes,omitempty"`
}

type candidateResponse struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Email string  `json:"email"`
	Notes *string `json:"notes,omitempty"`
}

func handleCreateCandidate(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createCandidateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid json")
			return
		}
		if req.Name == "" || req.Email == "" {
			writeError(w, http.StatusBadRequest, "name and email are required")
			return
		}

		if req.Notes != nil && !isEnabled(r.Context(), "enable-candidate-notes", false) {
			writeError(w, http.StatusBadRequest, "notes field is not enabled for this vector")
			return
		}

		id, err := db.InsertCandidate(r.Context(), req.Name, req.Email, req.Notes)
		if err != nil {
			log.Printf("insert: %v", err)
			writeError(w, http.StatusInternalServerError, "storage error")
			return
		}

		writeJSON(w, http.StatusCreated, candidateResponse{
			ID: id, Name: req.Name, Email: req.Email, Notes: req.Notes,
		})
	}
}

func handleGetCandidate(db *DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			writeError(w, http.StatusBadRequest, "id is required")
			return
		}
		name, email, notes, err := db.GetCandidate(r.Context(), id)
		if err != nil {
			if errors.Is(err, errInvalidID) {
				writeError(w, http.StatusBadRequest, "invalid candidate id")
				return
			}
			if errors.Is(err, errNotFound) {
				writeError(w, http.StatusNotFound, "candidate not found")
				return
			}
			log.Printf("select: %v", err)
			writeError(w, http.StatusInternalServerError, "storage error")
			return
		}
		writeJSON(w, http.StatusOK, candidateResponse{
			ID: id, Name: name, Email: email, Notes: notes,
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
