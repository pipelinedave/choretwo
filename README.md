# Choretwo

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/pipelinedave/choretwo-frontend.svg)](https://hub.docker.com/r/pipelinedave/choretwo-frontend)

A microservices-based chore management platform with Material You PWA design, built for modern households.

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
- **OAuth2 Authentication** - Dex integration with Google/GitHub (mock auth for dev)
- **Undo-Capable Logs** - Every action can be undone from activity log
- **AI Copilot** - Natural language commands ("Mark dishes done", "Add laundry every 3 days")
- **Real-time Sync** - Automatic refresh on window focus
- **Offline-First** - Works without internet, syncs when online
- **Swipe Gestures** - Swipe right=done, left=edit, down=archive

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Docker Compose                           │
│  (or K3s + FluxCD for production deployment)                │
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
│  (Go)  │  │(Python)│  │(Python)│  │ (Node) │  │ (Python) │  └────────┘
└────────┘  └────────┘  └────────┘  └────────┘  └──────────┘
    │           │           │           │            │
    └───────────┴───────────┴───────────┴────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐
    │    Postgres     │     │     Redis       │
    │  (4 schemas)    │     │  (cache+queue)  │
    └─────────────────┘     └─────────────────┘
```

## 📦 Services

| Service | Tech | Port | Description |
|---------|------|------|-------------|
| **Auth Service** | Go/Gin | 8001 | JWT, Dex OIDC, sessions |
| **Chore Service** | Python/FastAPI | 8002 | CRUD, recurrence, import/export |
| **Log Service** | Python/FastAPI | 8003 | Audit trail, undo capability |
| **Notification Service** | Node/Express | 8004 | Push notifications, preferences |
| **AI Copilot Service** | Python/FastAPI | 8005 | NLP, suggestions, Ollama integration |
| **Frontend** | Vue 3/Pinia | 3000 | Material You PWA |

## 🛠️ Tech Stack

- **Frontend**: Vue 3, Pinia, Vite, Hammer.js, PWA
- **Auth**: Go 1.21+, Gin, JWT, Dex OIDC
- **Services**: Python 3.12, FastAPI, SQLAlchemy 2.0
- **Database**: PostgreSQL 16 (schema isolation)
- **Cache/Queue**: Redis 7
- **DevOps**: Docker, Docker Compose, K3s, FluxCD, nginx-ingress

## 📚 Documentation

- [Getting Started](docs/GETTING_STARTED.md) - First-time setup
- [Architecture](docs/ARCHITECTURE.md) - System design and patterns
- [Development Guide](docs/DEVELOPMENT.md) - Local development workflow
- [API Reference](docs/API.md) - Service endpoints
- [Testing](docs/TESTING.md) - Unit, integration, and E2E tests
- [Deployment](docs/DEPLOYMENT.md) - Production deployment with FluxCD
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

**Production Stack:** K3s + FluxCD + nginx-ingress + cert-manager

**Domains:**
- Production: `choretwo.stillon.top`
- Staging: `choretwo-staging.stillon.top`

**Deploy Flow:**
1. Push to main → GitHub Actions builds images
2. Flux reconciles (5min interval) → staging
3. E2E tests run on staging
4. Manual approval → production
5. Tag-based production deployment

## 🤝 Development Workflow

1. **Start services**: `docker-compose up -d`
2. **Frontend dev**: `cd frontend && npm run dev`
3. **Backend dev**: Run service directly (see docs/DEVELOPMENT.md)
4. **Test locally**: `make test-all`
5. **Lint**: `make lint-all`
6. **Commit**: Follow conventional commits format

## 📝 Recent Changes

**v1.0.0 (Current)** - Initial release
- ✅ Complete Microservices Architecture
- ✅ Material You PWA with 20+ components
- ✅ Dex OAuth2 with mock auth fallback
- ✅ Swipe gestures (Hammer.js)
- ✅ Undo-capable log system
- ✅ AI Copilot with natural language
- ✅ E2E tests with Playwright (9 tests)
- ✅ PWA support with offline queue

## 🐛 Known Issues

- PWA icons are placeholders (generate with `npm run generate-icons`)
- AI Copilot requires Ollama running locally or in cluster
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
