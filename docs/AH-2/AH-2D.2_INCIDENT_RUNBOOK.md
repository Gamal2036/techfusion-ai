# AH-2D.2 — Incident Runbook

## How to Use This Runbook

Each incident scenario includes:
1. **Symptoms** — what you observe
2. **Metrics to inspect** — Prometheus queries
3. **Logs to inspect** — log search patterns
4. **Likely causes** — ranked by probability
5. **Safe first actions** — what to do immediately
6. **Escalation criteria** — when to escalate

---

## 1. API Returns 5xx Errors

### Symptoms
- Users report "Internal Server Error"
- HTTP 5xx rate elevated in dashboards
- `elevated_http_5xx_rate` alert firing

### Metrics to Inspect
```promql
# Current 5xx rate
rate(http_requests_total{status_code=~"5.."}[5m])

# 5xx by route
topk(10, sum by (route) (rate(http_requests_total{status_code=~"5.."}[5m])))

# Active requests (potential overload)
http_active_requests

# Internal errors counter
rate(internal_errors_total[5m])
```

### Logs to Inspect
```bash
# Search for error-level logs
grep '"level":"ERROR"' /var/log/api-gateway.log

# Search by status code
grep '"statusCode":5' /var/log/api-gateway.log

# Look for specific error types
grep 'errorType' /var/log/api-gateway.log | tail -20
```

### Likely Causes
1. Database connection pool exhaustion
2. Unhandled exception in business logic
3. External API timeout (AI providers, Stripe)
4. Memory pressure causing OOM
5. Recent deployment introduced regression

### Safe First Actions
1. Check API health: `curl http://localhost:3001/health/ready`
2. Check PostgreSQL: `pg_isready -h localhost -p 5433`
3. Check Redis: `redis-cli -p 6379 ping`
4. Review recent deployments
5. Check container memory: `docker stats techfusion-api-gateway`

### Escalation
- If 5xx rate > 20% for > 5 minutes → escalate to on-call
- If database is unreachable → escalate to DBA
- If memory > 80% → escalate to platform team

---

## 2. API Readiness Failing

### Symptoms
- Load balancer marks instances as unhealthy
- `api_readiness_failing` alert firing
- `GET /health/ready` returns 503

### Metrics to Inspect
```promql
# Database connection attempts
rate(db_connection_attempts_total{outcome="failure"}[5m])

# Redis connection attempts
rate(redis_connection_attempts_total{outcome="failure"}[5m])
```

### Logs to Inspect
```bash
# Readiness check results
grep 'health/ready' /var/log/api-gateway.log

# Database errors
grep 'postgres.*error\|PrismaClient' /var/log/api-gateway.log

# Redis errors
grep 'redis.*error\|ioredis' /var/log/api-gateway.log
```

### Likely Causes
1. PostgreSQL is down or unreachable
2. Redis is down or unreachable
3. Connection pool exhaustion
4. Network partition between API and dependencies

### Safe First Actions
1. Verify PostgreSQL: `pg_isready -h <host> -p <port>`
2. Verify Redis: `redis-cli -h <host> -p <port> ping`
3. Check connection pool: review `DATABASE_URL` max connections
4. Check container networking: `docker network inspect techfusion`

### Escalation
- If both DB and Redis are down → infrastructure incident
- If only DB → escalate to DBA
- If connection pool related → scale or tune pool size

---

## 3. PostgreSQL Unavailable

### Symptoms
- API readiness returns `postgres: { status: "error" }`
- `db_connection_attempts_total{outcome="failure"}` increasing
- `postgresql_unavailable` alert firing

### Metrics to Inspect
```promql
# Connection failure rate
rate(db_connection_attempts_total{outcome="failure"}[5m])

# Query error rate
rate(db_query_errors_total[5m])
```

### Logs to Inspect
```bash
# Database connection errors
grep 'PrismaClientInitializationError\|Can.*reach database' /var/log/api-gateway.log

# PostgreSQL container logs
docker logs techfusion-postgres --tail 50
```

### Likely Causes
1. PostgreSQL container crashed
2. Disk space exhausted
3. Too many connections (pool exhaustion)
4. Authentication failure (wrong password)
5. Network issue

### Safe First Actions
1. Check PostgreSQL container: `docker ps | grep postgres`
2. Check PostgreSQL logs: `docker logs techfusion-postgres --tail 100`
3. Test connectivity: `pg_isready -h localhost -p 5433`
4. Check disk space: `df -h /var/lib/postgresql/data`
5. Restart if needed: `docker restart techfusion-postgres`

### Escalation
- If disk is full → immediate infrastructure escalation
- If auth failure → check environment variables
- If OOM → increase memory limits

---

