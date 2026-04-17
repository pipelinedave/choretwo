# Choretwo Deployment Guide

## Overview

This guide covers the complete deployment pipeline for Choretwo, from local development to production.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   GitHub    │─────▶│ GitHub Actions│─────▶│   DockerHub   │
│  Repository │      │   CI/CD      │      │  (Images)     │
└─────────────┘      └──────────────┘      └──────────────┘
                            │
                            ▼
                    ┌──────────────┐      ┌──────────────┐
                    │    Flux      │─────▶│    K3s       │
                    │   (GitOps)   │      │  Cluster     │
                    └──────────────┘      └──────────────┘
```

## Prerequisites

### Required Tools

```bash
# Git
git --version

# GitHub CLI (for repository management)
gh --version

# Flux CLI (for GitOps operations)
flux --version

# Docker (for local testing)
docker --version

# kubectl (for cluster access)
kubectl version --client

# SealedSecrets (for secret management)
kubeseal --version
```

### Access Requirements

1. **GitHub**: Write access to `pipelinedave/choretwo`
2. **DockerHub**: Account with `pipelinedave` organization access
3. **K3s Cluster**: Cluster access with kubeconfig
4. **Domain**: DNS configured for `stillon.top` subdomains

## GitHub Setup

### 1. Repository Secrets

Navigate to: `https://github.com/pipelinedave/choretwo/settings/secrets/actions`

**Required Secrets**:
```
DOCKERHUB_USERNAME=pipelinedave
DOCKERHUB_TOKEN=<DockerHub access token>
```

**Optional Secrets**:
```
SLACK_WEBHOOK_URL=<for notifications>
DISCORD_WEBHOOK_URL=<for notifications>
CODECOV_TOKEN=<for coverage reporting>
```

### 2. Environment Configuration

Navigate to: `https://github.com/pipelinedave/choretwo/settings/environments`

#### Staging Environment
- **Name**: `staging`
- **Protection Rules**: None (auto-deploy)
- **Deployment Branches**: `main`

#### Production Environment
- **Name**: `production`
- **Protection Rules**:
  - ✅ Required reviewers (add team members)
  - ✅ Wait timer: 5 minutes
- **Deployment Branches**: All branches (tag-triggered)

### 3. Branch Protection Rules

Navigate to: `https://github.com/pipelinedave/choretwo/settings/branches`

**Rules for `main` branch**:
- ✅ Require pull request reviews before merging (1 review)
- ✅ Require status checks to pass before merging
  - `lint` - All services linting
  - `test` - All service tests
  - `security-scan` - Trivy scan
- ✅ Require branches to be up to date before merging
- ✅ Include administrators
- ✅ Restrict who can push (optional)

## Local Development

### Workflow

1. **Create Feature Branch**:
```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

2. **Make Changes**:
```bash
# Run linting
make lint-all

# Run tests
make test-all

# Build images locally
make build-all
```

3. **Push and Create PR**:
```bash
git add .
git commit -m "feat: your descriptive message"
git push origin feature/your-feature-name

# Create PR via GitHub or gh CLI
gh pr create --title "Your Feature" --body "Description"
```

4. **Review and Merge**:
- CI pipeline runs automatically
- Address review feedback
- Merge when approved and checks pass

## Continuous Integration

### Automated Workflows

**On Pull Request**:
1. Linting (all services)
2. Unit tests (all services)
3. E2E tests (frontend)
4. Security scanning

**On Push to Main**:
1. All CI checks
2. Build Docker images
3. Push to DockerHub
4. Deploy to staging
5. E2E tests on staging

### Monitoring Workflows

View workflow runs: `https://github.com/pipelinedave/choretwo/actions`

**Key Metrics**:
- Success rate
- Build duration
- Test coverage
- Security findings

## Staging Deployment

### Automatic Deployment

Staging deploys automatically on every push to `main`:

1. GitHub Actions builds images with commit SHA tag
2. Kustomize is updated with new image tags
3. Changes are committed back to main
4. Flux reconciles (5-minute interval)
5. E2E tests run against staging

### Manual Flux Operations

```bash
# Check Flux status
flux get kustomizations -n flux-system

# Force reconcile staging
flux reconcile kustomization choretwo-staging -n flux-system --with-source

# Trace issues
flux trace kustomization choretwo-staging -n flux-system

# Check service status
kubectl get pods -n choretwo-staging
kubectl get deployments -n choretwo-staging
```

### Staging URL

**https://choretwo-staging.stillon.top**

## Production Deployment

### Version Tagging

Production deploys on version tags (`v*`):

```bash
# Create version tag
git tag -a v1.0.0 -m "Release v1.0.0"

# Push tag
git push origin v1.0.0
```

### Manual Approval

1. Tag push triggers "Deploy to Production" workflow
2. Navigate to Actions tab
3. Click "Review deployments"
4. Approve production deployment
5. Workflow updates Kustomize and pushes
6. Flux reconciles production
7. Smoke tests run automatically

### Production URL

**https://choretwo.stillon.top**

## Service-Specific Deployment

### Auth Service
- **Port**: 8001
- **Health Check**: `/health`
- **Dependencies**: PostgreSQL (auth schema), Redis

