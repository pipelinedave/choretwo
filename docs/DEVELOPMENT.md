# Development Guide
Local development setup, workflows, and best practices for Choretwo.
## Environment Setup
### Prerequisites Installation
#### Option 1: Using Package Managers
**macOS:**
```bash
# Go
brew install go
# Python
brew install python@3.12
# Node.js
brew install node@20
# Docker
brew install --cask docker
# kubectl
brew install kubectl
# Flux CLI
brew install fluxcd/tap/flux
# kubeseal
brew install sealed-secrets
Ubuntu/Debian:
# Go
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
# Python
sudo apt update
sudo apt install python3.12 python3.12-venv python3-pip
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
# Flux
sudo curl -s https://fluxcd.io/install.sh | sudo bash
# kubeseal
kubectl kustomize
Windows (PowerShell):
# Go
choco install golang
# Python
choco install python312
# Node.js
choco install nodejs20
# Docker Desktop
choco install docker-desktop
# kubectl
choco install kubernetes-cli
# Flux
winget install fluxcd.flux
# kubeseal
choco install sealed-secrets
IDE Setup
VS Code
Recommended Extensions:
- Go (golang.Go)
- Python (ms-python.python)
- Vue Language Features (Vue.volar)
- Docker (ms-azuretools.vscode-docker)
- Kubernetes (ms-kubernetes-tools.vscode-kubernetes-tools)
- Prettier (esbenp.prettier-vscode)
- ESLint (dbaeumer.vscode-eslint)
- GoTest (hbenl.vscode-test-explorer)
Settings (.vscode/settings.json):
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[go]": {
    "editor.defaultFormatter": "golang.go"
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.python",
    "editor.formatOnSave": true
  },
  "[vue]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "go.lintTool": "golangci-lint",
  "python.linting.enabled": true,
  "python.linting.ruffEnabled": true,
  "python.formatting.provider": "black",
  "python.testing.pytestEnabled": true,
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true,
    "**/node_modules": true
  }
}
GoLand/IntelliJ
Plugins:
- Go (JetBrains)
- Vue.js
- Docker
- Kubernetes
Run Configurations:
Create separate run configurations for each service with appropriate environment variables.
Development Workflow
Starting Development Environment
Option 1: Docker Compose (Recommended)
# Clone repository
git clone https://github.com/your-org/choretwo.git
cd choretwo
# Start all services
docker-compose up -d
# Check status
docker-compose ps
# View logs
docker-compose logs -f
# Stop
docker-compose down
Option 2: Individual Services
# Start infrastructure
docker-compose up -d postgres redis
# Auth service (terminal 1)
cd services/auth-service
go run cmd/main.go
# Chore service (terminal 2)
cd services/chore-service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
# Frontend (terminal 3)
cd frontend
npm run dev
Hot Reload Configuration
Frontend:
npm run dev
# Watches: frontend/src/**/*
# Hot module replacement enabled
# Port: 3000
Python Services:
uvicorn app.main:app --reload --host 0.0.0.0 --port 800X
# Watches: app/**/*.py
# Auto-reload on file changes
Go Service:
# Manual restart required
go run cmd/main.go
# Or use air for auto-reload
go install github.com/cosmtrek/air@latest
air
Debugging
Frontend (Vue DevTools)
1. Install Vue DevTools browser extension
2. Open DevTools → Vue tab
3. Inspect component state, props, and events
Debugging with breakpoints:
// Add debugger in code
async fetchUser() {
  debugger  // Pause execution here
  const response = await fetch('/api/auth/user')
  // ...
}
Python Services (pdb)
import pdb; pdb.set_trace()  # Traditional
from pdb import set_trace; set_trace()  # Modern
Advanced debugging with VS Code:
1. Set breakpoints in code
2. Create launch configuration:
{
  "name": "Python: Current File",
  "type": "python",
  "request": "launch",
  "program": "${file}",
  "console": "integratedTerminal",
  "env": {
    "DATABASE_URL": "postgres://...",
    "REDIS_URL": "redis://localhost:6379"
  }
}
Go Service (Delve)
# Install Delve
go install github.com/go-delve/delve/cmd/dlv@latest
# Debug
dlv debug cmd/main.go
# VS Code launch config
{
  "name": "Launch",
  "type": "go",
  "request": "launch",
  "mode": "debug",
  "program": "${workspaceFolder}/cmd/main.go",
  "env": {
    "DATABASE_URL": "postgres://...",
    "REDIS_URL": "redis://localhost:6379"
  }
}
Database Operations
Local Database Access
# Connect to PostgreSQL
docker-compose exec postgres psql -U choretwo -d choretwo
# Connect to specific schema
docker-compose exec postgres psql -U choretwo -d choretwo -c "SELECT * FROM chores.chores"
# List schemas
docker-compose exec postgres psql -U choretwo -d choretwo -c "\dn"
# List tables in schema
docker-compose exec postgres psql -U choretwo -d choretwo -c "\dt chores.*"
Database Migrations
Using Alembic (Python services):
# Initialize Alembic (first time only)
cd services/chore-service
alembic init alembic
# Create new migration
alembic revision --autogenerate -m "Add new column"
# Apply migrations
alembic upgrade head
# Rollback one migration
alembic downgrade -1
# View current revision
alembic current
# View history
alembic history
Go migrations:
# Using golang-migrate
migrate -path services/auth-service/migrations -database "postgres://..." up
# Downgrade
migrate -path services/auth-service/migrations -database "postgres://..." down 1
Seed Data
# Run seed script
docker-compose exec postgres psql -U choretwo -d choretwo < scripts/seed-data.sql
# Or use Python seed script
cd services/chore-service
python scripts/seed_data.py
API Development
Testing Endpoints
Using curl:
# Health check
curl http://localhost:8002/api/chores/health
# Create chore (with auth)
curl -X POST http://localhost:8002/api/chores \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dishes", "interval_days": 1}'
# List chores
curl http://localhost:8002/api/chores \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
Using httpie:
# More user-friendly
http POST localhost:8002/api/chores \
  Authorization:"Bearer YOUR_JWT_TOKEN" \
  name=Dishes interval_days:=1
Using Postman:
1. Import OpenAPI spec from /openapi.json
2. Set up environment variables for base URL and JWT token
3. Use pre-request scripts for token refresh
API Documentation
# OpenAPI/Swagger UI
# Visit http://localhost:8002/docs (FastAPI)
# Visit http://localhost:8001/swagger/index.html (Gin)
# Download OpenAPI spec
curl http://localhost:8002/openapi.json > openapi.json
Testing
Running Tests
# All tests
make test-all
# Single service
make test-auth
make test-chore
make test-log
make test-frontend
# Specific test file
cd services/chore-service
pytest tests/test_chores.py -v
# With coverage
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html  # macOS
Writing Tests
Python (pytest):
import pytest
from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)
def test_create_chore():
    response = client.post(
        "/api/chores",
        json={"name": "Test", "interval_days": 7},
        headers={"Authorization": "Bearer test_token"}
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Test"
@pytest.fixture
def auth_client():
    token = generate_test_token()
    with TestClient(app) as c:
        c.headers = {"Authorization": f"Bearer {token}"}
        yield c
Go (testing):
package main
import (
    "net/http/httptest"
    "testing"
    "github.com/gin-gonic/gin"
)
func TestCreateChore(t *testing.T) {
    w := httptest.NewRecorder()
    c, _ := gin.CreateTestContext(w)
    
    // Setup test data
    // Call handler
    // Assert response
}
Frontend (Vitest):
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChoreCard from '@/components/ChoreCard.vue'
describe('ChoreCard', () => {
  it('renders chore name', () => {
    const wrapper = mount(ChoreCard, {
      props: { chore: { name: 'Dishes' } }
    })
    expect(wrapper.text()).toContain('Dishes')
  })
})
Code Style
Python (Ruff + Black)
# Format code
ruff format .
# Lint
ruff check .
# Auto-fix
ruff check . --fix
pyproject.toml:
[tool.ruff]
line-length = 100
target-version = "py312"
[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
Go (golangci-lint)
# Lint
golangci-lint run
# Auto-fix
golangci-lint run --fix
golangci-lint.yml:
run:
  timeout: 5m
linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - typecheck
    - unused
    - gofmt
    - goimports
Frontend (ESLint + Prettier)
# Format
npm run format
# Lint
npm run lint
# Lint and fix
npm run lint:fix
Git Workflow
Branch Naming
# Feature branch
git checkout -b feature/add-recurrence-rules
# Bugfix
git checkout -b fix/typo-in-dashboard
# Hotfix
git checkout -b hotfix/critical-auth-bug
Commit Messages
# Conventional Commits format
feat: add chore recurrence logic
fix: correct JWT expiration handling
docs: update API documentation
refactor: simplify database queries
test: add integration tests for auth
chore: update dependencies
Pre-commit Hooks
# Install pre-commit
pip install pre-commit
pre-commit install
# Run manually
pre-commit run --all-files
.pre-commit-config.yaml:
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
  
  - repo: local
    hooks:
      - id: lint-python
        name: Lint Python
        entry: ruff check
        language: system
        types: [python]
      
      - id: lint-go
        name: Lint Go
        entry: golangci-lint run
        language: system
        types: [go]
Environment Variables
Development (.env)
Create .env in project root:
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=choretwo
DATABASE_USER=choretwo
DATABASE_PASSWORD=choretwo_dev
# Redis
REDIS_URL=redis://localhost:6379
# Auth
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRY=24h
USE_MOCK_AUTH=true
# Service URLs
FRONTEND_URL=http://localhost:3000
AUTH_SERVICE_URL=http://localhost:8001
CHORE_SERVICE_URL=http://localhost:8002
LOG_SERVICE_URL=http://localhost:8003
NOTIFY_SERVICE_URL=http://localhost:8004
AI_SERVICE_URL=http://localhost:8005
Service-specific .env files
services/auth-service/.env:
DATABASE_URL=postgres://choretwo:choretwo_dev@localhost:5432/choretwo?schema=auth
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret
JWT_EXPIRY=24h
USE_MOCK_AUTH=true
Adding New Features
Adding a New Endpoint (Python/FastAPI)
1. Create model (app/models/chore.py):
from sqlalchemy import Column, Integer, String
from app.database import Base
class Chore(Base):
    __tablename__ = "chores"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
2. Create schema (app/schemas/chore.py):
from pydantic import BaseModel
class ChoreCreate(BaseModel):
    name: str
    interval_days: int
3. Add route (app/api/routes.py):
from fastapi import APIRouter, Depends
from app.schemas.chore import ChoreCreate
router = APIRouter()
@router.post("/api/chores")
async def create_chore(chore: ChoreCreate):
    # Implementation
    pass
4. Register router (app/main.py):
from app.api.routes import router
app.include_router(router)
5. Add tests (tests/test_chores.py):
def test_create_chore(client):
    response = client.post("/api/chores", json={...})
    assert response.status_code == 201
Adding a New Service
1. Create service directory:
mkdir services/new-service
cd services/new-service
2. Create Dockerfile:
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
3. Add to docker-compose.yml:
new-service:
  build: ./services/new-service
  ports:
    - "8006:8000"
  environment:
    - DATABASE_URL=postgres://...
  depends_on:
    - postgres
4. Add K8s manifests (k3s-config/kustomize/choretwo/base/new-service/):
apiVersion: apps/v1
kind: Deployment
metadata:
  name: new-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: new-service
  template:
    metadata:
      labels:
        app: new-service
    spec:
      containers:
        - name: new-service
          image: pipelinedave/new-service:latest
          ports:
            - containerPort: 8000
5. Add ingress route:
- path: /api/new
  pathType: Prefix
  backend:
    service:
      name: new-service
      port:
        number: 80
Performance Profiling
Python Services
# Profile with cProfile
python -m cProfile -o profile.out app/main.py
# Visualize
pip install snakeviz
snakeviz profile.out
Go Service
# CPU profiling
go test -cpuprofile=cpu.prof -bench=.
# Memory profiling
go test -memprofile=mem.prof -bench=.
# Analyze
go tool pprof cpu.prof
Frontend
1. Chrome DevTools → Performance tab
2. Record while interacting with app
3. Analyze flame chart for bottlenecks
Common Development Tasks
Reset Development Environment
# Stop all
docker-compose down -v
# Clean build cache
docker builder prune -a
# Start fresh
docker-compose up -d
# Run migrations
docker-compose exec chore-service alembic upgrade head
# Seed data
docker-compose exec postgres psql -U choretwo -d choretwo < scripts/seed.sql
Generate JWT Token (Development)
# Using jwt tool
echo -n '{"sub":"test@example.com","exp":'$(date -d '+24 hours' +%s)'}' | base64
# Or use Python
python3 -c "
import jwt, datetime
token = jwt.encode({
    'sub': 'test@example.com',
    'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
}, 'dev-secret-change-in-production')
print(token)
"
Backup/Restore Database
# Backup
docker-compose exec postgres pg_dump -U choretwo choretwo > backup.sql
# Restore
docker-compose exec -T postgres psql -U choretwo choretwo < backup.sql
Best Practices
Code Organization
- Keep services focused on single responsibility
- Use dependency injection for testability
- Follow the repository pattern for data access
- Keep business logic out of controllers
- Use DTOs for API contracts
Security
- Never commit .env files
- Use environment variables for secrets
- Validate all inputs
- Use parameterized queries
- Implement rate limiting
- Enable CORS only for allowed origins
Testing
- Write tests before features (TDD)
- Aim for 90%+ coverage on business logic
- Test error cases explicitly
- Use meaningful test names
- Mock external dependencies
Documentation
- Update API docs when changing endpoints
- Add inline comments for complex logic
- Keep README up to date
- Document breaking changes
- Write clear commit messages
Resources
Internal Documentation
- AGENTS.md (../AGENTS.md) - AI agent instructions
- ARCHITECTURE.md (./ARCHITECTURE.md) - System design
- DEPLOYMENT.md (./DEPLOYMENT.md) - Production deployment
- TESTING.md (./TESTING.md) - Testing strategies
External Resources
- FastAPI: https://fastapi.tiangolo.com/tutorial/
- Go/Gin: https://gin-gonic.com/documentation/
- Vue 3: https://vuejs.org/guide/
- Pytest: https://docs.pytest.org/
- Docker: https://docs.docker.com/get-started/
- Kubernetes: https://kubernetes.io/docs/home/
Support
- Issues: https://github.com/your-org/choretwo/issues
- Discussions: https://github.com/your-org/choretwo/discussions
- Maintainer: @pipelinedave
