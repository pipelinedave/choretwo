package main

import (
	"log"
	"os"

	"auth-service/app"
	"auth-service/app/database"
	"auth-service/app/dex"
	"auth-service/app/jwt"
)

func main() {
	log.Println("Starting auth-service...")

	jwt.InitJWT()

	if !dex.IsMockAuthEnabled() {
		if err := dex.InitDex(); err != nil {
			log.Printf("Warning: Dex initialization failed: %v", err)
			log.Println("Falling back to mock auth")
		}
	}

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