## 4. Redis Unavailable

### Symptoms
- Worker health returns degraded
- Queue processing stops
- `redis_connection_attempts_total{outcome="failure"}` increasing
- `redis_unavailable` alert firing

### Metrics to Inspect
```promql
# Redis connection failures
rate(redis_connection_attempts_total{outcome="failure"}[5m])

# Queue depths growing
bullmq_queue_depth

# Worker health
worker_health
```

### Logs to Inspect
```bash
# Redis connection errors
grep 'redis.*error\|ECONNREFUSED\|ioredis' /var/log/worker.log

# Redis container logs
docker logs techfusion-redis --tail 50
```

### Likely Causes
1. Redis container crashed
2. Memory limit reached (maxmemory)
3. Network issue
4. Redis too busy (slow commands)

### Safe First Actions
1. Check Redis container: `docker ps | grep redis`
2. Check Redis logs: `docker logs techfusion-redis --tail 100`
3. Test connectivity: `redis-cli -p 6379 ping`
4. Check memory: `redis-cli info memory | grep used_memory_human`
5. Restart if needed: `docker restart techfusion-redis`

### Escalation
- If Redis OOM → increase maxmemory or investigate key patterns
- If Redis crash loop → infrastructure escalation

---

## 5. Worker Not Processing Jobs

### Symptoms
- Queue depths growing continuously
- Jobs stuck in "waiting" state
- `oldest_queue_job_age` increasing

### Metrics to Inspect
```promql
# Queue depths
bullmq_queue_depth

# Active vs waiting jobs
bullmq_waiting_jobs
bullmq_active_jobs

# Worker health
worker_health

# Job completion rate
rate(bullmq_jobs_completed_total[5m])

# Processor failures
rate(bullmq_processor_failures_total[5m])
```

### Logs to Inspect
```bash
# Worker startup
grep 'Worker started\|All.*workers started' /var/log/worker.log

# Worker errors
grep '"level":"ERROR"' /var/log/worker.log | tail -20

# Queue connection issues
grep 'ready and connected to Redis\|error.*Redis' /var/log/worker.log
```

### Likely Causes
1. Worker process crashed
2. Redis connection lost
3. Processor throwing unhandled errors
4. All workers busy (concurrency exhausted)

### Safe First Actions
1. Check worker status: `docker ps | grep worker`
2. Check worker health: `curl http://localhost:9465/health`
3. Check worker logs: `docker logs techfusion-worker --tail 100`
4. Restart worker: `docker restart techfusion-worker`

### Escalation
- If worker keeps crashing → check for processor bugs
- If Redis is down → follow Redis unavailable runbook
- If concurrency issue → increase worker concurrency

---

## 6. Queue Backlog Grows

### Symptoms
- `queue_backlog_high` alert firing
- `bullmq_queue_depth > 100` sustained

### Metrics to Inspect
```promql
# Current queue depths
bullmq_queue_depth

# Job failure rate per queue
rate(bullmq_jobs_failed_total[5m])

# Job duration
histogram_quantile(0.95, rate(bullmq_job_duration_seconds_bucket[5m]))
```

### Logs to Inspect
```bash
# Failed jobs
grep '"level":"ERROR".*queueName' /var/log/worker.log | tail -20

# Slow jobs
grep 'duration' /var/log/worker.log | sort -t':' -k2 -n | tail -10
```

### Likely Causes
1. Worker processing too slowly
2. High volume of incoming jobs
3. Jobs failing and retrying repeatedly
4. External dependency slow (API calls in processors)

### Safe First Actions
1. Check which queue is backing up
2. Check failure rate for that queue
3. Scale workers if possible
4. Review slow job patterns

### Escalation
- If all queues backing up → worker not running
- If one queue backing up → processor issue

---

## 7. WebSocket Clients Cannot Connect

### Symptoms
- Clients fail to establish WebSocket connection
- `websocket_auth_failures_total` increasing
- Real-time features not working

### Metrics to Inspect
```promql
# WS connections
websocket_connections

# WS auth failures
rate(websocket_auth_failures_total[5m])

# WS disconnections
rate(websocket_disconnections_total[5m])
```

### Logs to Inspect
```bash
# WS connection rejections
grep 'WS connection rejected' /var/log/api-gateway.log

# Auth failures in WS middleware
grep 'Authentication required\|Invalid.*token\|Invalid or expired' /var/log/api-gateway.log
```

### Likely Causes
1. JWT token expired
2. CORS misconfiguration
3. Invalid handshake auth
4. Socket.IO version mismatch

### Safe First Actions
1. Check API health: `curl http://localhost:3001/health`
2. Verify CORS config (ALLOWED_ORIGINS, WS_ALLOWED_ORIGINS)
3. Check JWT_SECRET is set
4. Review client connection code

