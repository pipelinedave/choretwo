package dex

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

var (
	OIDCProvider *oidc.Provider
	OAuth2Config *oauth2.Config

	// Schutz für die Lazy-Re-Initialisierung (ensureInitialized).
	initMu       sync.Mutex
	lastInitFail time.Time
)

const (
	// initRetryAttempts/Delay: Start-Retry-Fenster (10 x 5s = 50s), um
	// transiente Netzwerkfehler beim Pod-Start zu überbrücken.
	initRetryAttempts = 10
	initRetryDelay    = 5 * time.Second
	// initTimeout: Hartes Timeout für den OIDC-Discovery-Call (der Default-
	// HTTP-Client hat kein Timeout und wuerde sonst haengen koennen).
	initTimeout = 10 * time.Second
	// lazyRetryThrottle: Max. ein Re-Init-Versuch pro Fenster, damit
	// Login-Klicks keinen Request-Sturm gegen den OIDC-Provider erzeugen.
	lazyRetryThrottle = 30 * time.Second
)

func InitDex() error {
	issuerURL := os.Getenv("DEX_ISSUER_URL")
	if issuerURL == "" {
		issuerURL = "https://dex.stillon.top"
	}

	clientID := os.Getenv("DEX_CLIENT_ID")
	if clientID == "" {
		clientID = "choretwo"
	}

	clientSecret := os.Getenv("DEX_CLIENT_SECRET")
	if clientSecret == "" {
		return fmt.Errorf("DEX_CLIENT_SECRET is required")
	}

	serverURL := os.Getenv("SERVER_URL")
	if serverURL == "" {
		serverURL = "http://localhost:8001"
	}

	ctx, cancel := context.WithTimeout(context.Background(), initTimeout)
	defer cancel()

	var err error
	OIDCProvider, err = oidc.NewProvider(ctx, issuerURL)
	if err != nil {
		return fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	redirectURL := serverURL + "/api/auth/callback"

	OAuth2Config = &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
		Endpoint:     OIDCProvider.Endpoint(),
	}

	log.Printf("Dex OIDC initialized with issuer: %s", issuerURL)
	return nil
}

// InitDexWithRetry versucht InitDex mehrfach mit festem Backoff. Ein
// transienter Fehler beim Pod-Start (z.B. Cloudflare 522, Dex kurz nicht
// erreichbar) darf den Service nicht dauerhaft in einen Zustand mit nil
// OAuth2Config versetzen (fuehrte zu Panic/500 bei jedem Login).
func InitDexWithRetry() error {
	var err error
	for attempt := 1; attempt <= initRetryAttempts; attempt++ {
		if err = InitDex(); err == nil {
			return nil
		}
		log.Printf("Dex initialization attempt %d/%d failed: %v", attempt, initRetryAttempts, err)
		if attempt < initRetryAttempts {
			time.Sleep(initRetryDelay)
		}
	}
	return fmt.Errorf("dex initialization failed after %d attempts: %w", initRetryAttempts, err)
}

// ensureInitialized stellt sicher, dass OAuth2Config gesetzt ist. Ist das
// nicht der Fall (z.B. weil InitDex beim Start an einem transienten
// Netzwerkfehler scheiterte), wird on-demand neu initialisiert — gedrosselt
// auf einen Versuch pro lazyRetryThrottle. So erholt sich der Service selbst,
// sobald der OIDC-Provider wieder erreichbar ist, ohne Pod-Restart.
func ensureInitialized() error {
	if OAuth2Config != nil {
		return nil
	}

	initMu.Lock()
	defer initMu.Unlock()

	if OAuth2Config != nil {
		return nil
	}
	if !lastInitFail.IsZero() && time.Since(lastInitFail) < lazyRetryThrottle {
		return fmt.Errorf("dex OAuth2 not initialized (last attempt failed %.0fs ago, retry throttled)",
			time.Since(lastInitFail).Seconds())
	}

	if err := InitDex(); err != nil {
		lastInitFail = time.Now()
		return fmt.Errorf("dex re-initialization failed: %w", err)
	}
	lastInitFail = time.Time{}
	return nil
}

// GetAuthURL liefert die Dex-Authorization-URL oder einen Fehler, wenn der
// OAuth-Client nicht initialisiert ist (statt auf nil zu dereferenzieren).
func GetAuthURL(state string) (string, error) {
	if err := ensureInitialized(); err != nil {
		return "", err
	}
	return OAuth2Config.AuthCodeURL(state, oauth2.AccessTypeOffline), nil
}

func ExchangeToken(ctx context.Context, code string) (*oauth2.Token, error) {
	if err := ensureInitialized(); err != nil {
		return nil, err
	}
	return OAuth2Config.Exchange(ctx, code)
}

func UserInfoFromToken(ctx context.Context, token *oauth2.Token) (*oidc.UserInfo, error) {
	if OIDCProvider == nil {
		return nil, fmt.Errorf("dex OIDC provider not initialized")
	}
	return OIDCProvider.UserInfo(ctx, oauth2.StaticTokenSource(token))
}

func IsMockAuthEnabled() bool {
	return os.Getenv("USE_MOCK_AUTH") == "true"
}

func GetServerURL() string {
	url := os.Getenv("SERVER_URL")
	if url == "" {
		url = "http://localhost:8001"
	}
	return url
}
