package app

import (
	"auth-service/app/middleware"
	"auth-service/app/routes"

	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	r.Use(middleware.SessionMiddleware())

	auth := r.Group("/api/auth")
	{
		auth.GET("/login", routes.Login)
		auth.GET("/callback", routes.OAuthCallback)
	}

	// Protected routes requiring JWT authentication
	protected := r.Group("/api/auth")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.GET("/user", routes.GetCurrentUser)
		protected.POST("/refresh", routes.RefreshToken)
		protected.POST("/logout", routes.Logout)
	}

	auth.GET("/mock-login-page", routes.MockLoginPage)
	auth.POST("/mock-callback", routes.MockCallback)

	return r
}
