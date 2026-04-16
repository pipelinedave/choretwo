package dex

import (
	"log"
	"os"
)

type Config struct {
	IssuerURL   string
	ClientID    string
	ClientSecret string
	ServerURL   string
	UseMockAuth bool
}

func LoadConfig() *Config {
	return &Config{
		IssuerURL:    getEnv("DEX_ISSUER_URL", "https://dex.stillon.top"),
		ClientID:     getEnv("DEX_CLIENT_ID", "choretwo"),
		ClientSecret: getEnv("DEX_CLIENT_SECRET", ""),
		ServerURL:    getEnv("SERVER_URL", "http://localhost:8001"),
		UseMockAuth:  getEnv("USE_MOCK_AUTH", "false") == "true",
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func ValidateConfig(cfg *Config) error {
	if cfg.ClientSecret == "" && !cfg.UseMockAuth {
		log.Println("WARNING: DEX_CLIENT_SECRET not set. Using mock auth.")
		cfg.UseMockAuth = true
	}
	return nil
}
