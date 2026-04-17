# Choretwo - Current Session State

## Last Updated
**Date:** April 17, 2026
**Session:** Local Development Setup & E2E Tests

---

## Current Status

### ✅ Running Services (Docker Compose)
```
✅ auth-service      - Port 8001 (Go/Gin, mock auth enabled)
✅ chore-service     - Port 8002 (Python/FastAPI)
✅ log-service       - Port 8003 (Python/FastAPI)
✅ notification-service - Port 8004 (Node/Express)
✅ ai-copilot-service  - Port 8005 (Python/FastAPI)
✅ postgres          - Port 5432 (Healthy)
✅ redis             - Port 6379 (Healthy)
❌ frontend          - STOPPED (to allow Vite dev server)
```

### ✅ Development Environment
- **Vite Dev Server:** Running on `http://localhost:3000`
- **API Proxy:** Vite proxies `/api/*` to Docker services (8001-8005)
- **Mock Auth:** Enabled (`USE_MOCK_AUTH=true`)
- **Test Browser:** Access at `http://localhost:3000`

---

## Recent Accomplishments

### 1. E2E Test Suite (Playwright)
- **28 tests passing** (14 Chromium + 14 Firefox)
- **Test Coverage:**
  - Auth login flow (5 tests)
  - Auth logout flow (4 tests)
  - Chore CRUD + Undo (5 tests)
- **Files:**
  - `frontend/tests/e2e/auth-login.spec.js`
  - `frontend/tests/e2e/auth-logout.spec.js`
  - `frontend/tests/e2e/chore-crud.spec.js`
- **Config:** `frontend/playwright.config.js` (Webkit disabled - missing system libs)

### 2. Local Development Setup
- Vite dev server runs on port 3000
- Frontend container stopped to free port
- API calls proxied directly to Docker services
- Mock login available at `/api/auth/mock-login-page`

---

## Environment Configuration

### `.env.development` (Frontend)
```env
VITE_API_BASE=http://localhost:3000
VITE_AUTH_URL=http://localhost:8001
VITE_CHORE_URL=http://localhost:8002
VITE_LOG_URL=http://localhost:8003
VITE_NOTIFY_URL=http://localhost:8004
VITE_AI_URL=http://localhost:8005
```

### Docker Compose Environment
```yaml
auth-service:
  USE_MOCK_AUTH: true
  DEX_ISSUER_URL: https://dex.stillon.top
  SERVER_URL: http://localhost:8001

# Other services use internal Docker networking
```

---

## Development Workflow

### Starting Local Development
```bash
# 1. Stop frontend container (if running)
docker-compose stop frontend

# 2. Start Vite dev server
cd frontend && npm run dev

# 3. Access app
# Open http://localhost:3000 in browser

# 4. Test login
# Click "Sign in with Google" → redirects to mock login
# Enter email/name → gets JWT token
```

### Running Tests
```bash
# E2E tests
cd frontend && npm run test:e2e

# Specific test file
npx playwright test tests/e2e/auth-login.spec.js

# With UI mode
npx playwright test --ui
```

### Service Development
```bash
# Auth service (Go)
cd services/auth-service
go run cmd/main.go

# Chore service (Python)
cd services/chore-service
uvicorn app.main:app --reload --port 8002

# Notification service (Node)
cd services/notification-service
npm run dev
```

---

## Known Issues & Workarounds

### 1. WebKit Tests Failing
- **Issue:** Missing system libraries (libgtk-4, libwebp, etc.)
- **Workaround:** Disabled WebKit in `playwright.config.js`
- **Impact:** Tests run on Chromium + Firefox only

### 2. Production Build CORS Errors
- **Issue:** Production build uses `VITE_API_BASE=https://choretwo.stillon.top`
- **Symptom:** CORS errors when accessing from `localhost:3000`
- **Workaround:** Always use `npm run dev` for local development

### 3. Port Conflicts
- **Issue:** Frontend container uses port 3000, conflicts with Vite
- **Solution:** Stop frontend container before running `npm run dev`
```bash
docker-compose stop frontend
```

---

## Database State

### Schemas
```sql
auth       - Authentication tokens, users
chores     - Chore definitions, user assignments
logs       - Audit trail, undo functionality
notifications - Push notification queue
```

### Test Data Cleanup
```bash
# Remove E2E test data
docker-compose exec postgres psql -U choretwo -d choretwo -c \
  "DELETE FROM chores.chores WHERE name LIKE 'E2E Test%';"
```

---

## Deployment Pipeline

### Staging Flow
1. Push to `main` branch
2. GitHub Actions builds service images
3. Images pushed to DockerHub (`pipelinedave/choretwo-*`)
4. GitHub Actions updates `k3s-config` repo with new tags
5. Flux reconciles from `k3s-config` (5min interval)
6. Deployed to `choretwo-staging.stillon.top`

### Production Flow
1. E2E tests run on staging
2. Manual approval required
3. Push tag `v*` to main
4. Same flow as staging, but to production namespace

### Required Secrets (GitHub)
```
DOCKERHUB_USERNAME=pipelinedave
DOCKERHUB_TOKEN=<DockerHub token>
K3S_CONFIG_TOKEN=<PAT with write access to k3s-config>
```

---

## API Endpoints

### Auth Service (8001)
- `POST /api/auth/login` - Start login (mock or Dex)
- `GET /api/auth/user` - Get current user
- `POST /api/auth/logout` - Logout
- `POST /api/auth/mock-callback` - Mock auth callback

### Chore Service (8002)
- `GET /api/chores/` - List chores (paginated, 10/page)
- `POST /api/chores/` - Create chore
- `GET /api/chores/:id` - Get chore
- `PUT /api/chores/:id` - Update chore
- `DELETE /api/chores/:id` - Delete chore
- `PUT /api/chores/:id/done` - Mark as done
- `PUT /api/chores/:id/archive` - Archive chore

### Log Service (8003)
- `GET /api/logs/` - List action logs
- `POST /api/logs/undo` - Undo last action

---

## Quick Reference

### Stop All & Clean Start
```bash
docker-compose down
cd frontend && npm run dev
```

### Reset Database
```bash
docker-compose down -v
docker-compose up -d
# Wait for healthy status
```

### View Service Logs
```bash
docker-compose logs -f auth-service
docker-compose logs -f chore-service
```

### Check Service Health
```bash
curl http://localhost:8001/health
curl http://localhost:8002/health
```

---

## Next Steps / TODOs

- [ ] Add more E2E tests for AI copilot features
- [ ] Add UI-based chore creation tests (currently API-only)
- [ ] Set up Playwright MCP for browser debugging
- [ ] Add `data-testid` attributes to components for stable selectors
- [ ] Document production deployment checklist
- [ ] Add health check endpoints to all services

---

## Contacts/References

- **PRD:** `docs/PRD.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Choremane (reference):** `/home/dhallmann/projects/choremane`
- **K3s Config:** `pipelinedave/k3s-config`
- **Flux Docs:** `/home/dhallmann/projects/k3s-config/docs/concepts/workflow.md`