### Escalation
- If all WS connections fail → API issue
- If auth failures only → token/JWT config issue

---

## 8. Device Agent Cannot Register

### Symptoms
- Agent logs show "Cannot reach API"
- `device_registration_outcomes_total{outcome="failure"}` increasing
- New devices not appearing

### Metrics to Inspect
```promql
# Registration outcomes
rate(device_registration_outcomes_total{outcome="failure"}[5m])
```

### Logs to Inspect
```bash
# Agent startup
grep 'Cannot reach API\|API is reachable' /var/log/agent.log

# Registration attempts
grep 'register\|registration' /var/log/agent.log
```

### Likely Causes
1. API Gateway unreachable from agent network
2. API Gateway not running
3. Network/firewall blocking connection
4. Invalid API URL in agent config

### Safe First Actions
1. Verify API is running: `curl http://<api-host>:3001/health`
2. Check agent config (TF_API_URL)
3. Test network connectivity: `curl http://<api-host>:3001/health` from agent host
4. Check agent logs: `journalctl -u techfusion-agent --tail 50`

### Escalation
- If API is down → follow API unavailable runbook
- If network issue → infrastructure escalation

---

## 9. Metrics Stop Arriving

### Symptoms
- Grafana dashboards show flatlines
- Prometheus targets down
- No new data points

### Metrics to Inspect
```promql
# Check if scrape targets are up
up{job="techfusion-api-gateway"}
up{job="techfusion-worker"}
```

### Logs to Inspect
```bash
# Prometheus logs
docker logs techfusion-prometheus --tail 50

# API gateway metrics endpoint
curl -s http://localhost:3001/metrics | head -5
```

### Likely Causes
1. Metrics endpoint unreachable (API/Worker down)
2. METRICS_AUTH_TOKEN mismatch
3. Prometheus scrape config wrong
4. Network issue between Prometheus and targets

### Safe First Actions
1. Verify metrics endpoints: `curl http://localhost:3001/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify METRICS_AUTH_TOKEN matches if set
4. Check Prometheus logs

### Escalation
- If targets down → service issue
- If Prometheus issue → infrastructure

---

## 10. Security Reports Fail

### Symptoms
- `security_report_outcomes_total{outcome="failure"}` increasing
- Security findings not appearing in UI

### Metrics to Inspect
```promql
# Security report failures
rate(security_report_outcomes_total{outcome="failure"}[5m])
```

### Logs to Inspect
```bash
# Security endpoint errors
grep 'security.*error\|security.*fail' /var/log/api-gateway.log

# Queue processing failures
grep 'Security.*failed\|security.*error' /var/log/worker.log
```

### Likely Causes
1. Payload validation failure (malformed report)
2. Database write failure
3. Storage failure
4. Agent sending invalid data

### Safe First Actions
1. Check API logs for validation errors
2. Check database connectivity
3. Review security endpoint handler
4. Check agent version

### Escalation
- If validation issue → check agent code
- If DB issue → follow PostgreSQL unavailable runbook

---

## 11. Remote Support Cannot Activate

### Symptoms
- Remote sessions fail to establish
- `remote_support_consent_outcomes_total{outcome="rejected"}` increasing

### Metrics to Inspect
```promql
# Remote support failures
rate(remote_support_consent_outcomes_total{outcome="rejected"}[5m])

# Active sessions
remote_support_active_sessions
```

### Logs to Inspect
```bash
# Remote support errors
grep 'remote.*support\|remote.*session' /var/log/api-gateway.log

# WS connection issues for /remote namespace
grep 'namespace.*remote.*reject' /var/log/api-gateway.log
```

### Likely Causes
1. Session not found (expired/invalid)
2. Device consent not sent
3. WebSocket connection failure
4. Cross-org session rejection

### Safe First Actions
1. Check session exists in database
2. Verify device is online
3. Check WebSocket connectivity
4. Review consent flow logs

### Escalation
- If session exists but can't connect → WebSocket issue
- If session not found → check agent polling

---

## 12. Frontend Loads but APIs Fail

### Symptoms
- UI renders but data doesn't load
- API requests return errors in browser console
- CORS errors visible

### Metrics to Inspect
```promql
# HTTP error rate by route
sum by (route) (rate(http_requests_total{status_code=~"4..|5.."}[5m]))
```

### Logs to Inspect
```bash
# CORS errors
grep 'CORS\|origin\|Origin' /var/log/api-gateway.log

