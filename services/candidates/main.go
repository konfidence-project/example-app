package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"
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
	mux.HandleFunc("GET /candidates/debug", handleDebug)
	mux.HandleFunc("GET /candidates", handleListCandidates(db))
	mux.HandleFunc("POST /candidates", handleCreateCandidate(db))
	mux.HandleFunc("GET /candidates/{id}", handleGetCandidate(db))
	mux.HandleFunc("PATCH /candidates/{id}", handleUpdateCandidate(db))

	addr := envOr("LISTEN_ADDR", ":8080")
	srv := &http.Server{
		Addr:         addr,
		Handler:      withRoutingKey(mux),
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

// handleDebug returns every feature flag the active vector carries.
func handleDebug(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"service":    "candidates",
		"runtime":    "Go " + strings.TrimPrefix(runtime.Version(), "go"),
		"routingKey": routingKeyFromContext(r.Context()),
		"flags":      allFlags(r.Context()),
	})
}

type createCandidateRequest struct {
	Name  string  `json:"name"`
	Email string  `json:"email"`
	Notes *string `json:"notes,omitempty"`
}

type candidateResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Notes     *string   `json:"notes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

func toResponse(c Candidate) candidateResponse {
	return candidateResponse{ID: c.ID, Name: c.Name, Email: c.Email, Notes: c.Notes, CreatedAt: c.CreatedAt.UTC()}
}

// maxQueryLength bounds the search term of GET /candidates.
const maxQueryLength = 200

// handleListCandidates returns every candidate, or with ?q= the ones whose
// name or email contains q.
func handleListCandidates(db store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		if len(query) > maxQueryLength {
			writeError(w, http.StatusBadRequest, "q is too long")
			return
		}
		candidates, err := db.ListCandidates(r.Context(), query)
		if err != nil {
			log.Printf("list: %v", err)
			writeError(w, http.StatusInternalServerError, "storage error")
			return
		}
		out := make([]candidateResponse, 0, len(candidates))
		for _, c := range candidates {
			out = append(out, toResponse(c))
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func handleCreateCandidate(db store) http.HandlerFunc {
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
			writeError(w, http.StatusBadRequest, "notes field is not enabled")
			return
		}

		c, err := db.InsertCandidate(r.Context(), req.Name, req.Email, req.Notes)
		if err != nil {
			log.Printf("insert: %v", err)
			writeError(w, http.StatusInternalServerError, "storage error")
			return
		}

		writeJSON(w, http.StatusCreated, toResponse(c))
	}
}

func handleGetCandidate(db store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == "" {
			writeError(w, http.StatusBadRequest, "id is required")
			return
		}
		c, err := db.GetCandidate(r.Context(), id)
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
		writeJSON(w, http.StatusOK, toResponse(c))
	}
}

// handleUpdateCandidate changes the notes of a candidate. Like on create,
// notes are only accepted when enable-candidate-notes is on. Null, an empty
// or a blank string clears them.
//
// The example app has no users, so there is no identity or permission check:
// whoever reaches the service can change notes. Do not put real personal data
// into it.
func handleUpdateCandidate(db store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// A map tells a missing "notes" key from an explicit null, so a typo in
		// the field name cannot clear the notes.
		var req map[string]*string
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid json")
			return
		}
		notes, ok := req["notes"]
		if !ok {
			writeError(w, http.StatusBadRequest, "notes is required, use null to clear them")
			return
		}
		if notes != nil && strings.TrimSpace(*notes) == "" {
			notes = nil
		}
		if !isEnabled(r.Context(), "enable-candidate-notes", false) {
			writeError(w, http.StatusBadRequest, "notes field is not enabled")
			return
		}
		c, err := db.UpdateNotes(r.Context(), r.PathValue("id"), notes)
		if err != nil {
			if errors.Is(err, errInvalidID) {
				writeError(w, http.StatusBadRequest, "invalid candidate id")
				return
			}
			if errors.Is(err, errNotFound) {
				writeError(w, http.StatusNotFound, "candidate not found")
				return
			}
			log.Printf("update: %v", err)
			writeError(w, http.StatusInternalServerError, "storage error")
			return
		}
		writeJSON(w, http.StatusOK, toResponse(c))
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
