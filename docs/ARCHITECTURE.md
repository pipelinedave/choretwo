# Architecture

System architecture, service responsibilities, and data flow.

## System Overview

Choretwo is a microservices-based chore management platform with 6 independent services communicating through HTTP APIs.

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser / PWA]
        Mobile[Mobile PWA]
    end

    subgraph "Infrastructure Layer"
        Ingress[nginx-ingress]
        Postgres[PostgreSQL]
        Redis[Redis]
    end

    subgraph "Application Layer"
        Frontend[Frontend<br/>Vue 3]
        Auth[Auth Service<br/>Go/Gin]
        Chore[Chore Service<br/>Python/FastAPI]
        Log[Log Service<br/>Python/FastAPI]
        Notify[Notification Service<br/>Node/Express]
        AI[AI Copilot<br/>Python/FastAPI]
    end

    Browser --> Ingress
    Mobile --> Ingress
    Ingress --> Frontend
    Ingress --> Auth
    Ingress --> Chore
    Ingress --> Log
    Ingress --> Notify
    Ingress --> AI

    Auth --> Postgres
    Chore --> Postgres
    Log --> Postgres
    Notify --> Postgres

    Auth --> Redis
    Chore --> Redis
    Notify --> Redis
```

## Service Architecture

### Service Responsibilities

| Service | Language | Port | Primary Responsibility |
|---------|----------|------|------------------------|
| Frontend | Vue 3 | 3000 | PWA UI, state management |
| Auth | Go | 8001 | Authentication, sessions, JWT |
| Chore | Python | 8002 | Chore CRUD, recurrence logic |
| Log | Python | 8003 | Audit trail, undo operations |
| Notification | Node.js | 8004 | Push notifications, scheduling |
| AI Copilot | Python | 8005 | NLP, smart suggestions |

### Service Communication Pattern

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth Service
    participant C as Chore Service
    participant L as Log Service
    participant N as Notify Service

    U->>F: Login
    F->>A: POST /api/auth/login
    A-->>F: JWT token + session cookie
    F->>A: GET /api/auth/user (verify)
    A-->>F: User info

    U->>F: Create chore
    F->>C: POST /api/chores (with JWT)
    C->>L: POST /api/logs (audit)
    C-->>F: Chore created
    L-->>C: Log entry created
    C->>N: POST /api/notify/schedule
    N-->>C: Notification scheduled
```

## Database Architecture

### Schema Isolation

Single PostgreSQL instance with schema-based isolation:

```mermaid
graph LR
    subgraph "PostgreSQL: choretwo"
        subgraph "Schema: auth"
            A1[users]
            A2[sessions]
            A3[tokens]
        end

        subgraph "Schema: chores"
            C1[chores]
            C2[assignments]
            C3[recurrence_rules]
        end

        subgraph "Schema: logs"
            L1[chore_logs]
            L2[action_history]
        end

        subgraph "Schema: notifications"
            N1[notification_preferences]
            N2[scheduled_notifications]
        end
    end

    Auth[Auth Service] --> A1
    Auth --> A2
    Auth --> A3

    Chore[Chore Service] --> C1
    Chore --> C2
    Chore --> C3

    Log[Log Service] --> L1
    Log --> L2

    Notify[Notify Service] --> N1
    Notify --> N2
```

### Core Tables

