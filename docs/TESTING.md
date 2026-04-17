# Testing

Testing strategies, frameworks, and coverage requirements.

## Test Pyramid

```
         /\
        /  \
       / E2E\        - Full user flows (Playwright)
      /------\
     /        \
    /Integration\   - Service-to-service (pytest, Go test)
   /------------\
  /              \
 /    Unit Tests  \  - Fast feedback (pytest, Go test, Jest)
/------------------\
```

## Coverage Requirements

| Service | Unit | Integration | E2E | Total |
|---------|------|-------------|-----|-------|
| Auth | 90% | 80% | - | 85% |
| Chore | 90% | 80% | - | 85% |
| Log | 90% | 80% | - | 85% |
| Notification | 85% | 75% | - | 80% |
| AI Copilot | 80% | 70% | - | 75% |
| Frontend | 80% | - | 70% | 75% |

## Unit Testing

### Auth Service (Go)

```go
// tests/auth_test.go
package tests

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestValidateJWT(t *testing.T) {
    validToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    claims, err := ValidateJWT(validToken)

    assert.NoError(t, err)
    assert.NotEmpty(t, claims.Subject)
}

func TestGenerateSessionID(t *testing.T) {
    sessionID := GenerateSessionID()

    assert.Len(t, sessionID, 36) // UUID format
}
```

**Run tests:**
```bash
cd services/auth-service
go test ./... -v
go test ./... -cover
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### Chore Service (Python)

```python
# tests/test_chores.py
import pytest
from app.models.chore import Chore
from app.schemas.chore import ChoreCreate

def test_create_chore():
    chore_data = ChoreCreate(
        name="Dishes",
        interval_days=1,
        due_date="2024-01-01"
    )

    assert chore_data.name == "Dishes"
    assert chore_data.interval_days == 1

def test_chore_due_date_calculation():
    chore = Chore(
        name="Laundry",
        interval_days=7,
        last_done="2024-01-01"
    )

    assert chore.due_date == "2024-01-08"
```

**Run tests:**
```bash
cd services/chore-service
pytest tests/ -v
pytest tests/ -v --cov=app --cov-report=html
pytest tests/ -v --cov=app --cov-report=xml --cov-fail-under=90
```

### Frontend (Vitest)

```javascript
// tests/unit/auth.store.test.js
import { describe, it, expect } from 'vitest'
import { useAuthStore } from '@/stores/auth'

describe('Auth Store', () => {
  it('should set user after login', () => {
    const store = useAuthStore()
    const user = { email: 'test@example.com', name: 'Test' }

    store.$patch({ user, isAuthenticated: true })

    expect(store.user.email).toBe('test@example.com')
    expect(store.isAuthenticated).toBe(true)
  })

  it('should clear user after logout', () => {
    const store = useAuthStore()
    store.logout()

    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})
```

**Run tests:**
```bash
cd frontend
npm run test:unit
npm run test:unit -- --coverage
```

## Integration Testing

### Service-to-Service Communication

```python
# tests/integration/test_chore_log_integration.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_create_chore_creates_log(client, auth_token):
    # Arrange
    chore_data = {
        "name": "Test Chore",
        "interval_days": 7
    }

    # Act
    response = client.post(
        "/api/chores",
        json=chore_data,
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    # Assert
    assert response.status_code == 201
    chore_id = response.json()["id"]

    # Verify log was created
    log_response = client.get(
        f"/api/logs?chore_id={chore_id}",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert log_response.status_code == 200
    assert len(log_response.json()) > 0
```

**Run integration tests:**
```bash
cd services/chore-service
pytest tests/integration/ -v
```

### Database Integration Tests

```python
# tests/integration/test_database.py
import pytest
from sqlalchemy.orm import Session
from app.models.chore import Chore

def test_chore_crud(session: Session):
    # Create
    chore = Chore(name="Test", interval_days=7)
    session.add(chore)
    session.commit()

    # Read
    retrieved = session.query(Chore).filter(Chore.id == chore.id).first()
    assert retrieved.name == "Test"

    # Update
    retrieved.name = "Updated"
    session.commit()

    # Delete
    session.delete(retrieved)
    session.commit()
    assert session.query(Chore).filter(Chore.id == chore.id).first() is None
```

## End-to-End Testing

### Playwright Setup

```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
```

### E2E Test Examples

```javascript
// tests/e2e/auth-login.spec.js
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('.user-menu')).toContainText('test@example.com');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('Invalid credentials');
  });
});
```

```javascript
// tests/e2e/chore-crud.spec.js
import { test, expect } from '@playwright/test';

test.describe('Chore Management', () => {
  test.use({ storageState: 'authenticated.json' });

  test('should create a new chore', async ({ page }) => {
    await page.goto('/chores');
    await page.click('[data-testid="add-chore"]');

    await page.fill('[name="name"]', 'New Chore');
    await page.selectOption('[name="interval"]', '7');
    await page.click('[data-testid="save-chore"]');

    await expect(page.locator('.chore-card')).toContainText('New Chore');
  });

  test('should mark chore as done', async ({ page }) => {
    await page.goto('/chores');

    const chore = page.locator('.chore-card').first();
    await chore.locator('[data-testid="mark-done"]').click();

    await expect(chore).toHaveClass(/done/);
  });

  test('should undo action via log', async ({ page }) => {
    await page.goto('/logs');

    const lastLog = page.locator('.log-entry').first();
    await lastLog.locator('[data-testid="undo"]').click();

    await expect(page.locator('.success-message')).toContainText('Action undone');
  });
});
```

**Run E2E tests:**
```bash
cd frontend
npm run test:e2e          # All browsers
npm run test:e2e:ui       # UI mode
npm run test:e2e:headed   # Visible browser
```

## Test Data Management

### Fixtures

```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base

