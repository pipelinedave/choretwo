package routes

import (
	"auth-service/app/database"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetUser(c *gin.Context) {
	email := c.GetString("user_email")
	if email == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Not authenticated",
		})
		return
	}

	user, err := database.GetUserByEmail(email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get user",
		})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":    user.ID,
		"email": user.Email,
		"name":  user.Name,
	})
}

func GetCurrentUser(c *gin.Context) {
	email := c.GetString("user_email")
	name := c.GetString("user_name")

	c.JSON(http.StatusOK, gin.H{
		"email": email,
		"name":  name,
	})
}