### Chore Service
- **Port**: 8002
- **Health Check**: `/health`
- **Dependencies**: PostgreSQL (chores schema)

### Log Service
- **Port**: 8003
- **Health Check**: `/health`
- **Dependencies**: PostgreSQL (logs schema)

### Notification Service
- **Port**: 8004
- **Health Check**: `/health`
- **Dependencies**: PostgreSQL (notifications schema), Redis

### AI Copilot Service
- **Port**: 8005
- **Health Check**: `/health`
- **Dependencies**: PostgreSQL, external AI APIs

### Frontend
- **Port**: 80
- **Health Check**: `/`
- **Dependencies**: All API services

## Rollback Procedure

### Quick Rollback

```bash
# Find previous working version
git tag -l | sort -V

# Create rollback tag
git tag -a v1.0.1-rollback -m "Rollback to v1.0.0"
git push origin v1.0.1-rollback
```

### Manual Rollback via Kustomize

```bash
# Edit Kustomize files
vim k3s-config/kustomize/choretwo/overlays/production/*.yaml

# Update image tags to previous version
# Commit and push
git add k3s-config/
git commit -m "chore: rollback to v1.0.0"
git push origin main
```

### Flux Rollback

```bash
# Force Flux to reconcile with previous version
flux reconcile kustomization choretwo-production -n flux-system --with-source
```

## Monitoring & Observability

### Kubernetes Commands

```bash
# View logs
kubectl logs -n choretwo-staging -l app=auth-service -f
kubectl logs -n choretwo-production -l app=chore-service -f

# Check resource usage
kubectl top pods -n choretwo-staging
kubectl top pods -n choretwo-production

# Describe pod (for events)
kubectl describe pod -n choretwo-staging <pod-name>

# Exec into container
kubectl exec -it -n choretwo-staging <pod-name> -- /bin/sh
```

### Health Checks

```bash
# Service health
curl https://choretwo-staging.stillon.top/api/auth/health
curl https://choretwo-staging.stillon.top/api/chores/health
curl https://choretwo-staging.stillon.top/api/logs/health

# Production
curl https://choretwo.stillon.top/api/auth/health
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check Docker build locally
docker build -t test ./services/auth-service

# Check base image availability
docker pull golang:1.22-alpine
```

#### Deployment Failures
```bash
# Check Flux status
flux get kustomizations -n flux-system

# Check Kubernetes events
kubectl get events -n choretwo-staging --sort-by='.lastTimestamp'

# Check pod status
kubectl get pods -n choretwo-staging
kubectl describe pod -n choretwo-staging <pod-name>
```

#### Database Issues
```bash
# Connect to database
kubectl exec -it -n choretwo-staging postgres-0 -- psql -U choretwo

# Check schemas
\dn

# Check tables
\dt auth.*
\dt chores.*
```

#### Secret Issues
```bash
# Check sealed secrets
kubectl get sealedsecrets -n choretwo-staging

# Decrypt for debugging (if needed)
kubeseal --raw --from-file=secret.yaml --certificate-pubkey pub.cert --format json
```

## Security Best Practices

### Secrets Management

✅ **DO**:
- Use SealedSecrets for Kubernetes secrets
- Store secrets in GitHub Actions secrets
- Use environment-specific secrets
- Rotate secrets regularly

❌ **DON'T**:
- Commit secrets to git
- Hardcode credentials
- Use the same secrets across environments
- Store secrets in plain text

### Network Security

```yaml
# Network policies (example)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: auth-service-policy
  namespace: choretwo-staging
spec:
  podSelector:
    matchLabels:
      app: auth-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: nginx-ingress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: choretwo-staging
```

### Image Security

- Use specific image tags (not `latest`)
- Scan images with Trivy
- Use multi-stage builds
- Run as non-root user

## Performance Optimization

### Docker Images
```dockerfile
# Use multi-stage builds
FROM golang:1.22-alpine AS builder
# ... build steps

FROM alpine:latest
COPY --from=builder /app/auth-service /app
# ... runtime config
```

### Kubernetes Resources
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Horizontal Pod Autoscaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: choretwo-staging
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Cost Optimization

1. **Use spot instances** for staging
2. **Right-size resources** based on actual usage
3. **Enable cluster autoscaler**
4. **Use image caching** in CI/CD
5. **Limit workflow retention** in GitHub

## Support & Resources

### Documentation
- [AGENTS.md](../AGENTS.md) - Agent instructions
- [WORKFLOWS.md](../.github/WORKFLOWS.md) - GitHub Actions guide
- [PRD](../docs/PRD_base.md) - Product requirements

### External Links
- [Flux Documentation](https://fluxcd.io/docs/)
- [GitHub Actions Docs](https://docs.github.com/actions)
- [Docker Documentation](https://docs.docker.com)
- [Kubernetes Documentation](https://kubernetes.io/docs)

### Contact
- **Maintainer**: @pipelinedave
- **Issues**: https://github.com/pipelinedave/choretwo/issues
- **Discussions**: https://github.com/pipelinedave/choretwo/discussions

---

**Last Updated**: 2026-04-17
**Version**: 1.0.0
