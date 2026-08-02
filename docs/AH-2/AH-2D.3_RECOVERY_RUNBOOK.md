# AH-2D.3 — Recovery Runbook

## Quick Reference

| Scenario | Script | Time |
|----------|--------|------|
| Full backup | `scripts/backup/backup-all.sh` | ~5s |
| PostgreSQL backup | `scripts/backup/backup-postgres.sh` | ~1s |
| PostgreSQL restore | `scripts/backup/restore-postgres.sh` | ~5s |
| Redis backup | `scripts/backup/backup-redis.sh` | ~3s |
| File backup | `scripts/backup/backup-files.sh` | ~1s |
| Config backup | `scripts/backup/backup-config.sh` | ~1s |
| Verify backups | `scripts/backup/verify-backup.sh` | ~2s |
| Apply retention | `scripts/backup/apply-retention.sh` | ~1s |
| DR test | `scripts/backup/disaster-recovery-test.sh` | ~30s |

---

## Scenario 1: PostgreSQL Complete Loss

### Impact
Complete loss of all platform data: users, organizations, devices, metrics, alerts, reports, security scans, AI conversations, billing, inventory.

### Recovery Steps

**1. Stop dependent services**
```bash
docker stop techfusion-api-gateway techfusion-worker
```

**2. List available backups**
```bash
ls -la backups/postgres/*.dump
```

**3. Verify backup integrity**
```bash
sha256sum -c backups/postgres/<backup_file>.sha256
pg_restore --list backups/postgres/<backup_file>
```

**4. Restore database**
```bash
# Option A: Via Docker exec (recommended)
docker cp backups/postgres/<backup_file>.dump techfusion-postgres:/tmp/restore.dump
docker exec techfusion-postgres pg_restore -U techfusion -d techfusion --no-owner /tmp/restore.dump

# Option B: Via script
scripts/backup/restore-postgres.sh backups/postgres/<backup_file>.dump
```

**5. Verify restore**
```bash
# Check table count
docker exec techfusion-postgres psql -U techfusion -d techfusion -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Check Prisma migrations
docker exec techfusion-postgres psql -U techfusion -d techfusion -c \
  "SELECT count(*) FROM _prisma_migrations;"

# Check tenant isolation
docker exec techfusion-postgres psql -U techfusion -d techfusion -c \
  "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';"
```

**6. Restart services**
```bash
docker start techfusion-api-gateway techfusion-worker
```

**7. Validate platform**
```bash
curl -s http://localhost:3001/health/ready
curl -s http://localhost:9465/health/ready
```

### Expected Results
- 35 tables restored
- 9 Prisma migrations intact
- 32 RLS policies active
- 29 tenant isolation columns
- All services healthy

---

## Scenario 2: Redis Complete Loss

### Impact
Loss of all BullMQ queues (alert, report, backup, inventory, security, retention, default).

### Recovery Steps

**1. Redis auto-recovers via RDB**
```bash
docker restart techfusion-redis
```

**2. Verify Redis health**
```bash
docker exec techfusion-redis redis-cli ping
# Expected: PONG

docker exec techfusion-redis redis-cli DBSIZE
# Expected: ~23 keys (queue metadata)
```

**3. Restart worker**
```bash
docker restart techfusion-worker
```

**4. Verify queues recover**
```bash
docker exec techfusion-redis redis-cli KEYS "bull:*" | wc -l
```

### Expected Results
- Redis reconnects in <1 second
- Queue metadata restored from RDB
- Worker resumes processing
- Failed jobs retry per configured policy

---

## Scenario 3: Worker Process Loss

### Impact
Queue processing stops. Jobs accumulate in Redis.

### Recovery Steps

**1. Worker auto-restarts (unless-stopped policy)**
```bash
docker restart techfusion-worker
```

**2. Verify worker health**
```bash
curl -s http://localhost:9465/health/ready
```

**3. Check queue processing resumes**
```bash
curl -s http://localhost:9465/metrics | grep bullmq
```

