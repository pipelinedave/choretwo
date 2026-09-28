# Choretwo

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/pipelinedave/choretwo-frontend.svg)](https://hub.docker.com/r/pipelinedave/choretwo-frontend)

A chore management platform with Material You PWA design, built for modern households.
Prod runs on **Vercel** (Projekt `choretwo`): static frontend + ONE Python-FastAPI
monolith (`api/index.py`). Lokal: Docker-Compose + Vite.

## 🚀 Quick Start

```bash
# Clone and start all services
docker-compose up -d

# Start frontend dev server (for development)
cd frontend && npm run dev

# Access the application
# Production build: http://localhost:3000
# Dev server: http://localhost:3001
```

## ✨ Features

- **Material You PWA** - Modern, beautiful UI with dark/light theme
- **Supabase Magic-Link Auth** (Prod; Mock-Auth lokal)
- **Undo-Capable Logs** - Every action can be undone from activity log
- **AI Copilot** - Natural language commands ("Mark dishes done", "Add laundry every 3 days")
- **Real-time Sync** - Automatic refresh on window focus
- **Offline-First** - Works without internet, syncs when online
- **Swipe Gestures** - Swipe right=done, left=edit, down=archive

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Vercel (Prod)                            │
│  frontend/dist (statisch) + api/index.py → Monolith (FastAPI)│
│  Rewrites: /api/* → Monolith, Rest → SPA                    │
└────────────────┬───────────────────────────────────────────┘
                 │
     ┌───────────┼───────────┬───────────┬──────────┬─────────┐
     ▼           ▼           ▼           ▼          ▼         ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────┐
│ /api/  │  │/api/   │  │ /api/  │  │/api/   │  │ /api/  │  │  /   │
│ auth   │  │chores  │  │ logs   │  │notify  │  │ ai     │  │ (Vue)│
└───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  └────┬───┘  └──┬───┘
    ▼           ▼           ▼           ▼            ▼         ▼
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐  ┌────────┐
│  Auth  │  │ Chore  │  │  Log   │  │Notify  │  │ AI Copilot│  │Frontend│
│Service │  │Service │  │Service │  │Service │  │ Service  │  │ (Vue3) │
│  (Go,  │  │(Python)│  │(Python)│  │ (Python)│  │ (Python) │  └────────┘
│ legacy)│  │        │  │        │  │        │  │          │             │
│(lokal) │  │        │  │        │  │        │  │          │             │
└────────┘  └────────┘  └────────┘  └────────┘  └──────────┘
    │           │           │           │            │
    └───────────┴───────────┴───────────┴────────────┘
        (Prod: EIN Prozess — monolith/main.py, Vendor generiert)
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐
    │    Postgres     │     │  Vercel-Cron    │
    │  (3 schemas)    │     │ /api/notify/    │
    └─────────────────┘     └─────────────────┘
```

## 📦 Services

| Service | Tech | Port (lokal) | Description |
|---------|------|------|-------------|
| **Monolith** | Python/FastAPI | 8000 | Chore/log/notify/AI vendored in EINEM Prozess (Prod: `api/index.py` auf Vercel) |
| **Go-auth** (legacy, nur lokal) | Go/Gin | 8001 | Mock-Login für Dev/E2E — in Prod weder gebaut noch geroutet |
| **Frontend** | Vue 3/Pinia | 3000 | Material You PWA (Prod: `frontend/dist` statisch) |

## 🛠️ Tech Stack

- **Frontend**: Vue 3, Pinia, Vite, Hammer.js, PWA
- **Auth**: Supabase Magic-Link (Prod), Mock-Auth lokal
- **Services**: Python 3.12, FastAPI, SQLAlchemy 2.0 (vendored Monolith)
- **Database**: PostgreSQL (Supabase Prod, schema isolation)
- **Prod**: Vercel (statisch + Serverless-Monolith, Cron, `vercel.json`)
- **Lokal**: Docker, Docker Compose, Vite

## 📚 Documentation

- [Getting Started](docs/GETTING_STARTED.md) - First-time setup
- [Architecture](docs/ARCHITECTURE.md) - System design and patterns
- [Development Guide](docs/DEVELOPMENT.md) - Local development workflow
- [API Reference](docs/API.md) - Service endpoints
- [Testing](docs/TESTING.md) - Unit, integration, and E2E tests
- [Deployment](docs/DEPLOYMENT.md) - Production auf Vercel
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Agent Instructions](AGENTS.md) - Guidelines for AI agents

## 🧪 Testing

```bash
# Run all tests
make test-all

# Run E2E tests (Playwright)
cd frontend && npm run test:e2e

# Check coverage
make coverage-check
```

**Coverage Requirements:**
- Auth Service: 90%
- Chore Service: 90%
- Log Service: 90%
- Notification Service: 85%
- AI Copilot: 80%
- Frontend: 80%

## 🚢 Deployment

**Production:** Vercel-Projekt `choretwo` (branch `main` auto-deployt).

**Domains:**
- Production: `choretwo.stillon.top` + `choretwo.vercel.app`

**Deploy Flow:**
1. Push auf `main` → Vercel baut (Frontend + `sync_vendor.py`)
2. Grün → automatisches Production-Deploy
3. Verifizieren: `/health` → `{"status":"ok","service":"choretwo-monolith"}`
4. Env-Vars/Domains/Logs nur via `vera` (Vercel-Agent)

Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 🤝 Development Workflow

1. **Start services**: `docker-compose up -d`
2. **Frontend dev**: `cd frontend && npm run dev`
3. **Backend dev**: Run service directly (see docs/DEVELOPMENT.md)
4. **Test locally**: `make test-all`
5. **Lint**: `make lint-all`
6. **Commit**: Follow conventional commits format

## 📝 Recent Changes

**v1.0.0 (Current)** - Initial release
- ✅ Python-Monolith auf Vercel (statt 6 Einzel-Deployments)
- ✅ Supabase Magic-Link Auth (Go/Dex nur noch lokales Legacy)
- ✅ Material You PWA with 20+ components
- ✅ Dex OAuth2 with mock auth fallback
- ✅ Swipe gestures (Hammer.js)
- ✅ Undo-capable log system
- ✅ AI Copilot with natural language
- ✅ E2E tests with Playwright (9 tests)
- ✅ PWA support with offline queue

## 🐛 Known Issues

- PWA icons are placeholders (generate with `npm run generate-icons`)
- AI Copilot requires `LLM_API_KEY` (Synthetic/GLM) — without it the deterministic regex fallback is used
- Notification service needs Gotify server for push notifications

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Based on patterns from [Choremane](https://github.com/your-org/choremane)
- Material You design by Google
- Built with ❤️ using modern web technologies

---

**Need help?** Check [Troubleshooting](docs/TROUBLESHOOTING.md) or [AGENTS.md](AGENTS.md) for AI agent guidance.
# Test trigger
# test
