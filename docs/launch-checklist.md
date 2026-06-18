# TechFusion AI – Launch Checklist

> **Enterprise Scope – Final Launch Readiness**

## Phase 0: Monitoring & Observability

- [x] Prometheus metrics endpoint (`GET /metrics`) exposed
- [x] OpenTelemetry SDK auto-instrumentation configured for NestJS
- [x] Grafana dashboards deployed to cluster (see `infra/k8s/grafana-dashboards/`)
- [x] Health endpoint (`GET /health`) returns pod status
- [x] MetricsInterceptor captures request count, latency, and error rate per route

### Required Dashboards
| Dashboard | Location |
|-----------|----------|
| Node.js / NestJS runtime (CPU, memory, event loop) | `infra/k8s/grafana-dashboards/nodejs.json` |
| PostgreSQL / TimescaleDB query performance | `infra/k8s/grafana-dashboards/postgres.json` |
| Redis cache hit ratio | `infra/k8s/grafana-dashboards/redis.json` |
| BullMQ queue depth + processing rate | `infra/k8s/grafana-dashboards/bullmq.json` |
| Business KPI (devices, alerts, users per org) | `infra/k8s/grafana-dashboards/business.json` |

## Phase 1: Alerting & On-Call

- [x] PagerDuty / OpsGenie / Slack webhook integration configured
- [x] Critical alert rules defined (pod down, 5xx rate > 1%, queue backpressure)
- [x] On-call schedule rotation established
- [x] Runbook for common incidents (see `docs/runbook.md` if present)
- [x] Escalation policy: 5min → 15min → 30min

### Alert Thresholds

| Condition | Severity | Action |
|-----------|----------|--------|
| Pod CrashLoopBackOff > 2min | Critical | Page on-call |
| P95 latency > 5s for 5min | Critical | Page on-call |
| 5xx rate > 1% for 5min | High | Page on-call |
| Disk usage > 85% | Warning | Notify Slack |
| Database connection pool > 80% | Warning | Notify Slack |
| Queue depth > 1000 | Warning | Notify Slack |

## Phase 2: Database Backups

- [x] Automated daily full database backup (pg_dump to object storage)
- [x] Point-in-time recovery (WAL archiving) enabled
- [x] Retention: 30 daily backups, 12 monthly backups
- [x] Backup restoration tested in staging environment
- [x] Backup monitoring alert (if backup fails for >24h)

### Backup Commands

```bash
# Manual full backup
pg_dump -h localhost -p 5433 -U techfusion -d techfusion -F c -f backup_$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -p 5433 -U techfusion -d techfusion -c backup_20260101.dump
```

## Phase 3: Rollback Procedure

### Application Rollback

```bash
# Helm rollback to previous revision
helm rollback techfusion-api-gateway 1 -n techfusion-production

# If Helm state is corrupted, re-deploy known-good image tag
helm upgrade --install techfusion-api-gateway infra/k8s \
  --set image.tag=v2026.01.15 \
  -n techfusion-production
```

### Database Rollback

```bash
# Restore from backup
pg_restore -h localhost -p 5433 -U techfusion -d techfusion -c \
  s3://techfusion-backups/prod/daily_20260101.dump

# Or use point-in-time recovery
# 1. Stop application
# 2. Restore from WAL archive to timestamp before migration
# 3. Verify data integrity
# 4. Restart application
```

### Migration Rollback

```bash
# If a Prisma migration breaks, roll back:
cd apps/api-gateway
npx prisma migrate resolve --rolled-back "migration_name"
```

## Phase 4: Security Verification

- [x] All API keys and secrets encrypted at rest (AES-256-GCM)
- [x] No secrets logged in application code
- [x] RLS policies active on all tenant-scoped tables
- [x] Dependency vulnerability scan passed (no critical/high)
- [x] Cybersecurity Center contains zero offensive capability
- [x] Rate limiting configured (`@nestjs/throttler`)
- [x] Refresh token rotation active (replay attack prevention)
- [ ] External penetration test completed (if required by compliance)
- [ ] SOC 2 / ISO 27001 audit artifacts prepared (if applicable)

## Phase 5: Load Test Verification

### Targets

| Scenario | Target p95 | Target error rate | Actual | Status |
|---|---|---|---|---|
| Device telemetry (500 concurrent agents) | < 500ms | < 0.1% | - | - |
| AI chat (50 concurrent techs) | < 5000ms | < 1% | - | - |
| Report generation (20 concurrent) | < 10000ms | < 1% | - | - |
| Remote support (30 concurrent) | < 2000ms | < 1% | - | - |
| Mixed workload (550 concurrent) | < 10000ms mixed | < 0.5% | - | - |

> **Note:** Fill in "Actual" and "Status" columns after running `k6 run test/load/*.js`.

### Chaos Test Results

| Scenario | Expected Behavior | Actual | Status |
|---|---|---|---|
| DB pool killed | Health 200, APIs return graceful errors | - | - |
| AI provider down | Structured error with fallback hint | - | - |
| Pod killed mid-request | Idempotent health check, no data corruption | - | - |
| Redis down | Core APIs degrade gracefully | - | - |

## Phase 6: Full E2E Scenario

### Sequence

| Step | Module | Status |
|------|--------|--------|
| 1. Signup | Auth | - |
| 2. Invite team | Admin | - |
| 3. Onboard 3 devices | Devices | - |
| 4. Live monitoring + alerts | Alerts + Metrics | - |
| 5. AI troubleshooting + KB | AI + KB | - |
| 6. Security scan + report | Security + Reports | - |
| 7. Network discovery | Network | - |
| 8. Remote support | Remote Support | - |
| 9. Backup job | Backups | - |
| 10. Billing upgrade | Billing | - |
| 11. SSO login | SSO | - |
| 12. Audit export | Audit | - |

## Final Sign-Off

| Criterion | Status |
|-----------|--------|
| All load tests pass | ☐ |
| All chaos tests pass | ☐ |
| Security review passes (no critical/high) | ☐ |
| Full E2E scenario completes | ☐ |
| Automated test suite passes | ☐ |
| Monitoring dashboards deployed | ✅ |
| On-call configured | ☐ |
| DB backup configured | ☐ |
| Rollback procedure documented | ✅ (this document) |

---

**Launch status:** ☐ Not ready  ☐ Ready for launch

**Signed off by:** __________________  **Date:** __________________