### Expected Results
- Worker reconnects to Redis in <5 seconds
- Waiting jobs resume processing
- Active jobs retry on failure

---

## Scenario 4: API Gateway Loss

### Impact
All API endpoints unavailable. Frontend loses backend connection.

### Recovery Steps

**1. API auto-restarts (unless-stopped policy)**
```bash
docker restart techfusion-api-gateway
```

**2. Verify API health**
```bash
curl -s http://localhost:3001/health/live
curl -s http://localhost:3001/health/ready
```

**3. Verify database connectivity**
```bash
curl -s http://localhost:3001/health/ready | jq .details.postgres
```

**4. Verify Redis connectivity**
```bash
curl -s http://localhost:3001/health/ready | jq .details.redis
```

### Expected Results
- API restarts in <10 seconds
- Database connection re-established
- Redis connection re-established
- All endpoints functional

---

## Scenario 5: Frontend Loss

### Impact
Web UI unavailable. API still functional.

### Recovery Steps

**1. Frontend auto-restarts**
```bash
docker restart techfusion-web
```

**2. Verify frontend**
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
```

### Expected Results
- Frontend restarts in <5 seconds
- Static assets served correctly
- API connection restored

---

## Scenario 6: Report Storage Loss

### Impact
Loss of generated reports. Reports can be regenerated.

### Recovery Steps

**1. Stop report generation**
```bash
docker stop techfusion-worker
```

**2. List available file backups**
```bash
ls -la backups/files/*.tar.gz
```

**3. Verify backup**
```bash
sha256sum -c backups/files/<backup>.tar.gz.sha256
tar -tzf backups/files/<backup>.tar.gz
```

**4. Restore files**
```bash
tar -xzf backups/files/<backup>.tar.gz -C apps/api-gateway/
```

**5. Restart services**
```bash
docker start techfusion-worker
```

### Expected Results
- Report files restored
- Report access functional
- New reports can be generated

---

## Scenario 7: Configuration Corruption

### Impact
Services may fail to start or behave incorrectly.

### Recovery Steps

**1. Stop all services**
```bash
docker stop techfusion-web techfusion-api-gateway techfusion-worker
```

**2. List available config backups**
```bash
ls -la backups/config/*.tar.gz
```

**3. Verify backup**
```bash
sha256sum -c backups/config/<backup>.tar.gz.sha256
tar -tzf backups/config/<backup>.tar.gz | head -20
```

**4. Restore configuration**
```bash
tar -xzf backups/config/<backup>.tar.gz -C /tmp/config-restore/

# Restore specific components
cp /tmp/config-restore/docker/docker-compose.yml infra/docker/
cp /tmp/config-restore/prometheus/*.yml infra/observability/prometheus/
cp -r /tmp/config-restore/grafana/* infra/observability/grafana/
cp /tmp/config-restore/prisma/schema.prisma apps/api-gateway/prisma/
cp -r /tmp/config-restore/prisma/migrations apps/api-gateway/prisma/
```

**5. Regenerate secrets** (CRITICAL)
```bash
# Generate new JWT secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
AI_ENCRYPTION_KEY=$(openssl rand -hex 32)
REPORT_URL_SECRET=$(openssl rand -hex 32)

# Update .env file with new secrets
# DO NOT copy .env from backup — secrets must be regenerated
```

**6. Restart services**
```bash
docker start techfusion-redis techfusion-postgres
sleep 5
docker start techfusion-api-gateway techfusion-worker techfusion-web
```

**7. Run Prisma migrations** (if schema was restored)
```bash
docker exec techfusion-api-gateway npx prisma migrate deploy
```

### Expected Results
- All configurations restored
- Secrets regenerated
- Services start successfully
- Platform functional

---

## Scenario 8: Full Stack Loss

### Impact
Complete infrastructure failure. All services and data lost.

### Recovery Steps

**1. Rebuild infrastructure**
```bash
# Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
sleep 10

# Restore PostgreSQL
scripts/backup/restore-postgres.sh backups/postgres/<latest>.dump

# Restore Redis (if backup exists)
docker cp backups/redis/<latest>.rdb techfusion-redis:/data/dump.rdb
docker restart techfusion-redis

# Restore configuration
tar -xzf backups/config/<latest>.tar.gz -C /tmp/config-restore/
# Apply config restores as in Scenario 7

# Start services
docker compose -f infra/docker/docker-compose.yml up -d
```

**2. Validate all components**
```bash
# Health checks
curl -s http://localhost:3001/health/ready
curl -s http://localhost:9465/health/ready
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Database check
docker exec techfusion-postgres psql -U techfusion -d techfusion -c "SELECT 1;"

# Redis check
docker exec techfusion-redis redis-cli ping

# Metrics check
curl -s http://localhost:3001/metrics | head -5
```

---

## Backup Operations

### Running a Full Backup

```bash
scripts/backup/backup-all.sh
```

### Running Specific Backups

```bash
# PostgreSQL only
scripts/backup/backup-postgres.sh

# Redis only
scripts/backup/backup-redis.sh

# Files only
scripts/backup/backup-files.sh

# Config only
scripts/backup/backup-config.sh
```

### Verifying Backups

```bash
# Verify all
scripts/backup/verify-backup.sh

# Verify specific type
scripts/backup/verify-backup.sh --type postgres
scripts/backup/verify-backup.sh --type redis
scripts/backup/verify-backup.sh --type files
scripts/backup/verify-backup.sh --type config
```

### Applying Retention Policy

```bash
# Preview what would be deleted
scripts/backup/apply-retention.sh --dry-run

# Apply retention
scripts/backup/apply-retention.sh
```

### Running Disaster Recovery Tests

```bash
# Full test suite
scripts/backup/disaster-recovery-test.sh --scenario full

# Specific scenario
scripts/backup/disaster-recovery-test.sh --scenario db-loss
scripts/backup/disaster-recovery-test.sh --scenario redis-loss
scripts/backup/disaster-recovery-test.sh --scenario config-loss
scripts/backup/disaster-recovery-test.sh --scenario file-loss
```

---

## Backup Directory Structure

```
backups/
├── postgres/
│   ├── techfusion_20260718T154616Z.dump
│   ├── techfusion_20260718T154616Z.dump.sha256
│   └── manifest.json
├── redis/
│   ├── dump_20260718T154622Z.rdb
│   └── dump_20260718T154622Z.rdb.sha256
├── files/
│   ├── report-storage-api_20260718T154623Z.tar.gz
│   └── report-storage-api_20260718T154623Z.tar.gz.sha256
├── config/
│   ├── config_20260718T154624Z.tar.gz
│   └── config_20260718T154624Z.tar.gz.sha256
└── backup_20260718T154600Z.log
```

---

## Cron Schedule (Recommended for Production)

```cron
# Full backup daily at 2:00 AM
0 2 * * * /opt/techfusion/scripts/backup/backup-all.sh >> /var/log/techfusion-backup.log 2>&1

# Retention enforcement daily at 4:00 AM
0 4 * * * /opt/techfusion/scripts/backup/apply-retention.sh >> /var/log/techfusion-retention.log 2>&1

# Backup verification daily at 5:00 AM
0 5 * * * /opt/techfusion/scripts/backup/verify-backup.sh >> /var/log/techfusion-verify.log 2>&1
```

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Platform Admin | [Fill in] |
| Database Admin | [Fill in] |
| Infrastructure | [Fill in] |
| Security | [Fill in] |

---

## Notes

- All backup scripts use SHA-256 checksums for integrity verification
- PostgreSQL backups use pg_dump custom format (compressed, section-labeled)
- Configuration backups NEVER include real secrets (only .env.example templates)
- Restore operations create a fresh database (drop + create + restore)
- Redis restart recovery relies on RDB snapshots (default: 3600s interval)
- For production: enable WAL archiving, implement off-site backups, add encryption
