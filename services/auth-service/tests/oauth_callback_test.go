package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"auth-service/app/database"
	"auth-service/app/dex"
	"auth-service/app/jwt"
	"auth-service/app/middleware"
	"auth-service/app/routes"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
)

// TestOAuthCallbackIssuesJWTAndRedirects ist der Regressionstest für den
// Deployed-Login-Bug: Der echte Dex-OAuth-Callback (routes.OAuthCallback)
// hatte den Browser zuvor auf "/auth-callback?success=true" umgeleitet, OHNE
// ein Choretwo-JWT zu erzeugen und als ?token= an die Frontend-Callback-Seite
// zu übergeben. Das Frontend (auth store handleCallback) liest aber zwingend
// `?token=` und warf "No token in callback URL" → echter Dex-Login scheiterte.
//
// Dieser Test treibt den ECHTEN (nicht Mock-)Callback gegen eine lokale,
// in-memory OIDC-Provider-Attrappe (httptest); die DB-Schicht (GetOrCreateUser)
// wird per go-sqlmock gestubbt, damit der Test hermetisch und ohne echte
// Postgres in CI läuft:
//   - Login ruft GetAuthURL → oauth_state landet in der Session (Cookie).
//   - Callback?code=..&state=<session-state> tauscht den Code und holt die
//     Userinfo → erzeugt ein gültiges Choretwo-JWT und 303-redirectet auf
//     FRONTEND_URL/auth-callback?token=<jwt>&id_token=...&refresh_token=...
//
// Der Test verifiziert die Signatur/Issuer/Audience des JWT direkt.
func TestOAuthCallbackIssuesJWTAndRedirects(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("USE_MOCK_AUTH", "false")
	t.Setenv("JWT_SECRET", "choretwo-test-jwt-secret")
	t.Setenv("FRONTEND_URL", "http://localhost:3000")
	t.Setenv("SERVER_URL", "http://localhost:8001")

	// --- 1. Lokale OIDC-Attrappe (Discovery + Token + UserInfo) ---
	var oidcServer *httptest.Server
	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"issuer":                                oidcServer.URL, // in Closure nach dem Start gesetzt
			"authorization_endpoint":                oidcServer.URL + "/auth",
			"token_endpoint":                        oidcServer.URL + "/token",
			"userinfo_endpoint":                     oidcServer.URL + "/userinfo",
			"jwks_uri":                              oidcServer.URL + "/jwks",
			"response_types_supported":              []string{"code"},
			"subject_types_supported":               []string{"public"},
			"id_token_signing_alg_values_supported": []string{"RS256"},
		})
	})
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad form", http.StatusBadRequest)
			return
		}
		if code := r.PostFormValue("code"); code != "valid-code" {
			http.Error(w, "invalid code", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token":  "mock-access-token",
			"token_type":    "Bearer",
			"expires_in":    3600,
			"refresh_token": "mock-refresh-token",
		})
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer mock-access-token" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"sub":   "user-123",
			"email": "oauth.user@example.com",
			"name":  "OAuth Test User",
		})
	})

	oidcServer = httptest.NewServer(mux)
	defer oidcServer.Close()

	// --- 2. dex.OIDCProvider + OAuth2Config auf die Attrappe richten ---
	provider, err := oidc.NewProvider(context.Background(), oidcServer.URL)
	if err != nil {
		t.Fatalf("failed to create OIDC provider: %v", err)
	}
	dex.OIDCProvider = provider
	dex.OAuth2Config = &oauth2.Config{
		ClientID:     "choretwo-test",
		ClientSecret: "test-secret",
		RedirectURL:  "http://localhost:8001/api/auth/callback",
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
		Endpoint:     provider.Endpoint(),
	}

	// --- 3. jwt + DB-Schicht per sqlmock stubben (hermetisch, kein echtes Postgres) ---
	jwt.InitJWT()
	mockDB, dbMock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	origDB := database.DB
	database.DB = mockDB
	t.Cleanup(func() {
		database.DB = origDB
		_ = mockDB.Close()
	})

	userRows := sqlmock.NewRows([]string{"id", "email", "name", "created_at", "updated_at"}).
		AddRow(1, "oauth.user@example.com", "OAuth Test User", time.Now(), time.Now())
	dbMock.ExpectQuery(`SELECT id, email, name, created_at, updated_at\s+FROM auth\.users WHERE email = \$1`).
		WithArgs("oauth.user@example.com").
		WillReturnRows(sqlmock.NewRows([]string{"id", "email", "name", "created_at", "updated_at"}))
	dbMock.ExpectQuery(`INSERT INTO auth\.users \(email, name\)\s+VALUES \(\$1, \$2\)\s+RETURNING id, email, name, created_at, updated_at`).
		WithArgs("oauth.user@example.com", "OAuth Test User").
		WillReturnRows(userRows)

	// --- 4. Router mit Session + Login/Callback aufbauen ---
	r := gin.New()
	r.Use(middleware.SessionMiddleware())
	r.GET("/api/auth/login", routes.Login)
	r.GET("/api/auth/callback", routes.OAuthCallback)

	// --- 5. Login → oauth_state + Session-Cookie erfassen ---
	loginReq := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	loginW := httptest.NewRecorder()
	r.ServeHTTP(loginW, loginReq)
	if loginW.Code != http.StatusTemporaryRedirect {
		t.Fatalf("login: expected 307, got %d", loginW.Code)
	}

	sessionCookie := extractSessionCookie(t, loginW)
	// oauth_state aus der Session rehydrieren (wie OAuthCallback es tut)
	ctx, _ := gin.CreateTestContext(loginW)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/auth/callback", nil)
	ctx.Request.Header.Set("Cookie", sessionCookie)
	middleware.SessionMiddleware()(ctx)
	stateVal, ok := middleware.GetSessionValue(ctx, "oauth_state").(string)
	if !ok || stateVal == "" {
		t.Fatalf("expected oauth_state in session after login, got %q", stateVal)
	}

	// --- 6. Callback mit code + state (Session-Cookie) ---
	cbURL := fmt.Sprintf("/api/auth/callback?code=valid-code&state=%s", url.QueryEscape(stateVal))
	cbReq := httptest.NewRequest(http.MethodGet, cbURL, nil)
	cbReq.Header.Set("Cookie", sessionCookie)
	cbW := httptest.NewRecorder()
	r.ServeHTTP(cbW, cbReq)

	if cbW.Code != http.StatusSeeOther {
		t.Fatalf("callback: expected 303 redirect, got %d (body=%s)", cbW.Code, cbW.Body.String())
	}

	loc := cbW.Header().Get("Location")
	if !strings.HasPrefix(loc, "http://localhost:3000/auth-callback?token=") {
		t.Fatalf("callback redirect URL not pointing to FRONTEND/auth-callback?token=, got %q", loc)
	}

	parsed, err := url.Parse(loc)
	if err != nil {
		t.Fatalf("failed to parse redirect URL: %v", err)
	}
	q := parsed.Query()
	token := q.Get("token")
	if token == "" {
		t.Fatalf("expected token= query param in redirect, got %q", loc)
	}

	// --- 7. JWT direkt validieren (Signatur, Issuer, Audience, email, name) ---
	claims, err := jwt.ValidateToken(token)
	if err != nil {
		t.Fatalf("issued JWT does not validate: %v", err)
	}
	if claims.Issuer != "choretwo-auth-service" {
		t.Errorf("issuer mismatch: got %q", claims.Issuer)
	}
	if len(claims.Audience) == 0 || claims.Audience[0] != "choretwo" {
		t.Errorf("audience mismatch: got %v", claims.Audience)
	}
	if claims.Email != "oauth.user@example.com" {
		t.Errorf("email mismatch: got %q", claims.Email)
	}
	if claims.Name != "OAuth Test User" {
		t.Errorf("name mismatch: got %q", claims.Name)
	}
	if q.Get("expires_in") != "86400" {
		t.Errorf("expected expires_in=86400, got %q", q.Get("expires_in"))
	}
}

// extractSessionCookie liest das "choretwo-session=" Cookie aus den Set-Cookie-Headern.
func extractSessionCookie(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	for _, sc := range w.Header()["Set-Cookie"] {
		if strings.HasPrefix(sc, "choretwo-session=") {
			return strings.TrimSpace(strings.SplitN(sc, ";", 2)[0])
		}
	}
	t.Fatal("expected choretwo-session cookie to be set")
	return ""
}
