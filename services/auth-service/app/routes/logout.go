package routes

import (
	"net/http"

	"auth-service/app/middleware"

	"github.com/gin-gonic/gin"
)

func Logout(c *gin.Context) {
	middleware.ClearSession(c)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out successfully",
	})
}
