package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"auth-service/app/dex"
	"auth-service/app/middleware"
	"auth-service/app/routes"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

// TestLoginNoPanic ist der Regressionstest für den Deployed-Bug:
// `assignment to entry in nil map` (app/routes/login.go:21) — ausgelöst durch
// `c.GetStringMap("session")` auf einen *sessions.Session (wg. Struct != Map).
// Der Fix nutzt middleware.SetSessionValue/GetSessionValue statt nil-Map-Zugriff.
// GET /api/auth/login darf KEINEN 500/Panic mehr werfen, sondern einen 307-Redirect.
func TestLoginNoPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Nicht-Mock-Pfad aktivieren (Bug liegt im echten Dex-Login, nicht im Mock).
	t.Setenv("USE_MOCK_AUTH", "false")

	// dex.OAuth2Config manuell setzen, damit GetAuthURL keinen echten OIDC-
	// Provider-// Netzwerk-Call macht, sondern identisch (Redirect mit state) läuft.
	// oauth2.Config.Endpoint wird für AuthCodeURL nicht wirklich kontaktiert.
	dex.OAuth2Config = &oauth2.Config{
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		RedirectURL:  "http://localhost:8001/api/auth/callback",
		Scopes:       []string{"openid", "profile", "email"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://dex.example.com/auth",
			TokenURL: "https://dex.example.com/token",
		},
	}

	r := gin.New()
	r.Use(middleware.SessionMiddleware())
	r.GET("/api/auth/login", routes.Login)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	w := httptest.NewRecorder()

	// Muss ohne Panic/goroutine-recovery durchlaufen → bei Panic schlägt der Test fehl.
	r.ServeHTTP(w, req)

	if w.Code == http.StatusInternalServerError {
		t.Fatalf("Login returned 500 (nil-map panic regression) - got code %d", w.Code)
	}
	if w.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected 307 redirect, got %d", w.Code)
	}

	loc := w.Header().Get("Location")
	if loc == "" {
		t.Fatal("expected Location header on login redirect, got empty")
	}

	// Session-Wert wurde über die korrigierte SetSessionValue-API persistiert.
	// Roundtrip innerhalb eines Request-Kontexts prüfen (Symmetrie Set/Get).
	ctx, _ := gin.CreateTestContext(w)
	mw := middleware.SessionMiddleware()
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	mw(ctx)
	middleware.SetSessionValue(ctx, "oauth_state", "test-state-123")
	got := middleware.GetSessionValue(ctx, "oauth_state")
	if got != "test-state-123" {
		t.Fatalf("SetSessionValue/GetSessionValue roundtrip failed: got %v", got)
	}
}

// TestLoginReturns503WhenDexNotInitialized ist der Regressionstest für den
// Produktionsvorfall vom 22.09.2026: InitDex scheiterte beim Pod-Start an
// einem transienten Cloudflare-522 (Dex-Discovery nicht erreichbar), main()
// loggte nur "Falling back to mock auth" (ohne echten Fallback) und lief mit
// dex.OAuth2Config == nil weiter. Jeder Login-Klick panickte dann in
// dex.GetAuthURL (nil-pointer dereference) → Gin-Recovery → 500.
//
// Erwartetes Verhalten nach Fix: KEIN Panic, sondern ein sauberer 503 mit
// verstaendlicher Fehlermeldung, solange der OAuth-Client nicht initialisiert
// ist (ensureInitialized() retry't on-demand, sobald Dex erreichbar ist).
func TestLoginReturns503WhenDexNotInitialized(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("USE_MOCK_AUTH", "false")
	// Kein Client-Secret → InitDex scheitert sofort und OHNE Netzwerk-Call
	// ("DEX_CLIENT_SECRET is required"), der Test bleibt hermetisch/schnell.
	t.Setenv("DEX_CLIENT_SECRET", "")

	// Zustand des Produktionsvorfalls reproduzieren: Config nil (z.B. nach
	// fehlgeschlagenem InitDex beim Start).
	dex.OAuth2Config = nil

	r := gin.New()
	r.Use(middleware.SessionMiddleware())
	r.GET("/api/auth/login", routes.Login)

	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code == http.StatusInternalServerError {
		t.Fatalf("Login returned 500 (nil-config panic regression) - got code %d", w.Code)
	}
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 while dex not initialized, got %d (body=%s)", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "temporarily unavailable") {
		t.Fatalf("expected user-friendly 503 message, got body: %s", w.Body.String())
	}
}

// TestLoginStatePersistedAcrossRequests prüft den kompletten Session-Roundtrip,
// den OAuthCallback nach dem Login nutzt: Der beim Login per SetSessionValue
// geschriebene oauth_state muss in einem Folge-Request mit dem Session-Cookie
// per GetSessionValue wieder lesbar sein (ohne nil-Map-Panic).
func TestLoginStatePersistedAcrossRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("USE_MOCK_AUTH", "false")

	dex.OAuth2Config = &oauth2.Config{
		ClientID: "test-client", ClientSecret: "test-secret",
		RedirectURL: "http://localhost:8001/api/auth/callback",
		Endpoint:    oauth2.Endpoint{AuthURL: "https://dex.example.com/auth", TokenURL: "https://dex.example.com/token"},
	}

	r := gin.New()
	r.Use(middleware.SessionMiddleware())
	r.GET("/api/auth/login", routes.Login)

	// 1. Login-Request → schreibt oauth_state in die Session + setzt Cookie.
	req := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected 307, got %d", w.Code)
	}

	// Session-Cookie direkt aus dem Set-Cookie-Header parsen (robust im Test).
	scHeaders := w.Header()["Set-Cookie"]
	if len(scHeaders) == 0 {
		t.Fatal("expected Set-Cookie header to be set")
	}
	var cookieStr string
	for _, sc := range scHeaders {
		// Erster Token vor ';' = "choretwo-session=<value>" → als Cookie-Header nutzbar.
		if strings.HasPrefix(sc, "choretwo-session=") {
			if parts := strings.SplitN(sc, ";", 2); len(parts) > 0 {
				cookieStr = strings.TrimSpace(parts[0])
				break
			}
		}
	}
	if cookieStr == "" {
		t.Fatal("expected choretwo-session cookie to be set")
	}

	// 2. Folge-Request mit dem Cookie durch die SessionMiddleware → Session wird
	//    aus dem Cookie rehydriert, oauth_state muss lesbar sein (wie OAuthCallback).
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/auth/callback", nil)
	ctx.Request.Header.Set("Cookie", cookieStr)
	middleware.SessionMiddleware()(ctx)

	state, ok := middleware.GetSessionValue(ctx, "oauth_state").(string)
	if !ok || state == "" {
		t.Fatalf("expected oauth_state in session after roundtrip (ok=%v), got %q", ok, state)
	}
}
