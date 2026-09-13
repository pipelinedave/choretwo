package routes

import (
	"log"
	"net/http"

	"auth-service/app/dex"
	"auth-service/app/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Login(c *gin.Context) {
	if dex.IsMockAuthEnabled() {
		mockLoginRedirect(c)
		return
	}

	state := uuid.New().String()
	middleware.SetSessionValue(c, "oauth_state", state)

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

	expectedState, ok := middleware.GetSessionValue(c, "oauth_state").(string)
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

	c.Redirect(http.StatusTemporaryRedirect, "/auth-callback?success=true")
}
