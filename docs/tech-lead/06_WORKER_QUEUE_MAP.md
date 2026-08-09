# 06 — Worker / Queue Map

Status: 2026-08-09. Worker = BullMQ (Redis), 8 Workers concurrency 5, lock 30 s / stalled 15 s, health server `:9465`, metrics `:9464`, `_correlation` envelope on jobs. Producers live in the gateway (`src/queue/queue.service.ts`).

## 1. Queue Matrix

| Queue | Producer(s) | Consumer/Processor | Purpose | Retry/failure | Idempotency | Observability | Test status | Production readiness |
|-------|-------------|--------------------|---------|----------------|-------------|---------------|-------------|----------------------|
| `MONITORING` | `presence-sweep-scheduler.service.ts` (`@Cron(EVERY_MINUTE)` + Redis lock 55 s) | `processMonitoringJob` (`monitoring-sweep.ts`) | presence sweep: evaluate presence rules per device, create/refresh/resolve OFFLINE alerts (`activeKey` dedup), auto-resolve cleared metric alerts, fan-out `alert.notification` → ALERT queue | BullMQ retry | `activeKey` unique + legacy NULL-promotion | queue-depth metrics | ✅ `monitoring-sweep.spec.ts`, `monitoring-processor.spec.ts` | CERTIFIED |
| `ALERT` | `devices.service.ts:366` (metric alerts) + monitoring sweep fan-out | `processAlertJob` (`processors.ts:43`) | webhook POST `rule.webhookUrl` (10 s timeout) + email log | BullMQ retry | one enqueue per alert event | queue metrics | ✅ `processors.spec.ts` | FUNCTIONAL |
| `BACKUP` | `backups.service.ts:152,206,253` | `processBackupJob` (`backup-runner.ts` allowlist of 8 scripts) | execute backup, verify, restore (file / restore-postgres), apply retention | 300 s exec timeout | sha256 checksums | queue metrics | ✅ | FUNCTIONAL |
| `INVENTORY` | `inventory.controller.ts:67` | `processInventoryJob` | ingest inventory report (upsert + version compare) | BullMQ retry | payload hash dedup | queue metrics | ✅ | FUNCTIONAL |
| `SECURITY` | `security.service.ts:236,246` | `processSecurityJob` | complete pending scan, findings + score + critical/high alert + webhook | BullMQ retry | scanId dedup (`SecurityScore.scanId` unique) | queue metrics | ✅ | FUNCTIONAL |
| `RETENTION` | `retention.controller.ts:36,52` | `processRetentionJob` | purge metrics/health/recordings/audit/security/backups per policy, BATCH_SIZE 1000 | BullMQ retry | batched deletes + audit `retention_enforced` | queue metrics | ✅ | FUNCTIONAL |
| `KB_EMBEDDING` | `kb.service.ts:97,174,191` | `processKbEmbeddingJob` (`embedViaApi`) | embed article chunks (1536-dim) | BullMQ retry | — | queue metrics | ✅ | **BROKEN** (see §3) |
| `REPORT` | **NONE — producer MISSING** (`addReportGeneration` has zero call sites) | `processReportJob` → `POST ${TF_API_URL}/reports` | async report generation (delegates back to gateway) | BullMQ retry | — | queue metrics | ✅ (code-level) | **BROKEN** (see §3) |

## 2. Presence / Monitoring Detail

- Scheduler: gateway `@Cron(EVERY_MINUTE)` + `RedisDistributedLock` (SET NX PX 55000, Lua compare-and-delete release) → enqueue `MONITORING`/`presence_sweep`.
- Sweep: loads enabled `kind='presence'` rules, evaluates `derivePresenceState(lastSeenAt)` per device, creates/reopens OFFLINE alert keyed `activeKey=ruleId:deviceId` only when device crosses the **15-minute** boundary; refreshes `metricValue=minutesOffline`; auto-resolves on recovery; auto-resolves cleared metric alerts; reconciles legacy NULL `activeKey` duplicates.
- Thresholds mirrored in web + worker (`05/00/07`): ONLINE ≤5 min, DEGRADED 5-15 min, OFFLINE >15 min.
- No WebSocket presence push — UI polls `/devices` (15 s) + `/dashboard/summary` (15 s); WS `/metrics` carries only alert events.

## 3. Broken / Orphaned Paths (evidence-based)

1. **REPORT queue — no producer + dead route.** No gateway call site for `addReportGeneration`; the worker processor POSTs to `/reports` which the gateway does not expose (only `POST /reports/generate`). Even a future producer would 404.
2. **KB_EMBEDDING — dead route + silent mock fallback.** `embedViaApi` POSTs to `/ai/embed`, which does not exist (`ai-router.controller.ts` exposes only providers-status/router-stats/router-strategy). The 404 is swallowed and replaced by a deterministic sine-hash vector — KB jobs "succeed" but store meaningless embeddings. AI KB citations are therefore not real embeddings in production.
3. **Constant drift.** `REINDEX` job name missing from the worker's constants file (no runtime impact — routing is by queue name); queue names duplicated across `queue.constants.ts` (gateway) and worker `queue-names.ts` — sync risk.

## 4. Idempotency & Failure Handling Summary

- Alert dedup via `Alert.activeKey` unique + refresh-on-open semantics.
- Backup verify/restore gated by allowlist + checksum; retention batched with audit trail.
- Security findings idempotent by scanId; inventory by payload hash.
- BullMQ default retries with `_correlation` envelope for traceability; no DLQ/alerting on repeated failure observed.
