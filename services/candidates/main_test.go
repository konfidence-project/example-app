package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type fakeStore struct {
	candidates []Candidate
	lastQuery  string
}

func (f *fakeStore) InsertCandidate(_ context.Context, name, email string, notes *string) (Candidate, error) {
	c := Candidate{ID: "c-new", Name: name, Email: email, Notes: notes, CreatedAt: time.Date(2026, 11, 17, 9, 12, 0, 0, time.UTC)}
	f.candidates = append(f.candidates, c)
	return c, nil
}

func (f *fakeStore) GetCandidate(_ context.Context, id string) (Candidate, error) {
	for _, c := range f.candidates {
		if c.ID == id {
			return c, nil
		}
	}
	return Candidate{}, errNotFound
}

func (f *fakeStore) UpdateNotes(_ context.Context, id string, notes *string) (Candidate, error) {
	for i, c := range f.candidates {
		if c.ID == id {
			f.candidates[i].Notes = notes
			return f.candidates[i], nil
		}
	}
	return Candidate{}, errNotFound
}

func (f *fakeStore) ListCandidates(_ context.Context, query string) ([]Candidate, error) {
	f.lastQuery = query
	return f.candidates, nil
}

func newTestServer(s store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /candidates", handleListCandidates(s))
	mux.HandleFunc("POST /candidates", handleCreateCandidate(s))
	mux.HandleFunc("GET /candidates/{id}", handleGetCandidate(s))
	mux.HandleFunc("PATCH /candidates/{id}", handleUpdateCandidate(s))
	return withRoutingKey(mux)
}

func TestListCandidatesPassesTrimmedQueryAndReturnsCreatedAt(t *testing.T) {
	created := time.Date(2026, 11, 17, 9, 12, 0, 0, time.UTC)
	s := &fakeStore{candidates: []Candidate{{ID: "a", Name: "Ada Example", Email: "ada@example.com", CreatedAt: created}}}
	rec := httptest.NewRecorder()
	newTestServer(s).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/candidates?q=%20ada%20", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, body %s", rec.Code, rec.Body)
	}
	if s.lastQuery != "ada" {
		t.Errorf("query %q, want %q", s.lastQuery, "ada")
	}
	var got []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0]["created_at"] != "2026-11-17T09:12:00Z" {
		t.Errorf("unexpected body %s", rec.Body)
	}
}

func TestListCandidatesReturnsEmptyArray(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestServer(&fakeStore{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/candidates", nil))
	if strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Errorf("body %q, want []", rec.Body)
	}
}

func TestListCandidatesRejectsLongQuery(t *testing.T) {
	rec := httptest.NewRecorder()
	q := strings.Repeat("a", maxQueryLength+1)
	newTestServer(&fakeStore{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/candidates?q="+q, nil))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status %d, want 400", rec.Code)
	}
}

func TestCreateCandidateRejectsNotesWhenTheFlagIsOff(t *testing.T) {
	// Without a routing key the flag falls back to its default, off.
	body := `{"name":"Ada Example","email":"ada@example.com","notes":"hello"}`
	rec := httptest.NewRecorder()
	newTestServer(&fakeStore{}).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/candidates", strings.NewReader(body)))
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "notes field is not enabled") {
		t.Errorf("status %d body %s", rec.Code, rec.Body)
	}
}

func TestCreateCandidateReturnsCreatedAt(t *testing.T) {
	body := `{"name":"Ada Example","email":"ada@example.com"}`
	rec := httptest.NewRecorder()
	newTestServer(&fakeStore{}).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/candidates", strings.NewReader(body)))
	if rec.Code != http.StatusCreated || !strings.Contains(rec.Body.String(), `"created_at":"2026-11-17T09:12:00Z"`) {
		t.Errorf("status %d body %s", rec.Code, rec.Body)
	}
}

func TestLikePatternEscapesWildcards(t *testing.T) {
	if got := likePattern(`50%_off\`); got != `%50\%\_off\\%` {
		t.Errorf("got %q", got)
	}
}

func TestUpdateCandidateRejectsNotesWhenTheFlagIsOff(t *testing.T) {
	s := &fakeStore{candidates: []Candidate{{ID: "a", Name: "Ada Example"}}}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/candidates/a", strings.NewReader(`{"notes":"hello"}`))
	newTestServer(s).ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || s.candidates[0].Notes != nil {
		t.Errorf("status %d body %s", rec.Code, rec.Body)
	}
}
