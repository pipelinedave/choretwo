# Choretwo GitHub Actions Workflows

Stand: 28.09.2026. CI + Security laufen hier; **Deploys macht Vercel**
(Git-Integration auto-deployt Push auf `main`). Die alten Cluster-Workflows
(`build-and-push`, `deploy-staging`, `deploy-production`,
`update-kubernetes-deployment`) sind gelöscht — sie scheiterten bei jedem Push,
Vercel braucht sie nicht.

## Workflows

### 1. CI (`ci.yaml`)

Trigger: Push und PR auf `main`. Lint (golangci-lint, Ruff, ESLint),
Unit-Tests mit Coverage (Go, pytest, Vitest), Playwright-E2E, Trivy-Scan.

### 2. Security (`security.yaml`)

Trigger: Push/PR + Schedule. Dependency-/Container-Scans, Upload ins
GitHub Security-Tab.

## Deploy (kein Workflow)

1. Auf `main` pushen → Vercel baut
   (`frontend`-Build + `monolith/sync_vendor.py`) und deployt Production.
2. Verifizieren: `https://choretwo.stillon.top/health`.
3. Rollback: Vercel-Dashboard → letztes grünes Deployment promoten.

Env-Vars, Domains, Build-Logs: NUR über `vera` (Vercel-Agent).

## Secrets (GitHub Actions)

Nur CI-relevantes (z. B. Codecov-Token, optional). Keine Deploy-Secrets mehr
nötig (keine Container-Registry, kein Cluster-Token). Prod-Secrets liegen als
Vercel-Env-Vars (via `vera`), nie in GitHub Secrets für Deploy-Zwecke.

## Troubleshooting

- CI rot → Actions-Log lesen, lokal mit `make test-all` / `make lint-all`
  reproduzieren.
- Vercel-Build rot → Build-Logs via `vera`; lokal Build-Command 1:1 ausführen
  (siehe [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)).

## Historisch

Bis 09/2026: Registry-Builds + GitOps-Deploys (Staging/Prod). Details nur
noch in der Git-Historie.
