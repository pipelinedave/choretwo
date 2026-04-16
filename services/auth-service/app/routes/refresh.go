package routes

import (
	"context"
	"log"
	"net/http"
	"os"

	"auth-service/app/dex"
	"auth-service/app/database"
	"auth-service/app/jwt"

	"github.com/gin-gonic/gin"
)

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func RefreshToken(c *gin.Context) {
	if dex.IsMockAuthEnabled() {
		MockRefresh(c)
		return
	}

	var req RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	ctx := context.Background()
	claims, err := jwt.ValidateToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid refresh token",
		})
		return
	}

	email := claims.Email
	name := claims.Name

	user, err := database.GetOrCreateUser(email, name)
	if err != nil {
		log.Printf("Failed to get or create user: %v", err)
	}

	accessToken, newRefreshToken, err := jwt.GenerateToken(user.Email, user.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate token",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"id_token":      accessToken,
		"refresh_token": newRefreshToken,
		"expires_in":    86400,
		"token_type":    "bearer",
	})
}
