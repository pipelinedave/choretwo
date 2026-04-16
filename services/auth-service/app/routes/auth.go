package routes

import (
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	r.GET("/api/auth/login", Login)
	r.GET("/api/auth/callback", OAuthCallback)
	r.GET("/api/auth/user", GetCurrentUser)
	r.POST("/api/auth/refresh", RefreshToken)
	r.POST("/api/auth/logout", Logout)

	r.GET("/api/auth/mock-login-page", MockLoginPage)
	r.POST("/api/auth/mock-callback", MockCallback)
}
