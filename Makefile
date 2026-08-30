.PHONY: help dev dev-down dev-stop dev-logs dev-shell dev-restart
.PHONY: dev-auth dev-chore dev-log dev-notify dev-ai dev-frontend
.PHONY: test test-all test-auth test-chore test-log test-notify test-ai test-frontend test-e2e test-coverage
.PHONY: coverage-check
.PHONY: lint lint-all lint-auth lint-chore lint-log lint-notify lint-ai lint-frontend
.PHONY: build build-all build-auth build-chore build-log build-notify build-ai build-frontend
.PHONY: push push-all push-auth push-chore push-log push-notify push-ai push-frontend
.PHONY: clean reset-db migrate seed

help:
	@echo "Choretwo Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start all services with docker-compose"
	@echo "  make dev-down     - Stop and remove all services"
	@echo "  make dev-stop     - Stop all services"
	@echo "  make dev-logs     - View logs from all services"
	@echo "  make dev-shell    - Open PostgreSQL shell"
	@echo "  make dev-auth     - Start only auth-service"
	@echo "  make dev-chore    - Start only chore-service"
	@echo "  make dev-log      - Start only log-service"
	@echo "  make dev-notify   - Start only notification-service"
	@echo "  make dev-ai       - Start only ai-copilot-service"
	@echo "  make dev-frontend - Start only frontend"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make test-all     - Run all service & frontend tests"
	@echo "  make test-auth    - Run auth-service tests"
	@echo "  make test-chore   - Run chore-service tests"
	@echo "  make test-log     - Run log-service tests"
	@echo "  make test-notify  - Run notification-service tests"
	@echo "  make test-ai      - Run ai-copilot-service tests"
	@echo "  make test-frontend - Run frontend unit tests"
	@echo "  make test-e2e     - Run E2E tests"
	@echo ""
	@echo "Building:"
	@echo "  make build        - Build all Docker images"
	@echo "  make build-all    - Build all Docker images"
	@echo ""
	@echo "Pushing:"
	@echo "  make push         - Push all images to DockerHub"
	@echo "  make push-all     - Push all images to DockerHub"

# Development
dev:
	docker-compose up -d

dev-down:
	docker-compose down

dev-stop:
	docker-compose stop

dev-logs:
	docker-compose logs -f

dev-shell:
	docker-compose exec postgres psql -U choretwo -d choretwo

dev-restart:
	docker-compose restart

dev-auth:
	docker-compose up -d auth-service

dev-chore:
	docker-compose up -d chore-service

dev-log:
	docker-compose up -d log-service

dev-notify:
	docker-compose up -d notification-service

dev-ai:
	docker-compose up -d ai-copilot-service

dev-frontend:
	docker-compose up -d frontend

# Testing
test: test-all

test-all: test-auth test-chore test-log test-notify test-ai test-frontend

test-auth:
	cd services/auth-service && go test ./... -v

test-chore:
	cd services/chore-service && PYTHONPATH=. python3 -m pytest tests/ -v

test-log:
	cd services/log-service && PYTHONPATH=. python3 -m pytest tests/ -v

test-notify:
	cd services/notification-service && PYTHONPATH=. python3 -m pytest tests/ -v

test-ai:
	cd services/ai-copilot-service && PYTHONPATH=. python3 -m pytest tests/ -v

test-frontend:
	cd frontend && npm test -- --run

test-e2e:
	cd frontend && npm run test:e2e

test-coverage:
	cd services/chore-service && python3 -m pytest tests/ --cov=app --cov-report=html
	cd services/log-service && python3 -m pytest tests/ --cov=app --cov-report=html
	cd services/ai-copilot-service && python3 -m pytest tests/ --cov=app --cov-report=html

coverage-check:
	cd services/chore-service && python3 -m pytest tests/ --cov=app --cov-report=term-missing --cov-fail-under=90
	cd services/log-service && python3 -m pytest tests/ --cov=app --cov-report=term-missing --cov-fail-under=90
	cd services/ai-copilot-service && python3 -m pytest tests/ --cov=app --cov-report=term-missing --cov-fail-under=80

# Linting
lint: lint-all

lint-all: lint-auth lint-chore lint-log lint-notify lint-ai lint-frontend

lint-auth:
	cd services/auth-service && go vet ./...

lint-chore:
	cd services/chore-service && ruff check app/ tests/

lint-log:
	cd services/log-service && ruff check app/ tests/

lint-notify:
	cd services/notification-service && ruff check app/ tests/

lint-ai:
	cd services/ai-copilot-service && ruff check app/ tests/

lint-frontend:
	cd frontend && npm run build

# Building
build: build-all

build-all: build-auth build-chore build-log build-notify build-ai build-frontend

build-auth:
	docker build -t pipelinedave/auth-service:latest ./services/auth-service

build-chore:
	docker build -t pipelinedave/chore-service:latest ./services/chore-service

build-log:
	docker build -t pipelinedave/log-service:latest ./services/log-service

build-notify:
	docker build -t pipelinedave/notification-service:latest ./services/notification-service

build-ai:
	docker build -t pipelinedave/ai-copilot-service:latest ./services/ai-copilot-service

build-frontend:
	docker build -t pipelinedave/frontend:latest ./frontend

# Pushing
push: push-all

push-all: push-auth push-chore push-log push-notify push-ai push-frontend

push-auth:
	docker push pipelinedave/auth-service:latest

push-chore:
	docker push pipelinedave/chore-service:latest

push-log:
	docker push pipelinedave/log-service:latest

push-notify:
	docker push pipelinedave/notification-service:latest

push-ai:
	docker push pipelinedave/ai-copilot-service:latest

push-frontend:
	docker push pipelinedave/frontend:latest

# Utilities
clean:
	docker-compose down -v

reset-db:
	docker-compose down -v && docker-compose up -d

migrate:
	@echo "Running database migrations..."
	docker-compose exec postgres psql -U choretwo -d choretwo -f /docker-entrypoint-initdb.d/init-db.sql
