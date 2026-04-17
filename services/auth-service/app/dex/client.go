package dex

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

var (
	OIDCProvider *oidc.Provider
	OAuth2Config *oauth2.Config
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

	var err error
	OIDCProvider, err = oidc.NewProvider(context.Background(), issuerURL)
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

func GetAuthURL(state string) string {
	return OAuth2Config.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

func ExchangeToken(ctx context.Context, code string) (*oauth2.Token, error) {
	return OAuth2Config.Exchange(ctx, code)
}

func UserInfoFromToken(ctx context.Context, token *oauth2.Token) (*oidc.UserInfo, error) {
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
