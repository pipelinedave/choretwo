.PHONY: help dev dev-down dev-stop dev-logs dev-shell dev-restart
.PHONY: dev-auth dev-chore dev-log dev-notify dev-ai dev-frontend
.PHONY: test test-all test-auth test-chore test-log test-notify test-ai test-e2e test-coverage
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
	@echo "  make test-all     - Run all service tests"
	@echo "  make test-auth    - Run auth-service tests"
	@echo "  make test-chore   - Run chore-service tests"
	@echo "  make test-log     - Run log-service tests"
	@echo "  make test-notify  - Run notification-service tests"
	@echo "  make test-ai      - Run ai-copilot-service tests"
	@echo "  make test-e2e     - Run E2E tests"
	@echo "  make test-coverage - Run tests with coverage"
	@echo "  make coverage-check - Check coverage thresholds"
	@echo ""
	@echo "Linting:"
	@echo "  make lint         - Run all linters"
	@echo "  make lint-all     - Run all service linters"
	@echo "  make lint-auth    - Run auth-service linter (golangci-lint)"
	@echo "  make lint-chore   - Run chore-service linter (ruff)"
	@echo "  make lint-log     - Run log-service linter (ruff)"
	@echo "  make lint-notify  - Run notification-service linter (eslint)"
	@echo "  make lint-ai      - Run ai-copilot-service linter (ruff)"
	@echo "  make lint-frontend - Run frontend linter (eslint)"
	@echo ""
	@echo "Building:"
	@echo "  make build        - Build all Docker images"
	@echo "  make build-all    - Build all Docker images"
	@echo "  make build-auth   - Build auth-service image"
	@echo "  make build-chore  - Build chore-service image"
	@echo "  make build-log    - Build log-service image"
	@echo "  make build-notify - Build notification-service image"
	@echo "  make build-ai     - Build ai-copilot-service image"
	@echo "  make build-frontend - Build frontend image"
	@echo ""
	@echo "Pushing:"
	@echo "  make push         - Push all images to DockerHub"
	@echo "  make push-all     - Push all images to DockerHub"
	@echo "  make push-auth    - Push auth-service image"
	@echo "  make push-chore   - Push chore-service image"
	@echo "  make push-log     - Push log-service image"
	@echo "  make push-notify  - Push notification-service image"
	@echo "  make push-ai      - Push ai-copilot-service image"
	@echo "  make push-frontend - Push frontend image"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Remove all containers and volumes"
	@echo "  make reset-db     - Reset database (drop volumes and restart)"
	@echo "  make migrate      - Run database migrations"
	@echo "  make seed         - Seed initial data"

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

test-all: test-auth test-chore test-log test-notify test-ai

test-auth:
	cd services/auth-service && go test ./... -v

test-chore:
	cd services/chore-service && python -m pytest tests/ -v

test-log:
	cd services/log-service && python -m pytest tests/ -v

test-notify:
	cd services/notification-service && npm test

test-ai:
	cd services/ai-copilot-service && python -m pytest tests/ -v

test-e2e:
	cd frontend && npm run test:e2e

test-coverage:
	cd services/chore-service && python -m pytest tests/ --cov=app --cov-report=html
	cd services/log-service && python -m pytest tests/ --cov=app --cov-report=html
	cd services/ai-copilot-service && python -m pytest tests/ --cov=app --cov-report=html

coverage-check:
	cd services/chore-service && python -m pytest tests/ --cov=app --cov-report=term-missing --cov-fail-under=90
	cd services/log-service && python -m pytest tests/ --cov=app --cov-report=term-missing --cov-fail-under=90
	cd services/ai-copilot-service && python -m pytest tests/ --cov=app --cov-report=term-missing --cov-fail-under=80

# Linting
lint: lint-all

lint-all: lint-auth lint-chore lint-log lint-notify lint-ai lint-frontend

lint-auth:
	cd services/auth-service && golangci-lint run

lint-chore:
	cd services/chore-service && ruff check app/ tests/

lint-log:
	cd services/log-service && ruff check app/ tests/

lint-notify:
	cd services/notification-service && npm run lint

lint-ai:
	cd services/ai-copilot-service && ruff check app/ tests/

lint-frontend:
	cd frontend && npm run lint

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
	docker build -t pipelinedave/choretwo-frontend:latest ./frontend

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
	docker push pipelinedave/choretwo-frontend:latest

# Utilities
clean:
	docker-compose down -v

reset-db:
	docker-compose down -v && docker-compose up -d

migrate:
	@echo "Running database migrations..."
	docker-compose exec postgres psql -U choretwo -d choretwo -f /docker-entrypoint-initdb.d/init-db.sql

seed:
	@echo "Seeding initial data..."
	@echo "Implement seed script"
