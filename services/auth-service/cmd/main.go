package main

import (
	"log"
	"os"

	"auth-service/app"
	"auth-service/app/database"
	"auth-service/app/dex"
	"auth-service/app/jwt"
	"auth-service/app/redis"
)

func main() {
	log.Println("Starting auth-service...")

	jwt.InitJWT()

	if !dex.IsMockAuthEnabled() {
		// Init im Hintergrund: Der HTTP-Server startet SOFORT, damit /health
		// die Liveness-Probe bedient (Start-Retry duerfte das Liveness-Fenster
		// von ~60s nicht blockieren). Login-Requests bekommen solange einen
		// sauberen 503; ensureInitialized() initialisiert on-demand neu, sobald
		// der OIDC-Provider erreichbar ist (self-healing ohne Pod-Restart).
		go func() {
			if err := dex.InitDexWithRetry(); err != nil {
				log.Printf("Warning: Dex initialization failed after retries: %v (lazy re-init on login remains active)", err)
			}
		}()
	}

	redis.Init()

	database.InitDB()
	defer database.CloseDB()

	if err := database.RunMigrations(); err != nil {
		log.Printf("Warning: Database migrations failed: %v", err)
	}

	r := app.SetupRouter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("Auth service listening on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