#### Auth Schema
```sql
CREATE TABLE auth.users (
    email VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    provider VARCHAR(50),
    provider_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE auth.sessions (
    id UUID PRIMARY KEY,
    user_email VARCHAR(255) REFERENCES auth.users(email),
    jwt_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Chores Schema
```sql
CREATE TABLE chores.chores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    interval_days INT NOT NULL DEFAULT 7,
    due_date DATE NOT NULL,
    done BOOLEAN DEFAULT FALSE,
    done_by VARCHAR(255),
    last_done DATE,
    owner_email VARCHAR(255),
    is_private BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chores.assignments (
    chore_id INT REFERENCES chores.chores(id),
    user_email VARCHAR(255) REFERENCES auth.users(email),
    assigned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (chore_id, user_email)
);
```

#### Logs Schema
```sql
CREATE TABLE logs.chore_logs (
    id SERIAL PRIMARY KEY,
    chore_id INT,
    user_email VARCHAR(255),
    action_type VARCHAR(50) NOT NULL,
    action_details JSONB,
    previous_state JSONB,
    current_state JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chore_logs_chore_id ON logs.chore_logs(chore_id);
CREATE INDEX idx_chore_logs_user_email ON logs.chore_logs(user_email);
CREATE INDEX idx_chore_logs_created_at ON logs.chore_logs(created_at);
```

#### Notifications Schema
```sql
CREATE TABLE notifications.notification_preferences (
    user_email VARCHAR(255) PRIMARY KEY REFERENCES auth.users(email),
    enabled BOOLEAN DEFAULT TRUE,
    notify_times JSONB DEFAULT '["09:00", "18:00"]',
    notify_overdue BOOLEAN DEFAULT TRUE,
    notify_soon BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications.scheduled_notifications (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR(255),
    chore_id INT,
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    notification_type VARCHAR(50),
    processed BOOLEAN DEFAULT FALSE
);
```

## Authentication Flow

### OAuth2 with Dex (Production)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth Service
    participant D as Dex (OIDC)
    participant P as PostgreSQL

    U->>F: Click "Login with Google"
    F->>A: GET /api/auth/login
    A->>D: Redirect to Dex OAuth
    D->>U: Show login page
    U->>D: Authenticate with Google
    D->>A: Callback with auth code
    A->>D: Exchange code for token
    D-->>A: ID token + user info
    A->>P: Store/update user in auth.users
    A->>A: Generate JWT
    A->>A: Create session cookie
    A->>F: Redirect with JWT
    F->>A: GET /api/auth/user (verify JWT)
    A-->>F: User profile
    F->>F: Store in Pinia store
```

### Mock Auth (Development)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth Service

    U->>F: Enter email
    F->>A: POST /api/auth/login {email}
    A->>A: Generate mock JWT
    A->>A: Create session
    A-->>F: JWT + user info
    F->>F: Store in Pinia store
```

### JWT Structure

```json
{
  "sub": "user@example.com",
  "name": "User Name",
  "iat": 1640000000,
  "exp": 1640086400,
  "iss": "choretwo-auth",
  "aud": "choretwo-frontend"
}
```

## API Gateway Pattern

### nginx-ingress Configuration

All external traffic routes through nginx-ingress with path-based routing:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: choretwo-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - choretwo.stillon.top
      secretName: choretwo-tls
  rules:
    - host: choretwo.stillon.top
      http:
        paths:
          - path: /api/auth
            pathType: Prefix
            backend:
              service: auth-service
              port:
                number: 80
          - path: /api/chores
            pathType: Prefix
            backend:
              service: chore-service
              port:
                number: 80
          - path: /api/logs
            pathType: Prefix
            backend:
              service: log-service
              port:
                number: 80
          - path: /api/notify
            pathType: Prefix
            backend:
              service: notify-service
              port:
                number: 80
          - path: /api/ai
            pathType: Prefix
            backend:
              service: ai-service
              port:
                number: 80
          - path: /
            pathType: Prefix
            backend:
              service: frontend
              port:
                number: 80
```

## Caching Strategy

### Redis Usage

| Service | Cache Key Pattern | Purpose | TTL |
|---------|-------------------|---------|-----|
| Auth | `session:{jwt_token}` | Session validation | 24h |
| Chore | `chore:{id}` | Chore data | 5m |
| Chore | `user_chores:{email}` | User chore list | 5m |
| Notify | `prefs:{email}` | User preferences | 1h |

### Cache Invalidation

```mermaid
graph LR
    A[Write Operation] --> B{Cache Key?}
    B -->|Yes| C[Update Database]
    B -->|No| D[Update Database]
    C --> E[Delete Cache Key]
    D --> F[No Cache]
    E --> G[Next Read Fetches Fresh]
```

## Frontend Architecture

### State Management (Pinia)

```mermaid
graph TB
    subgraph "Pinia Stores"
        Auth[auth store<br/>user, token, login/logout]
        Chore[chore store<br/>chores, loading, filters]
        Log[log store<br/>logs, undo queue]
        Notify[notify store<br/>preferences, permissions]
    end

    subgraph "UI Components"
        Dashboard[Dashboard]
        ChoreList[Chore List]
        ChoreDetail[Chore Detail]
        Settings[Settings]
    end

    Auth --> Dashboard
    Chore --> ChoreList
    Chore --> ChoreDetail
    Log --> ChoreList
    Notify --> Settings
```

### Component Hierarchy

```
App.vue
├── AppHeader.vue
│   ├── UserMenu.vue
│   └── ThemeToggle.vue
├── RouterView
│   ├── LoginView.vue
│   ├── DashboardView.vue
│   │   ├── ChoreStats.vue
│   │   ├── UpcomingChores.vue
│   │   └── RecentLogs.vue
│   ├── ChoreListView.vue
│   │   ├── ChoreCard.vue
│   │   ├── FilterPills.vue
│   │   └── AddChoreButton.vue
│   ├── LogView.vue
│   └── SettingsView.vue
└── AppFooter.vue
```

## Service-to-Service Communication

### HTTP API Calls

Services communicate via HTTP with JWT authentication:

```go
// Auth service validates JWT, adds user context
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractToken(c)
        claims, err := validateJWT(token)
        if err != nil {
            c.JSON(401, gin.H{"error": "invalid token"})
            c.Abort()
            return
        }
        c.Set("user_email", claims.Subject)
        c.Next()
    }
}
```

### Error Handling

```json
{
  "error": "Chore not found",
  "code": "CHORE_NOT_FOUND",
  "details": {
    "chore_id": 123
  }
}
```

## Security Architecture

### Security Layers

1. **Transport Layer**: TLS 1.3 (cert-manager + letsencrypt-prod)
2. **Authentication**: JWT + secure session cookies
3. **Authorization**: Service-level auth middleware
4. **Data Isolation**: Schema-based database isolation
5. **Secrets Management**: SealedSecrets for K8s

### CORS Configuration

```go
config := cors.DefaultConfig()
config.AllowOrigins = []string{"https://choretwo.stillon.top"}
config.AllowCredentials = true
config.AllowHeaders = []string{"Authorization", "Content-Type"}
config.MaxAge = 12 * time.Hour
```

## Scalability Considerations

### Horizontal Scaling

- **Stateless services**: Auth, Chore, Log, AI can scale horizontally
- **Session storage**: Redis-backed sessions for auth service
- **Database**: Read replicas for chore queries (future)

### Performance Optimization

- **CDN**: Static assets served via CDN (future)
- **Caching**: Redis for frequently accessed data
- **Database indexing**: Composite indexes on user_email + status
- **Lazy loading**: Frontend code splitting by route

## Deployment Architecture

### K3s Cluster Structure

```mermaid
graph TB
    subgraph "K3s Cluster"
        subgraph "Namespace: choretwo-staging"
            F1[Frontend x2]
            A1[Auth x2]
            C1[Chore x2]
            L1[Log x2]
            N1[Notify x2]
            AI1[AI x2]
        end

        subgraph "Namespace: default"
            P[Postgres]
            R[Redis]
        end

        subgraph "System"
            Ingress[nginx-ingress]
            Flux[FluxCD]
            Cert[cert-manager]
        end
    end

    Ingress --> F1
    Ingress --> A1
    Ingress --> C1
    Ingress --> L1
    Ingress --> N1
    Ingress --> AI1

    F1 --> P
    A1 --> P
    C1 --> P
    L1 --> P

    A1 --> R
    C1 --> R
    N1 --> R
```

## Monitoring & Observability

### Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /api/auth/health
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/auth/health
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Logging Strategy

- **Structured logging**: JSON format
- **Centralized logging**: Fluentd + Elasticsearch (future)
- **Log retention**: 7 days in K8s, 30 days in ELK

## Future Enhancements

1. **WebSocket Support**: Real-time chore updates
2. **GraphQL API**: Flexible data fetching
3. **Multi-region**: Geo-distributed deployment
4. **Event Sourcing**: Chore state as event stream
5. **ML Pipeline**: Advanced AI predictions

---

**Next**: [DEVELOPMENT.md](./DEVELOPMENT.md) - Set up your development environment
