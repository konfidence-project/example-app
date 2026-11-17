package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotFound = errors.New("not found")
var errInvalidID = errors.New("invalid id")

// listLimit caps GET /candidates. The example app has no paging.
const listLimit = 500

// Candidate is one row of the candidates table.
type Candidate struct {
	ID        string
	Name      string
	Email     string
	Notes     *string
	CreatedAt time.Time
}

// store is what the HTTP handlers need from the database.
type store interface {
	InsertCandidate(ctx context.Context, name, email string, notes *string) (Candidate, error)
	GetCandidate(ctx context.Context, id string) (Candidate, error)
	ListCandidates(ctx context.Context, query string) ([]Candidate, error)
	UpdateNotes(ctx context.Context, id string, notes *string) (Candidate, error)
}

type DB struct {
	pool *pgxpool.Pool
}

func openDB(ctx context.Context) (*DB, error) {
	pool, err := pgxpool.New(ctx, dsn())
	if err != nil {
		return nil, fmt.Errorf("pgxpool.New: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	return &DB{pool: pool}, nil
}

func dsn() string {
	if v := os.Getenv("DATABASE_URL"); v != "" {
		return v
	}
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		envOr("PGUSER", "postgres"),
		os.Getenv("PGPASSWORD"),
		envOr("PGHOST", "postgres"),
		envOr("PGPORT", "5432"),
		envOr("PGDATABASE", "example"),
		envOr("PGSSLMODE", "disable"),
	)
}

func (d *DB) Close() { d.pool.Close() }

func (d *DB) InsertCandidate(ctx context.Context, name, email string, notes *string) (Candidate, error) {
	c := Candidate{ID: uuid.NewString(), Name: name, Email: email, Notes: notes}
	err := d.pool.QueryRow(ctx,
		`INSERT INTO candidates (id, name, email, notes) VALUES ($1, $2, $3, $4) RETURNING created_at`,
		c.ID, name, email, notes,
	).Scan(&c.CreatedAt)
	return c, err
}

func (d *DB) GetCandidate(ctx context.Context, id string) (Candidate, error) {
	if _, perr := uuid.Parse(id); perr != nil {
		return Candidate{}, errInvalidID
	}
	c := Candidate{ID: id}
	err := d.pool.QueryRow(ctx,
		`SELECT name, email, notes, created_at FROM candidates WHERE id = $1`, id,
	).Scan(&c.Name, &c.Email, &c.Notes, &c.CreatedAt)
	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return Candidate{}, errNotFound
	}
	return c, err
}

// UpdateNotes replaces the notes of a candidate. Nil clears them.
func (d *DB) UpdateNotes(ctx context.Context, id string, notes *string) (Candidate, error) {
	if _, perr := uuid.Parse(id); perr != nil {
		return Candidate{}, errInvalidID
	}
	c := Candidate{ID: id}
	err := d.pool.QueryRow(ctx,
		`UPDATE candidates SET notes = $2 WHERE id = $1 RETURNING name, email, notes, created_at`, id, notes,
	).Scan(&c.Name, &c.Email, &c.Notes, &c.CreatedAt)
	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return Candidate{}, errNotFound
	}
	return c, err
}

// ListCandidates returns candidates ordered by name. A non-empty query keeps
// the rows whose name or email contains it, ignoring case.
func (d *DB) ListCandidates(ctx context.Context, query string) ([]Candidate, error) {
	rows, err := d.pool.Query(ctx,
		`SELECT id, name, email, notes, created_at FROM candidates
		 WHERE $1 = '' OR name ILIKE $2 OR email ILIKE $2
		 ORDER BY name, id
		 LIMIT $3`,
		query, likePattern(query), listLimit,
	)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Candidate, error) {
		var c Candidate
		err := row.Scan(&c.ID, &c.Name, &c.Email, &c.Notes, &c.CreatedAt)
		return c, err
	})
}

// likePattern turns a search term into an ILIKE pattern that matches the term
// anywhere. %, _ and \ in the term match themselves.
func likePattern(query string) string {
	escaped := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(query)
	return "%" + escaped + "%"
}