# Auth failures
grep 'Unauthorized\|Missing.*authorization' /var/log/api-gateway.log
```

### Likely Causes
1. CORS misconfiguration (ALLOWED_ORIGINS)
2. JWT token expired
3. API Gateway down
4. Rate limiting blocking requests

### Safe First Actions
1. Check browser console for specific error
2. Verify ALLOWED_ORIGINS includes frontend URL
3. Check API health: `curl http://localhost:3001/health`
4. Check rate limit config

### Escalation
- If CORS → config change needed
- If API down → follow API unavailable runbook

---

## 13. Memory Usage Grows Continuously

### Symptoms
- `high_memory_usage` alert firing
- Container restarts (OOMKilled)
- `process_resident_memory_bytes` increasing steadily

### Metrics to Inspect
```promql
# Memory usage
process_resident_memory_bytes / 1048576

# Heap usage
process_heap_bytes / 1048576

# Active requests (potential leak source)
http_active_requests
```

### Logs to Inspect
```bash
# Check for OOM kills
dmesg | grep -i 'oom\|kill'

# Memory warnings
grep 'memory\|heap\|GC' /var/log/api-gateway.log
```

### Likely Causes
1. Memory leak in application code
2. Connection pool not releasing
3. Large payload processing
4. Event listener accumulation

### Safe First Actions
1. Check container memory limits
2. Restart service if OOM
3. Review heap usage pattern
4. Check for large in-memory caches

### Escalation
- If OOMKilled → increase limits temporarily, investigate leak
- If steady growth → memory profiling needed

---

## 14. High Authentication Failures

### Symptoms
- `high_auth_failure_rate` alert firing
- Users reporting login issues
- `authentication_failures_total` increasing rapidly

### Metrics to Inspect
```promql
# Auth failure rate
rate(authentication_failures_total[5m])

# Failures by reason
sum by (reason) (rate(authentication_failures_total[5m]))
```

### Logs to Inspect
```bash
# Auth failure details
grep 'Unauthorized\|Invalid.*token\|expired' /var/log/api-gateway.log
```

### Likely Causes
1. Expired JWT tokens (clock skew or short expiry)
2. Client sending wrong token format
3. Brute force / credential stuffing
4. JWT_SECRET changed without client update

### Safe First Actions
1. Check if failures are from specific IPs (brute force)
2. Verify JWT_SECRET hasn't changed
3. Check token expiry settings
4. Review auth middleware logs

### Escalation
- If brute force → enable rate limiting on auth endpoints
- If systematic → check JWT configuration

---

## 15. Rate Limiting Unexpectedly Blocks Valid Traffic

### Symptoms
- `rate_limit_rejections_total` high
- Valid users getting 429 errors
- `high_rate_limit_rejection_rate` alert firing

### Metrics to Inspect
```promql
# Rate limit rejections
rate(rate_limit_rejections_total[5m])

# Request rate
rate(http_requests_total[5m])
```

### Logs to Inspect
```bash
# Rate limit hits
grep '429\|Too Many Requests\|ThrottlerException' /var/log/api-gateway.log
```

### Likely Causes
1. Rate limit config too restrictive
2. Legitimate traffic spike
3. Automated client hitting limits
4. Shared IP causing false positives

### Safe First Actions
1. Review current rate limit config
2. Check if traffic is legitimate
3. Consider temporarily increasing limits
4. Identify offending clients by IP/pattern

### Escalation
- If legitimate traffic → adjust limits
- If attack → implement IP blocking

---

## Quick Reference

### Health Check Commands

```bash
# API Gateway
curl http://localhost:3001/health
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready

# Worker
curl http://localhost:9465/health
curl http://localhost:9465/health/live
curl http://localhost:9465/health/ready

# Metrics
curl http://localhost:3001/metrics | head -20
curl http://localhost:9464/metrics | head -20

# PostgreSQL
pg_isready -h localhost -p 5433

# Redis
redis-cli -p 6379 ping
```

### Docker Restart Commands

```bash
# Restart individual services
docker restart techfusion-api-gateway
docker restart techfusion-worker
docker restart techfusion-web
docker restart techfusion-postgres
docker restart techfusion-redis

# Restart observability stack
docker compose -f infra/docker/docker-compose.observability.yml restart

# Full restart
docker compose -f infra/docker/docker-compose.yml down && docker compose -f infra/docker/docker-compose.yml up -d
```

### Log Search Patterns

```bash
# JSON log parsing (production)
cat /var/log/api-gateway.log | jq 'select(.level == "ERROR")'

# Filter by request ID
cat /var/log/api-gateway.log | jq 'select(.requestId == "specific-req-id")'

# Filter by queue
cat /var/log/worker.log | jq 'select(.queueName == "alert")'

# Filter by duration > 5 seconds
cat /var/log/api-gateway.log | jq 'select(.duration > 5000)'
```
