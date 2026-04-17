# Getting Started with Choretwo

Quick start guide for new developers and AI agents.

## Prerequisites

### Required Software

- **Docker & Docker Compose** (v2.0+)
  ```bash
  docker --version
  docker-compose --version
  ```

- **Go** (v1.21+) - for auth-service development
  ```bash
  go version
  ```

- **Python** (v3.12+) - for chore/log/ai services
  ```bash
  python3 --version
  pip --version
  ```

- **Node.js** (v20+) - for notification-service and frontend
  ```bash
  node --version
  npm --version
  ```

- **Git**
  ```bash
  git --version
  ```

### Optional but Recommended

- **kubectl** (v1.28+) - for K3s cluster interaction
  ```bash
  kubectl version --client
  ```

- **Flux CLI** (v2.0+) - for GitOps operations
  ```bash
  flux --version
  ```

- **kubeseal** - for SealedSecrets
  ```bash
  kubeseal --version
  ```

- **Make** - for convenience commands
  ```bash
  make --version
  ```

## One-Command Setup

```bash
# Clone and start everything
git clone https://github.com/your-org/choretwo.git
cd choretwo
docker-compose up -d
```

Wait 30 seconds for all services to initialize, then:

- **Frontend**: http://localhost:3000
- **Auth Service**: http://localhost:8001
- **Chore Service**: http://localhost:8002
- **Log Service**: http://localhost:8003
- **Notification Service**: http://localhost:8004
- **AI Copilot Service**: http://localhost:8005
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## First Steps

### 1. Verify Services Are Running

```bash
docker-compose ps
```

Expected output:
```
NAME                      STATUS
choretwo-auth-service     Up
choretwo-chore-service    Up
choretwo-log-service      Up
choretwo-notify-service   Up
choretwo-ai-service       Up
choretwo-frontend         Up
choretwo-postgres         Up
choretwo-redis            Up
```

### 2. Access the Application

Open http://localhost:3000 in your browser. You should see the login page.

### 3. Test Authentication (Mock Mode)

With `USE_MOCK_AUTH=true` (default in dev):

1. Click "Login with Mock"
2. Enter any email (e.g., `test@example.com`)
3. You'll be redirected to the dashboard

### 4. Check Service Health

```bash
# Auth service
curl http://localhost:8001/api/auth/health

# Chore service
curl http://localhost:8002/api/chores/health

# Log service
curl http://localhost:8003/api/logs/health

# All services via docker logs
docker-compose logs --tail=20
```

## Development Workflow

### Start All Services

```bash
docker-compose up
```

### Start Single Service

```bash
# Auth service only
docker-compose up auth-service

# Frontend only
docker-compose up frontend
```

### View Logs

```bash
# All services
docker-compose logs -f

# Single service
docker-compose logs -f auth-service

# Last 50 lines
docker-compose logs --tail=50 chore-service
```

### Reset Everything

```bash
# Stop and remove all containers + volumes
docker-compose down -v

# Restart fresh
docker-compose up -d
```

### Hot Reload

Services auto-reload on code changes:

- **Frontend**: Changes in `frontend/src/` reflect immediately
- **Python services**: Uvicorn auto-reload enabled
- **Go service**: Manual restart required (`docker-compose restart auth-service`)

## Common Commands

### Testing

```bash
# Run all tests
make test-all

# Single service tests
make test-auth
make test-chore
make test-frontend

# E2E tests
make test-e2e

# Coverage report
make coverage-check
```

### Linting

```bash
# All services
make lint-all

# Single service
make lint-auth
make lint-chore
make lint-frontend
```

### Building

```bash
# Build all images
make build-all

# Single service
make build-auth
make build-chore
```

### Docker Compose

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart specific service
docker-compose restart chore-service

# Rebuild
docker-compose build --no-cache

# Execute in container
docker-compose exec postgres psql -U choretwo -d choretwo
```

## Local Development Setup (Without Docker)

### Backend Services

```bash
# Auth service (Go)
cd services/auth-service
go mod download
go run cmd/main.go

# Chore service (Python)
cd services/chore-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002

# Notification service (Node)
cd services/notification-service
npm install
npm run dev

# Frontend (Vue)
cd frontend
npm install
npm run dev
```

### Database Setup

```bash
# Start PostgreSQL locally
docker run -d \
  --name choretwo-postgres \
  -e POSTGRES_DB=choretwo \
  -e POSTGRES_USER=choretwo \
  -e POSTGRES_PASSWORD=choretwo_dev \
  -p 5432:5432 \
  postgres:16

# Create schemas
docker exec -it choretwo-postgres psql -U choretwo -d choretwo <<EOF
CREATE SCHEMA auth;
CREATE SCHEMA chores;
CREATE SCHEMA logs;
CREATE SCHEMA notifications;
EOF
```

### Redis Setup

```bash
docker run -d --name choretwo-redis -p 6379:6379 redis:7-alpine
```

## Environment Variables

### Service Configuration

Create `.env` file in project root:

```bash
# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=choretwo
DATABASE_USER=choretwo
DATABASE_PASSWORD=choretwo_dev

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRY=24h
USE_MOCK_AUTH=true

# Dex (production only)
DEX_CLIENT_ID=choretwo
DEX_CLIENT_SECRET=your-dex-client-secret
DEX_REDIRECT_URI=http://localhost:3000/auth-callback
```

### Per-Service Environment

Each service has its own `.env` in its directory:

**auth-service/.env:**
```
DATABASE_URL=postgres://choretwo:choretwo_dev@localhost:5432/choretwo?schema=auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=24h
USE_MOCK_AUTH=true
```

## Next Steps

1. **Read the Architecture Guide**: Understand system design
2. **Set Up Your IDE**: Configure linting and formatting
3. **Run Tests**: Ensure everything works locally
4. **Make Your First Change**: Try adding a new endpoint or feature

## Troubleshooting

### Services Won't Start

```bash
# Check ports are available
lsof -i :5432
lsof -i :6379
lsof -i :3000
lsof -i :8001-8005

# Stop conflicting services
docker-compose down -v
docker-compose up -d
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U choretwo -d choretwo -c "SELECT 1"
```

### Frontend Can't Connect to Backend

```bash
# Check CORS settings in service configs
# Verify services are running
docker-compose ps

# Check network
docker-compose exec frontend ping auth-service
```

## Getting Help

- **Documentation**: Check `docs/` directory
- **Code Comments**: Read inline documentation
- **AGENTS.md**: AI agent-specific instructions
- **Troubleshooting**: See `docs/TROUBLESHOOTING.md`

## Quick Reference

| Service | Port | Tech | Command |
|---------|------|------|---------|
| Frontend | 3000 | Vue 3 | `npm run dev` |
| Auth | 8001 | Go/Gin | `go run cmd/main.go` |
| Chore | 8002 | FastAPI | `uvicorn app.main:app --reload` |
| Log | 8003 | FastAPI | `uvicorn app.main:app --reload` |
| Notification | 8004 | Node/Express | `npm run dev` |
| AI Copilot | 8005 | FastAPI | `uvicorn app.main:app --reload` |
| PostgreSQL | 5432 | Postgres 16 | - |
| Redis | 6379 | Redis 7 | - |

---

**Ready to code?** Start with [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the system design.
