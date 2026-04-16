# Auth Service

Go/Gin microservice for OAuth2 authentication with Dex OIDC integration.

## Features

- Dex OIDC authentication with Google/GitHub providers
- JWT token generation and validation
- Secure cookie sessions
- Rate limiting (100 requests/minute per user)
- Mock auth fallback for local development
- PostgreSQL user storage

## Quick Start

### Local Development with Mock Auth

```bash
cd services/auth-service
USE_MOCK_AUTH=true go run cmd/main.go
```

Then visit: http://localhost:8001/api/auth/mock-login-page

### With Real Dex

```bash
export DEX_CLIENT_SECRET=your-secret
export DEX_ISSUER_URL=https://dex.stillon.top
export SERVER_URL=https://choretwo-staging.stillon.top
go run cmd/main.go
```

## API Endpoints

### OAuth2 Flow

- `GET /api/auth/login` - Initiate OAuth flow (redirects to Dex)
- `GET /api/auth/callback` - Handle OAuth callback from Dex
- `GET /api/auth/user` - Get current authenticated user (requires auth)
- `POST /api/auth/refresh` - Refresh expired access token
- `POST /api/auth/logout` - End user session

### Mock Auth (Local Development)

- `GET /api/auth/mock-login-page` - Simple HTML login form
- `POST /api/auth/mock-callback` - Process mock login

## Environment Variables

```bash
# Required (unless USE_MOCK_AUTH=true)
DEX_CLIENT_SECRET=your-dex-client-secret

# Optional
DATABASE_URL=postgres://user:pass@host:5432/choretwo?schema=auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
DEX_ISSUER_URL=https://dex.stillon.top
DEX_CLIENT_ID=choretwo
SERVER_URL=http://localhost:8001
USE_MOCK_AUTH=false
FRONTEND_URL=http://localhost:3000
RATE_LIMIT=100
```

## Testing

```bash
go test ./tests/ -v
```

## Build

```bash
docker build -t pipelinedave/auth-service .
```

## Architecture

```
cmd/main.go          # Application entry point
app/
├── database/        # PostgreSQL connection and models
├── dex/            # Dex OIDC client integration
├── jwt/            # JWT token generation/validation
├── middleware/     # Session, auth, rate limiting
└── routes/         # HTTP handlers
    ├── login.go    # OAuth flow
    ├── mock.go     # Mock auth handlers
    ├── refresh.go  # Token refresh
    └── user.go     # User info
```
