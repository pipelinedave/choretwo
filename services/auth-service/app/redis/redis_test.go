package redis

import (
	"context"
	"os"
	"testing"
)

// TestOAuthStateRoundtrip prüft den Kern des Produktions-Fixes: Der oauth_state
// wird in Redis abgelegt, im Callback geprüft und nach erfolgreichem Treffer
// einmalig gelöscht (One-Time-Verbrauch).
//
// Umgebung: benötigt ein erreichbares Redis (REDIS_URL). Ist keines konfiguriert
// oder nicht erreichbar, degradiert redis graceful (available=false) und der
// Test wird übersprungen (konsistent mit dem Fallback-Verhalten).
func TestOAuthStateRoundtrip(t *testing.T) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://127.0.0.1:6379"
	}
	t.Setenv("REDIS_URL", redisURL)
	Init()

	if !available {
		t.Skip("Redis not available, skipping (cookie fallback applies)")
	}

	ctx := context.Background()
	state := "test-state-uuid-12345"

	// State noch nicht vorhanden
	if GetOAuthState(ctx, state) {
		t.Fatalf("expected state to be absent before login")
	}

	// Login speichert den State
	SetOAuthState(ctx, state)
	if !GetOAuthState(ctx, state) {
		t.Fatalf("expected state present after login (Set+Get roundtrip)")
	}

	// Callback verbraucht den State einmalig
	DeleteOAuthState(ctx, state)
	if GetOAuthState(ctx, state) {
		t.Fatalf("expected state to be deleted after one-time consumption")
	}
}
