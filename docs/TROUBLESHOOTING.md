# Troubleshooting Guide
Common issues, debugging strategies, and solutions for Choretwo.
## Quick Reference
| Issue | Likely Cause | Solution |
|-------|-------------|----------|
| Port already in use | Another service using port | `lsof -i :PORT` and kill process |
| Database connection failed | Wrong credentials or service down | Check postgres container status |
| JWT validation failed | Expired or invalid token | Regenerate token or check secret |
| CORS errors | Wrong origin configuration | Verify CORS settings in service |
| Flux not reconciling | Git sync issues | Check Flux logs and status |
| Build failed | Dependency issues | Clear cache and rebuild |
## Service-Specific Issues
### Auth Service (Go)
#### Issue: "JWT token expired"
**Symptoms:**
- 401 Unauthorized errors
- Users logged out unexpectedly
**Solutions:**
```bash
# Check JWT expiry setting
echo $JWT_EXPIRY  # Should be reasonable (e.g., 24h)
# Regenerate token
curl http://localhost:8001/api/auth/login \
  -d '{"email": "test@example.com"}'
# Check token in browser DevTools
# Application → Cookies → Find JWT token
Issue: "Dex callback failed"
Symptoms:
- OAuth flow stuck at callback
- "Invalid redirect_uri" error
Solutions:
# Verify Dex configuration
kubectl get configmap dex -n auth-system -o yaml
# Check redirect URIs match
# Should be: http://localhost:3000/auth-callback (dev)
# or https://choretwo.stillon.top/auth-callback (prod)
# Restart auth service
docker-compose restart auth-service
Issue: "Mock auth not working"
Symptoms:
- Login button doesn't respond
- No token returned
Solutions:
# Check environment variable
docker-compose exec auth-service env | grep MOCK
# Verify USE_MOCK_AUTH=true in .env
# Restart with correct env
docker-compose up -d --force-recreate auth-service
Chore Service (Python)
Issue: "Chore not created"
Symptoms:
- POST /api/chores returns 500
- No error message
Solutions:
# Check service logs
docker-compose logs chore-service --tail=50
# Verify database connection
docker-compose exec chore-service python -c "
from app.database import engine
print(engine.connect())
"
# Check schema exists
docker-compose exec postgres psql -U choretwo -d choretwo -c "\dt chores.*"
Issue: "Recurrence calculation wrong"
Symptoms:
- Due dates incorrect
- Interval not applied properly
Solutions:
# Debug recurrence logic
from app.utils.recurrence import calculate_due_date
print(calculate_due_date(last_done="2024-01-01", interval_days=7))
# Should output: 2024-01-08
# Check timezone handling
# Ensure all dates use UTC
Issue: "Import/export fails"
Symptoms:
- Large imports timeout
- Export returns empty file
Solutions:
# Check memory limits
docker-compose exec chore-service free -h
# Increase timeout for imports
# Set IMPORT_TIMEOUT=300 in .env
# Verify file size
ls -lh import-file.json
# Should be < 10MB for dev
Log Service (Python)
Issue: "Undo not working"
Symptoms:
- POST /api/undo returns success but no change
- Chore state unchanged
Solutions:
# Check log entry exists
docker-compose exec postgres psql -U choretwo -d choretwo \
  -c "SELECT * FROM logs.chore_logs ORDER BY id DESC LIMIT 5"
# Verify action_type is valid
# Should be: created, updated, marked_done, archived
# Check previous_state JSON
# Must contain all fields needed for restoration
Issue: "Log retention not working"
Symptoms:
- Logs table growing indefinitely
- Old logs not deleted
Solutions:
# Check retention policy config
docker-compose exec log-service env | grep RETENTION
# Manually run cleanup
docker-compose exec log-service python -c "
from app.utils.retention import cleanup_old_logs
cleanup_old_logs(days=30)
"
# Verify cleanup
docker-compose exec postgres psql -U choretwo -d choretwo \
  -c "SELECT COUNT(*) FROM logs.chore_logs"
Notification Service (Node)
Issue: "Notifications not sent"
Symptoms:
- No browser notifications
- Scheduled queue not processing
Solutions:
# Check Redis connection
docker-compose exec notification-service node -e "
const redis = require('redis');
const client = redis.createClient();
client.on('error', (err) => console.error(err));
client.connect().then(() => console.log('Connected'));
"
# Check queue status
docker-compose exec notification-service node -e "
const queue = require('./app/queue');
queue.getWaiting().then(console.log);
"
# Verify browser permission granted
# Check browser: Settings → Privacy → Notifications
Issue: "Bull queue stuck"
Symptoms:
- Jobs not processing
- Queue shows stuck
Solutions:
# Flush Redis queue (dev only!)
docker-compose exec redis redis-cli FLUSHALL
# Restart notification service
docker-compose restart notification-service
# Check for dead jobs
docker-compose exec notification-service node -e "
const queue = require('./app/queue');
queue.getFailed().then(failed => console.log('Failed:', failed.length));
"
AI Copilot Service (Python)
Issue: "Ollama not responding"
Symptoms:
- 503 Service Unavailable
- "Model not found" error
Solutions:
# Check Ollama is running
curl http://localhost:11434/api/version
# Pull required model
ollama pull llama2
# Check service configuration
docker-compose exec ai-copilot-service env | grep OLLAMA
# Verify model name matches
# Should be: OLLAMA_MODEL=llama2
Issue: "NLP parsing fails"
Symptoms:
- Commands not recognized
- Returns generic error
Solutions:
# Test NLP parser directly
docker-compose exec ai-copilot-service python -c "
from app.nlp.parser import parse_command
result = parse_command('Mark dishes done')
print(result)
# Should output: {'action': 'mark_done', 'chore_name': 'dishes'}
"
# Check prompt templates
cat services/ai-copilot-service/app/prompts/*.txt
Frontend (Vue)
Issue: "White screen / blank page"
Symptoms:
- No content loaded
- Console shows errors
Solutions:
# Check browser console for errors
# F12 → Console tab
# Verify all services running
docker-compose ps
# Clear browser cache
# DevTools → Application → Clear storage
# Check service worker
# DevTools → Application → Service Workers → Unregister
Issue: "Authentication loop"
Symptoms:
- Redirects to login repeatedly
- Can't stay logged in
Solutions:
// Check localStorage for token
// DevTools → Console → localStorage.getItem('token')
// Clear auth state
localStorage.clear()
localStorage.removeItem('token')
localStorage.removeItem('user')
window.location.reload()
// Check cookie settings
// DevTools → Application → Cookies → Check domain/path
Issue: "PWA not installing"
Symptoms:
- No install prompt
- "Add to home screen" missing
Solutions:
# Verify HTTPS (required for PWA)
# DevTools → Application → Manifest
# Check service worker registration
navigator.serviceWorker.getRegistrations()
# Ensure manifest.json is valid
curl http://localhost:3000/manifest.json
Database Issues
PostgreSQL Connection Problems
Issue: "Connection refused"
Symptoms:
- All services fail to connect
- "ECONNREFUSED 127.0.0.1:5432"
Solutions:
# Check postgres is running
docker-compose ps postgres
# Check port binding
docker-compose port postgres 5432
# Test connection
docker-compose exec postgres psql -U choretwo -c "SELECT 1"
# Check for port conflict
lsof -i :5432
Issue: "Schema does not exist"
Symptoms:
- "schema \"chores\" does not exist"
- Query fails immediately
Solutions:
# Create missing schema
docker-compose exec postgres psql -U choretwo -d choretwo <<EOF
CREATE SCHEMA chores;
CREATE SCHEMA auth;
CREATE SCHEMA logs;
CREATE SCHEMA notifications;
EOF
# Or run init script
docker-compose exec postgres psql -U choretwo -d choretwo < scripts/init-schemas.sql
Issue: "Database locked"
Symptoms:
- "relation already exists"
- Migration fails
Solutions:
# Find blocking connections
docker-compose exec postgres psql -U choretwo -d choretwo -c "
SELECT pid, usename, datname, client_addr, state, query
FROM pg_stat_activity
WHERE datname = 'choretwo';
"
# Terminate specific connection
docker-compose exec postgres psql -U choretwo -d choretwo -c "
SELECT pg_terminate_backend(PID);
"
# Or drop and recreate (dev only!)
docker-compose down -v
docker-compose up -d
Redis Connection Problems
Issue: "Redis connection timeout"
Symptoms:
- Cache operations fail
- Queue not working
Solutions:
# Check redis is running
docker-compose ps redis
# Test connection
docker-compose exec redis redis-cli ping
# Should return: PONG
# Check Redis logs
docker-compose logs redis --tail=50
Kubernetes/Flux Issues
Flux Not Reconciling
Issue: "Kustomization not applied"
Symptoms:
- Changes not deployed
- Flux status shows stale
Solutions:
# Check Flux status
flux get kustomizations -n flux-system
# Force reconcile
flux reconcile kustomization choretwo-staging -n flux-system --with-source
# Check Flux logs
kubectl logs -n flux-system -l app.kubernetes.io/name=flux -f
# Verify GitRepository is synced
flux get gitrepositories -n flux-system
Issue: "Image not found"
Symptoms:
- Pod in ImagePullBackOff
- "manifest unknown" error
Solutions:
# Check image exists on DockerHub
docker pull pipelinedave/auth-service:latest
# Verify image tag in Kustomize
cat k3s-config/kustomize/choretwo/overlays/staging/deployment.yaml
# Check DockerHub credentials
kubectl get secrets -n choretwo-staging
# Manually pull image
kubectl set image deployment/auth-service \
  auth-service=pipelinedave/auth-service:latest \
  -n choretwo-staging
Issue: "Secret decryption failed"
Symptoms:
- SealedSecrets not decrypting
- "unable to decrypt" error
Solutions:
# Check sealed-secrets controller
kubectl get pods -n kube-system | grep sealed
# Verify certificate
kubeseal --fetch-cert > cert.pem
# Re-seal secret
kubectl create secret generic my-secret \
  --from-literal=key=value -n choretwo-staging --dry-run=client -o yaml > secret.yaml
kubeseal --format yaml < secret.yaml > sealed-secret.yaml
kubectl apply -f sealed-secret.yaml
Pod Issues
Issue: "CrashLoopBackOff"
Symptoms:
- Pod restarting continuously
- Can't access service
Solutions:
# Check pod status
kubectl get pods -n choretwo-staging
# View pod logs
kubectl logs -n choretwo-staging deploy/auth-service --previous
# Describe pod for events
kubectl describe pod -n choretwo-staging <pod-name>
# Check resource limits
kubectl top pods -n choretwo-staging
# Exec into pod (if it starts)
kubectl exec -it -n choretwo-staging <pod-name> -- /bin/sh
Issue: "Pending pods"
Symptoms:
- Pod stuck in Pending state
- No nodes available
Solutions:
# Check why pending
kubectl describe pod -n choretwo-staging <pod-name>
# Check node capacity
kubectl get nodes
kubectl describe node <node-name>
# Check resource requests
kubectl get deploy -n choretwo-staging -o yaml | grep -A 5 resources:
Build/CI Issues
Docker Build Failures
Issue: "Build context too large"
Symptoms:
- Build hangs
- "context size exceeds limit"
Solutions:
# Check .dockerignore
cat .dockerignore
# Exclude unnecessary files
echo "node_modules" >> .dockerignore
echo "*.md" >> .dockerignore
echo "tests/" >> .dockerignore
# Build with specific context
docker build -t auth-service ./services/auth-service
Issue: "Layer caching issues"
Symptoms:
- Build extremely slow
- Dependencies re-downloading
Solutions:
# Clear build cache
docker builder prune -a
# Use buildx for better caching
docker buildx build --cache-from type=local,src=/tmp/buildx-cache \
  --cache-to type=local,dest=/tmp/buildx-cache-new -t auth-service