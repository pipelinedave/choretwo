package dex

import (
	"context"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type TokenVerifier struct {
	verifier *oidc.IDTokenVerifier
}

func NewTokenVerifier(clientID string) *TokenVerifier {
	return &TokenVerifier{
		verifier: OIDCProvider.Verifier(&oidc.Config{ClientID: clientID}),
	}
}

func VerifyIDToken(ctx context.Context, idTokenString string, clientID string) (*oidc.IDToken, error) {
	verifier := OIDCProvider.Verifier(&oidc.Config{ClientID: clientID})
	return verifier.Verify(ctx, idTokenString)
}

func GetUserInfo(ctx context.Context, oauthToken *oauth2.Token) (map[string]interface{}, error) {
	userInfo, err := OIDCProvider.UserInfo(ctx, oauth2.StaticTokenSource(oauthToken))
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}

	var claims map[string]interface{}
	if err := userInfo.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %w", err)
	}

	return claims, nil
}