@pytest.fixture(scope='session')
def engine():
    engine = create_engine('postgresql://test:test@localhost:5432/choretwo_test')
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture
def session(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def test_user(session):
    user = User(email='test@example.com', name='Test User')
    session.add(user)
    session.commit()
    return user

@pytest.fixture
def test_chore(session, test_user):
    chore = Chore(
        name='Test Chore',
        interval_days=7,
        owner_email=test_user.email
    )
    session.add(chore)
    session.commit()
    return chore
```

### Mock External Services

```python
# tests/mocks/dex_mock.py
from unittest.mock import Mock, patch

@pytest.fixture
def mock_dex_client():
    with patch('app.dex.client.DexClient') as mock:
        mock.return_value.get_user_info.return_value = {
            'email': 'test@example.com',
            'name': 'Test User'
        }
        yield mock
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth, chore, log, notify, ai, frontend]

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: choretwo_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        if: matrix.service == 'auth'
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'

      - name: Setup Python
        if: matrix.service != 'auth' && matrix.service != 'frontend'
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Setup Node
        if: matrix.service == 'frontend'
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          if [ "${{ matrix.service }}" == "auth" ]; then
            cd services/auth-service && go mod download
          elif [ "${{ matrix.service }}" == "frontend" ]; then
            cd frontend && npm ci
          else
            cd services/${{ matrix.service }}-service && pip install -r requirements.txt
          fi

      - name: Run tests
        run: |
          if [ "${{ matrix.service }}" == "auth" ]; then
            cd services/auth-service && go test ./... -cover
          elif [ "${{ matrix.service }}" == "frontend" ]; then
            cd frontend && npm run test:unit -- --coverage
          else
            cd services/${{ matrix.service }}-service && pytest tests/ --cov=app
          fi

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage.xml
```

## E2E Test Environments

### Staging Environment

```yaml
# E2E tests run against staging before production deploy
name: E2E Tests

on:
  workflow_run:
    workflows: ["Deploy Staging"]
    types: [completed]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Run E2E tests
        env:
          PLAYWRIGHT_BASE_URL: https://choretwo-staging.stillon.top
        run: cd frontend && npm run test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

## Test Reporting

### Coverage Reports

```bash
# Generate HTML report
pytest tests/ --cov=app --cov-report=html

# Generate XML for CI
pytest tests/ --cov=app --cov-report=xml

# Check coverage threshold
pytest tests/ --cov=app --cov-fail-under=90
```

### Test Results

```bash
# JUnit format for CI
pytest tests/ --junitxml=results.xml

# Allure report
pytest tests/ --alluredir=./results
allure serve ./results
```

## Common Test Patterns

### Testing Error Cases

```python
def test_create_chore_without_auth(client):
    response = client.post("/api/chores", json={"name": "Test"})

    assert response.status_code == 401
    assert response.json()["error"] == "Unauthorized"

def test_mark_chore_done_invalid_chore(client, auth_token):
    response = client.put(
        "/api/chores/99999/mark-done",
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    assert response.status_code == 404
    assert response.json()["error"] == "Chore not found"
```

### Testing Concurrent Operations

```python
def test_concurrent_chore_updates(client, test_chore, auth_token):
    # Simulate concurrent updates
    response1 = client.put(
        f"/api/chores/{test_chore.id}",
        json={"name": "Update 1"},
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    response2 = client.put(
        f"/api/chores/{test_chore.id}",
        json={"name": "Update 2"},
        headers={"Authorization": f"Bearer {auth_token}"}
    )

    # Both should succeed with optimistic locking
    assert response1.status_code == 200
    assert response2.status_code == 200
```

## Performance Testing

### Load Testing

```python
# tests/performance/test_load.py
import pytest
from locust import HttpUser, task, between

class ChoreUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def list_chores(self):
        self.client.get("/api/chores")

    @task(1)
    def create_chore(self):
        self.client.post("/api/chores", json={
            "name": "Load Test Chore",
            "interval_days": 7
        })
```

**Run load test:**
```bash
locust -f tests/performance/test_load.py --host=http://localhost:8002
```

## Manual Testing Checklist

### Pre-deployment

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Coverage thresholds met
- [ ] Linting passes
- [ ] Security scan clean
- [ ] Manual smoke test on staging

### Post-deployment

- [ ] Health endpoints respond
- [ ] Login works
- [ ] Create chore works
- [ ] Mark chore done works
- [ ] Undo works
- [ ] Notifications delivered
- [ ] AI copilot responds

---

**Next**: [DEVELOPMENT.md](./DEVELOPMENT.md) - Local development setup
