package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

// dbRetryAttempts und dbRetryDelay steuern den nicht-fatalen Startup-Retry.
// Der auth-service darf bei transienten DNS-/DB-Problemen (beobachtet in Prod:
// CoreDNS "connection refused", "no such host") nicht mehr hart per log.Fatalf
// beenden (das verursachte den CrashLoop). Stattdessen retried er begrenzt und
// läuft weiter; DB-Operationen zur Laufzeit scheitern dann isoliert.
const (
	dbRetryAttempts = 10
	dbRetryDelay    = 3 * time.Second
)

func InitDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://choretwo:choretwo_dev@postgres:5432/choretwo?schema=auth"
	}

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Printf("Failed to open database handle: %v (continuing with retry)", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	for attempt := 1; attempt <= dbRetryAttempts; attempt++ {
		if err = DB.Ping(); err == nil {
			log.Println("Database connection established")
			return
		}
		log.Printf("Failed to ping database (attempt %d/%d): %v", attempt, dbRetryAttempts, err)
		time.Sleep(dbRetryDelay)
	}

	// Nach den Retries: nicht fatal, damit der Pod bei transiärem DNS-Ausfall am
	// Leben bleibt (Liveness-Probe prüft nur /health). Fehlgeschlagene
	// DB-Aufrufe zur Laufzeit scheitern dann isoliert.
	log.Printf("Database unavailable after %d attempts — continuing without DB connection", dbRetryAttempts)
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}

func RunMigrations() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS auth.users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email)`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	log.Println("Database migrations completed")
	return nil
}
