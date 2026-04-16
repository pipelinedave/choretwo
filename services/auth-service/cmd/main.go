package main

import (
	"log"
	"os"

	"auth-service/app"
	"auth-service/app/routes"
)

func main() {
	log.Println("Starting auth-service...")

	r := app.SetupRouter()

	// Register routes
	routes.RegisterRoutes(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("Auth service listening on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
