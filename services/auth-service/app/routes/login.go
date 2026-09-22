package routes

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"auth-service/app/database"
	"auth-service/app/dex"
	"auth-service/app/jwt"
	"auth-service/app/middleware"
	"auth-service/app/redis"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Login(c *gin.Context) {
	if dex.IsMockAuthEnabled() {
		mockLoginRedirect(c)
		return
	}

	state := uuid.New().String()

	// oauth_state primär in Redis ablegen, damit er den Cross-Host-Dex-Roundtrip
	// (choretwo.stillon.top -> dex.stillon.top -> callback) zuverlässig überlebt.
	redis.SetOAuthState(c.Request.Context(), state)

	// Cookie-Wert als Fallback setzen, falls Redis nicht verfügbar ist oder der
	// State im Roundtrip doch im Session-Cookie mitkommt.
	middleware.SetSessionValue(c, "oauth_state", state)

	authURL, err := dex.GetAuthURL(state)
	if err != nil {
		// Dex-OAuth-Client nicht initialisiert (z.B. InitDex beim Start an
		// transientem Netzwerkfehler gescheitert): sauberer 503 statt Panic.
		// ensureInitialized() versucht on-demand ein Re-Init (gedrosselt),
		// sobald der OIDC-Provider wieder erreichbar ist.
		log.Printf("Login failed: %v", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Authentication service is temporarily unavailable. Please try again in a moment.",
		})
		return
	}
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

func mockLoginRedirect(c *gin.Context) {
	serverURL := dex.GetServerURL()
	mockLoginURL := serverURL + "/api/auth/mock-login-page"
	c.Redirect(http.StatusTemporaryRedirect, mockLoginURL)
}

func OAuthCallback(c *gin.Context) {
	if dex.IsMockAuthEnabled() {
		c.Redirect(http.StatusTemporaryRedirect, "/api/auth/mock-callback")
		return
	}

	code := c.Query("code")
	state := c.Query("state")
	errorParam := c.Query("error")

	if errorParam != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "OAuth error: " + errorParam,
		})
		return
	}

	// State-Validierung: Der oauth_state wird primär gegen Redis geprüft (one-time),
	// weil das Cookie den Cross-Host-Dex-Roundtrip nicht zuverlässig überlebt.
	// Liefert Redis einen Treffer, verbrauchen wir den State und löschen ihn.
	stateValid := redis.GetOAuthState(c.Request.Context(), state)
	if stateValid {
		redis.DeleteOAuthState(c.Request.Context(), state)
	} else {
		// Fallback: Session-Cookie-Wert (z.B. wenn kein Redis konfiguriert ist).
		expectedState, ok := middleware.GetSessionValue(c, "oauth_state").(string)
		stateValid = ok && expectedState == state
	}

	if !stateValid {
		log.Printf("OAuth callback: invalid state parameter (state=%q)", state)
		c.JSON(http.StatusForbidden, gin.H{
			"error": "Invalid state parameter",
		})
		return
	}

	ctx := c.Request.Context()
	token, err := dex.ExchangeToken(ctx, code)
	if err != nil {
		log.Printf("Token exchange failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to exchange token",
		})
		return
	}

	userInfo, err := dex.GetUserInfo(ctx, token)
	if err != nil {
		log.Printf("Failed to get user info: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get user info",
		})
		return
	}

	email, ok := userInfo["email"].(string)
	if !ok || email == "" {
		log.Printf("Email not found in user info")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Email not found in user info",
		})
		return
	}

	name, ok := userInfo["name"].(string)
	if !ok || name == "" {
		name = email
	}

	middleware.SetSessionValue(c, "user_email", email)
	middleware.SetSessionValue(c, "user_name", name)
	middleware.SetSessionValue(c, "access_token", token.AccessToken)
	middleware.SetSessionValue(c, "refresh_token", token.RefreshToken)

	// Den Nutzer in der DB anlegen/laden (identisch zum Mock-Pfad), damit
	// der OAuth-Login denselben konsistenten User-Stamm erzeugt.
	user, err := database.GetOrCreateUser(email, name)
	if err != nil {
		log.Printf("Failed to get or create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create user",
		})
		return
	}

	// Choretwo-JWT für den authentifizierten Nutzer erzeugen (analog MockCallback).
	accessToken, refreshToken, err := jwt.GenerateToken(user.Email, user.Name)
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate token",
		})
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	// Browser zum Frontend-Callback umleiten und das JWT als Query-Param mitgeben.
	redirectURL := fmt.Sprintf("%s/auth-callback?token=%s&id_token=%s&refresh_token=%s&expires_in=86400",
		frontendURL, accessToken, accessToken, refreshToken)

	c.Redirect(http.StatusSeeOther, redirectURL)
}
