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
		if err := dex.InitDexWithRetry(); err != nil {
			// Bewusst NICHT log.Fatal: Der Service bleibt erreichbar (/health),
			// Login-Requests bekommen einen sauberen 503 und ensureInitialized()
			// initialisiert on-demand neu, sobald der OIDC-Provider wieder
			// erreichbar ist (kein nil-Config-Panic mehr).
			log.Printf("Warning: Dex initialization failed after retries: %v", err)
			log.Println("Login requests will return 503 until Dex becomes reachable (lazy re-init enabled)")
		}
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
