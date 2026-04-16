package routes

import (
	"log"
	"net/http"
	"os"

	"auth-service/app/dex"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Login(c *gin.Context) {
	if dex.IsMockAuthEnabled() {
		mockLoginRedirect(c)
		return
	}

	state := uuid.New().String()
	session := c.GetStringMap("session")
	session["oauth_state"] = state

	authURL := dex.GetAuthURL(state)
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

	session := c.GetStringMap("session")
	expectedState, ok := session["oauth_state"].(string)
	if !ok || expectedState != state {
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

	email := userInfo.Email
	name := email

	if claims, ok := userInfo.Claims.(map[string]interface{}); ok {
		if n, exists := claims["name"]; exists {
			name = n.(string)
		}
	}

	session["user_email"] = email
	session["user_name"] = name
	session["access_token"] = token.AccessToken
	session["refresh_token"] = token.RefreshToken

	c.Redirect(http.StatusTemporaryRedirect, "/auth-callback?success=true")
}
