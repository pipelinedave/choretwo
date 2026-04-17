# Choretwo GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows Overview

### 1. CI Pipeline (`ci.yaml`)

**Trigger**: Push and Pull Request to `main` and `develop` branches

**Jobs**:
- **Lint**: Runs linters for all services
  - Go (golangci-lint) for auth-service
  - Ruff for Python services (chore, log, ai)
  - ESLint for Node services (notification, frontend)

- **Test**: Runs unit tests with coverage
  - Go tests for auth-service
  - Pytest for Python services
  - Jest for notification-service
  - Uploads coverage to Codecov

- **E2E**: Runs Playwright E2E tests (PRs only)
  - Tests authentication flow
  - Uploads test reports as artifacts

- **Security Scan**: Trivy vulnerability scanning
  - Scans entire repository
  - Uploads results to GitHub Security tab

### 2. Build and Push (`build-and-push.yaml`)

**Trigger**: Push to `main` and version tags (`v*`)

**Features**:
- Builds Docker images for all 6 services
- Pushes to DockerHub (pipelinedave/*)
- Multi-tag support (branch, semver, SHA)
- Layer caching for faster builds
- Build args for version tracking

**Image Tags**:
- `latest` - main branch
- `v1.2.3` - version tags
- `v1.2` - minor version
- `v1` - major version
- `abc123f` - commit SHA

### 3. Deploy to Staging (`deploy-staging.yaml`)

**Trigger**: Push to `main` branch

**Workflow**:
1. Updates Kustomize image tags with new commit SHA
2. Commits and pushes changes to main
3. Flux automatically reconciles (5min interval)
4. Runs E2E tests against staging environment
5. Notifies deployment status

**Environment**: `staging` (requires configuration in GitHub)

**URL**: https://choretwo-staging.stillon.top

### 4. Deploy to Production (`deploy-production.yaml`)

**Trigger**: Version tags (`v*`)

**Workflow**:
1. **Manual Approval**: Requires human approval in Actions tab
2. Updates Kustomize image tags with version
3. Commits and pushes to main
4. Flux reconciles production deployment
5. Runs smoke tests against production
6. Notifies deployment status

**Environment**: `production` (requires configuration in GitHub)

**URL**: https://choretwo.stillon.top

### 5. Security Scanning (`security.yaml`)

**Triggers**:
- Weekly schedule (Sundays at midnight)
- Push to main (Dockerfile/dependency changes)
- Pull requests

**Scans**:
- **Trivy**: Container vulnerability scanning
- **Dependency Check**: 
  - pip-audit for Python
  - npm audit for Node.js
  - govulncheck for Go
- **CodeQL**: Static code analysis
- **Gitleaks**: Secret detection

## Setup Requirements

### 1. Repository Secrets

Configure these secrets in GitHub → Settings → Secrets and variables → Actions:

```
DOCKERHUB_USERNAME=<your-dockerhub-username>
DOCKERHUB_TOKEN=<your-dockerhub-token>
```

**Note**: For production deployments, you may also want to add:
```
SLACK_WEBHOOK_URL=<for-notifications>
DISCORD_WEBHOOK_URL=<for-notifications>
```

### 2. Environment Configuration

Create two environments in GitHub → Settings → Environments:

**Staging Environment**:
- Name: `staging`
- Protection rules: None (auto-deploy)
- Secrets: (optional)

**Production Environment**:
- Name: `production`
- Protection rules: 
  - ✅ Required reviewers (add your team)
  - ✅ Wait timer (optional, 5-10 minutes)
- Secrets: (optional)

### 3. Branch Protection Rules

Recommended settings in GitHub → Settings → Branches:

**main branch**:
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
  - Select: `lint`, `test`, `security-scan`
- ✅ Require branches to be up to date before merging
- ✅ Include administrators
- ✅ Restrict who can push to main

### 4. Codecov Integration

For coverage reporting:
1. Sign up at https://codecov.io
2. Add repository
3. Copy `CODECOV_TOKEN` secret
4. Add to GitHub secrets: `CODECOV_TOKEN`

## Manual Workflows

### Trigger Staging Deployment

Push to main branch - happens automatically.

To force Flux reconciliation:
```bash
flux reconcile kustomization choretwo-staging -n flux-system
```

### Trigger Production Deployment

1. Create and push a version tag:
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. Go to Actions tab → "Deploy to Production" → Review and approve

### Cancel a Running Workflow

Actions tab → Click workflow → "Cancel workflow"

### Rerun Failed Jobs

Actions tab → Click workflow → "Re-run jobs"

## Troubleshooting

### Lint Failures
```bash
# Run locally to debug
make lint-all
```

### Test Failures
```bash
# Run locally to debug
make test-all
```

### Docker Build Failures
Check:
1. Dockerfile syntax
2. Base image availability
3. Build context paths
4. Docker Hub authentication

### Deployment Failures
Check:
1. Flux status: `flux get kustomizations -n flux-system`
2. Flux errors: `flux trace kustomization choretwo-staging -n flux-system`
3. Kubernetes events: `kubectl get events -n choretwo-staging`

### Secret Not Found
Ensure:
1. Secrets are configured in GitHub → Settings → Secrets
2. Secret names match exactly (case-sensitive)
3. Secrets are available to the environment (if using environment secrets)

## Best Practices

1. **Always test locally first**: Use `make lint-all` and `make test-all`
2. **Use descriptive commit messages**: Follow conventional commits
3. **Create feature branches**: Never push directly to main for features
4. **Review security scans**: Check GitHub Security tab regularly
5. **Monitor workflow runs**: Set up notifications for failures
6. **Keep dependencies updated**: Use Dependabot for automated updates

## Adding New Services

1. Add service to `ci.yaml` lint and test jobs
2. Add service to `build-and-push.yaml` matrix
3. Add service to `.github/CODEOWNERS`
4. Update `Makefile` with service commands
5. Create Dockerfile for the service

## Performance Optimization

- **Cache dependencies**: All workflows use action caching
- **Parallel jobs**: Services lint/test/build in parallel
- **Layer caching**: Docker builds use registry cache
- **Conditional runs**: Jobs only run when relevant files change

## Monitoring

### Workflow Metrics
- GitHub → Actions → Workflow runs
- View duration, success rate, failure patterns

### Cost Optimization
- Use self-hosted runners for faster builds (optional)
- Limit workflow history retention
- Use matrix strategy efficiently

## Support

For issues or questions:
1. Check existing GitHub Issues
2. Create a new issue with "workflow" label
3. Contact @pipelinedave
