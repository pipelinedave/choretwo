package routes

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	auth := r.Group("/api/auth")
	{
		auth.GET("/login", Login)
		auth.GET("/callback", Callback)
		auth.GET("/user", GetUser)
		auth.POST("/refresh", RefreshToken)
	}
}

func Login(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "Login endpoint - TODO: Implement Dex OAuth2 flow",
	})
}

func Callback(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "Callback endpoint - TODO: Handle OAuth callback",
	})
}

func GetUser(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "Get user endpoint - TODO: Return current user",
	})
}

func RefreshToken(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "Refresh token endpoint - TODO: Implement token refresh",
	})
}
