// Package redis kapselt die Verbindung zu Redis und den oauth_state-Speicher.
//
// Hintergrund: Der oauth_state wurde früher ausschließlich im CookieStore-Session
// ("choretwo-session"-Cookie) gespeichert. Das Cookie überschreibt den Cross-Host-
// Dex-Roundtrip (choretwo.stillon.top -> dex.stillon.top -> choretwo.stillon.top)
// nicht zuverlässig, wodurch der OAuth-Callback mit "Invalid state parameter" (403)
// abbrach. Der State wird deshalb jetzt zusätzlich (pflichtgemäß) in Redis abgelegt:
//   - Login:        oauth_state:<state> mit kurzer TTL (10 min) in Redis
//   - OAuthCallback: state aus dem Query gegen den Redis-Wert prüfen, bei Treffer
//     einmalig löschen (One-Time)
//
// Ist Redis nicht erreichbar (z.B. Dev ohne Redis), degrade graceful auf den
// bestehenden Cookie-Session-Fallback — der auth-service darf an fehlendem Redis
// nie hart scheitern (Konsistenz mit dem Stabilitäts-Ziel des Deployments).
package redis

import (
	"context"
	"log"
	"os"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// oauthStateTTL ist die Lebensdauer eines oauth_state in Redis. Sie reicht locker
// für den Dex-Roundtrip, begrenzt aber die Wiederverwendbarkeit gestohlener States.
const oauthStateTTL = 10 * time.Minute

var (
	client *goredis.Client
	// available ist false, wenn Redis nicht erreichbar konfiguriert ist. In dem
	// Fall liefern Get/Delete einen Miss zurück, damit der Callback auf den
	// Cookie-Fallback zurückfällt.
	available bool
)

// Init verbindet sich mit Redis (REDIS_URL aus Env). Fehler sind nicht fatal:
// bei fehlendem/nicht erreichbarem Redis degradiert das System auf den
// Cookie-Fallback, ohne den Pod zu beenden.
func Init() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		log.Println("Redis: REDIS_URL not set, oauth_state stays in session-cookie only (fallback)")
		available = false
		return
	}

	opt, err := goredis.ParseURL(redisURL)
	if err != nil {
		log.Printf("Redis: invalid REDIS_URL %q (%v), using cookie fallback", redisURL, err)
		available = false
		return
	}

	client = goredis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("Redis: ping failed (%v), using cookie fallback", err)
		available = false
		return
	}

	available = true
	log.Println("Redis: connection established")
}

// SetOAuthState legt den oauth_state mit kurzer TTL in Redis ab.
func SetOAuthState(ctx context.Context, state string) {
	if !available {
		return
	}
	if err := client.Set(ctx, "oauth_state:"+state, "1", oauthStateTTL).Err(); err != nil {
		log.Printf("Redis: failed to set oauth_state (%v)", err)
	}
}

// GetOAuthState prüft, ob ein oauth_state in Redis existiert. Liefert false bei
// fehlendem State oder wenn Redis nicht verfügbar ist (dann entscheidet der Callback
// über den Cookie-Fallback).
func GetOAuthState(ctx context.Context, state string) bool {
	if !available {
		return false
	}
	n, err := client.Exists(ctx, "oauth_state:"+state).Result()
	if err != nil {
		log.Printf("Redis: failed to read oauth_state (%v)", err)
		return false
	}
	return n > 0
}

// DeleteOAuthState entfernt den oauth_state einmalig aus Redis (One-Time-Verbrauch).
// Ein Fehler wird nur geloggt, nicht als fatal behandelt.
func DeleteOAuthState(ctx context.Context, state string) {
	if !available {
		return
	}
	if err := client.Del(ctx, "oauth_state:"+state).Err(); err != nil {
		log.Printf("Redis: failed to delete oauth_state (%v)", err)
	}
}
