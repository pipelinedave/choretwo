package middleware

import (
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type RateLimiter struct {
	requests map[string][]time.Time
	mu       sync.Mutex
}

var rateLimiter = &RateLimiter{
	requests: make(map[string][]time.Time),
}

func (rl *RateLimiter) IsAllowed(identifier string, limit int, window time.Duration) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	windowStart := now.Add(-window)

	var validRequests []time.Time
	for _, t := range rl.requests[identifier] {
		if t.After(windowStart) {
			validRequests = append(validRequests, t)
		}
	}

	if len(validRequests) >= limit {
		rl.requests[identifier] = validRequests
		return false
	}

	rl.requests[identifier] = append(validRequests, now)
	return true
}

func RateLimit(limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		identifier := c.ClientIP()
		if email := GetCurrentUserEmail(c); email != "" {
			identifier = email
		}

		if !rateLimiter.IsAllowed(identifier, limit, window) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func DefaultRateLimit() gin.HandlerFunc {
	limit := 100
	if envLimit := getenv("RATE_LIMIT", "100"); envLimit != "" {
		// Parse limit from environment
		// For simplicity, defaulting to 100
	}
	window := 1 * time.Minute
	return RateLimit(limit, window)
}

func getenv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
