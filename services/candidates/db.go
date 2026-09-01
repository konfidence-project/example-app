package main

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotFound = errors.New("not found")
var errInvalidID = errors.New("invalid id")

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

func (d *DB) InsertCandidate(ctx context.Context, name, email string, notes *string) (string, error) {
	id := uuid.NewString()
	_, err := d.pool.Exec(ctx,
		`INSERT INTO candidates (id, name, email, notes) VALUES ($1, $2, $3, $4)`,
		id, name, email, notes,
	)
	return id, err
}

func (d *DB) GetCandidate(ctx context.Context, id string) (name, email string, notes *string, err error) {
	if _, perr := uuid.Parse(id); perr != nil {
		return "", "", nil, errInvalidID
	}
	err = d.pool.QueryRow(ctx,
		`SELECT name, email, notes FROM candidates WHERE id = $1`, id,
	).Scan(&name, &email, &notes)
	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil, errNotFound
	}
	return name, email, notes, err
}
