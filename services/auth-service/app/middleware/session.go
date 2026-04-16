package middleware

import (
	"encoding/gob"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
)

var store *sessions.CookieStore

func init() {
	key := []byte(os.Getenv("JWT_SECRET"))
	if len(key) == 0 {
		key = []byte("choretwo-dev-jwt-secret-change-in-production")
	}
	store = sessions.NewCookieStore(key)
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}

	if os.Getenv("HTTPS_ONLY") == "true" {
		store.Options.Secure = true
	}
}

func initGob() {
	gob.Register(map[string]interface{}{})
	gob.Register(time.Time{})
}

func SessionMiddleware() gin.HandlerFunc {
	initGob()
	return func(c *gin.Context) {
		sess, err := store.Get(c.Request, "choretwo-session")
		if err != nil {
			sess, _ = store.Get(c.Request, "choretwo-session")
		}

		c.Set("session", sess)
		c.Next()

		if err := sess.Save(c.Request, c.Writer); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to save session",
			})
		}
	}
}

func GetSession(c *gin.Context) *sessions.Session {
	sess, _ := c.Get("session")
	if session, ok := sess.(*sessions.Session); ok {
		return session
	}
	return nil
}

func SetSessionValue(c *gin.Context, key string, value interface{}) {
	sess := GetSession(c)
	if sess != nil {
		sess.Values[key] = value
	}
}

func GetSessionValue(c *gin.Context, key string) interface{} {
	sess := GetSession(c)
	if sess != nil {
		return sess.Values[key]
	}
	return nil
}

func ClearSession(c *gin.Context) {
	sess := GetSession(c)
	if sess != nil {
		sess.Values = make(map[interface{}]interface{})
		sess.Options.MaxAge = -1
	}
}
