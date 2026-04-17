package routes

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"auth-service/app/database"
	"auth-service/app/jwt"

	"github.com/gin-gonic/gin"
)

type MockLoginRequest struct {
	Email string `json:"email" binding:"required"`
	Name  string `json:"name" binding:"required"`
}

func MockLoginPage(c *gin.Context) {
	html := `<!DOCTYPE html>
<html>
<head>
    <title>Choretwo Development Login</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 400px;
        }
        h1 {
            color: #673AB7;
            text-align: center;
            margin-bottom: 1.5rem;
        }
        form {
            display: flex;
            flex-direction: column;
        }
        label {
            margin-bottom: 0.5rem;
            color: #555;
        }
        input {
            padding: 0.8rem;
            margin-bottom: 1rem;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        button {
            background-color: #673AB7;
            color: white;
            border: none;
            padding: 0.8rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
        }
        button:hover {
            background-color: #512DA8;
        }
        .info {
            margin-top: 1rem;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>Development Login</h1>
        <form action="/api/auth/mock-callback" method="post">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" value="developer@example.com" required>
            
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" value="Test Developer" required>
            
            <button type="submit">Sign In</button>
        </form>
        <div class="info">
            This is a mock login for local development only.
        </div>
    </div>
</body>
</html>`

	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}

func MockCallback(c *gin.Context) {
	email := c.PostForm("email")
	name := c.PostForm("name")

	if email == "" {
		email = "developer@example.com"
	}
	if name == "" {
		name = "Test Developer"
	}

	log.Printf("Mock login for: %s (%s)", name, email)

	user, err := database.GetOrCreateUser(email, name)
	if err != nil {
		log.Printf("Failed to get or create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create user",
		})
		return
	}

	accessToken, refreshToken, err := jwt.GenerateToken(user.Email, user.Name)
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate token",
		})
		return
	}

	serverURL := os.Getenv("SERVER_URL")
	if serverURL == "" {
		serverURL = "http://localhost:8001"
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	redirectURL := fmt.Sprintf("%s/auth-callback?token=%s&id_token=%s&refresh_token=%s&expires_in=86400",
		frontendURL, accessToken, accessToken, refreshToken)

	c.Redirect(http.StatusSeeOther, redirectURL)
}

func MockRefresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	email := "developer@example.com"
	name := "Test Developer"

	if sessionEmail := c.GetString("user_email"); sessionEmail != "" {
		email = sessionEmail
	}

	accessToken, refreshToken, err := jwt.GenerateToken(email, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to refresh token",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"id_token":      accessToken,
		"refresh_token": refreshToken,
		"expires_in":    86400,
		"token_type":    "bearer",
	})
}
