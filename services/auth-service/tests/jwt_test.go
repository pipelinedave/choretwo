package main

import (
	"testing"
	"time"

	"auth-service/app/jwt"
)

func TestTokenGeneration(t *testing.T) {
	jwt.InitJWT()

	accessToken, refreshToken, err := jwt.GenerateToken("test@example.com", "Test User")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	if accessToken == "" {
		t.Error("Access token is empty")
	}

	if refreshToken == "" {
		t.Error("Refresh token is empty")
	}
}

func TestTokenValidation(t *testing.T) {
	jwt.InitJWT()

	accessToken, _, err := jwt.GenerateToken("test@example.com", "Test User")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := jwt.ValidateToken(accessToken)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.Email != "test@example.com" {
		t.Errorf("Expected email test@example.com, got %s", claims.Email)
	}

	if claims.Name != "Test User" {
		t.Errorf("Expected name Test User, got %s", claims.Name)
	}

	if claims.ExpiresAt.Time.Before(time.Now()) {
		t.Error("Token has expired")
	}
}

func TestInvalidToken(t *testing.T) {
	_, err := jwt.ValidateToken("invalid.token.here")
	if err == nil {
		t.Error("Expected error for invalid token, got nil")
	}
}
