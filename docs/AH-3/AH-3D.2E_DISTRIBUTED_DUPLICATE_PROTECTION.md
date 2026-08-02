Existing shared infrastructure found:
- ioredis is present as a dependency and the health readiness check attempts to contact Redis using REDIS_URL. No centralized Redis client / lock helper / Redlock implementation existed in application code prior to this change.

Lock Implementation:
- Implemented a Redis-backed SET NX PX lock (atomic) using ioredis.
- Lock operations are performed with atomic SET key value NX PX ttl and ownership-safe release via an evaluated Lua script that deletes the key only when the stored value matches the ownership token.
- A minimal RedisDistributedLock implementation was added in the reporting executor module to avoid introducing a new shared module without further integration work.

Lock Key:
- Deterministic per-occurrence key (string):
  report-schedule:<scheduleId>:<originalNextRunAt>
- originalNextRunAt is the schedule.nextRunAt (or fallback tick) expressed with toISOString(), ensuring distinct keys for distinct scheduled occurrences and avoiding stale long-lived keys blocking future occurrences.

Ownership Token:
- Each successful acquire stores a small unique token string as the value. The token is generated as a combination of current timestamp and random characters.
- The release Lua script checks that the stored token matches the expected token before deleting the key.
- Tokens are never logged.

Lock TTL:
- Configurable via environment: REPORT_SCHEDULE_LOCK_TTL_MS (milliseconds).
- Default: 5 minutes (300000 ms).
- The TTL bounds how long an orphaned lock might block a future occurrence. If report generation may exceed the TTL, increase the environment value accordingly. Tests validate the TTL parameter is passed to the lock.

Operation Order:
- Acquire occurrence lock (distributed) using the deterministic key.
- If lock infra unavailable (acquire throws), fail closed: skip claiming and generation and log a safe error.
- If lock not acquired (returned null), skip generation (another instance owns it) and log debug.
- If lock acquired, perform the existing database compare-and-set claim (updateMany with original nextRunAt).
- If claim fails after lock acquisition (race), release the lock and skip.
- If claim succeeds, perform report generation, update lastRunAt on success, then release the lock in finally.

Database Claim Coordination:
- The existing compare-and-set (updateMany) behavior is preserved and remains the authoritative DB-level claim.
- The distributed lock is acquired BEFORE the DB claim to avoid the risk of advancing nextRunAt and then failing to generate because of lock infra or contention.
- The combined behavior ensures that only the instance holding both the lock and the DB claim performs generation.

Fail-safe Behavior (infrastructure temporarily unavailable):
- If lock acquisition throws (e.g., Redis unreachable), the executor logs an error and skips claiming/execution for that occurrence (fail closed). This prevents lost occurrences where nextRunAt would be advanced but generation did not happen.
- The executor continues processing other schedules and does not crash the process.

Multi-instance Protection:
- Atomic Redis SET NX PX ensures only one instance can acquire the occurrence lock.
- Ownership-safe release ensures one instance cannot delete a lock owned by another.
- DB compare-and-set prevents claim races at the database level.

Release Safety:
- Release attempted in a finally block on all outcomes (success, partial success, full failure, unexpected exception).
- If the release indicates ownership mismatch, a debug log notes the situation; the lock will expire after TTL.

Files Changed:
- apps/api-gateway/src/reporting/report-schedule-executor.service.ts
  - Added RedisDistributedLock implementation and DistributedLock interface.
  - Integrated lock acquisition/release into processDueSchedule with the order: acquire lock -> claim -> generate -> release.
- apps/api-gateway/src/reporting/report-schedule-executor.service.spec.ts
  - Tests updated to inject a mocked distributed lock and new tests added for lock acquisition, contention, infrastructure failure, TTL behavior, and release safety.
- docs/AH-3/AH-3D.2E_DISTRIBUTED_DUPLICATE_PROTECTION.md (this document)

Tests:
- Extended ReportScheduleExecutorService unit tests to cover:
  1. Lock acquired path: acquire -> claim -> generate -> release.
  2. Lock already owned: acquire returns null -> skip, no claim, no generate.
  3. Two-instance simulation: only one instance acquires and generates.
  4. Lock infrastructure error: acquire throws -> no claim, no generate, safe log.
  5. Generation throws: lock still released in finally.
  6. TTL configured: REPORT_SCHEDULE_LOCK_TTL_MS is passed to acquire.
- Tests use an injected mock DistributedLock; no real Redis is required for unit tests.

Prisma Validation:
- No Prisma schema changes were made.
- Existing updateMany/compare-and-set behavior preserved.

Typecheck:
- Type definitions for the new DistributedLock interface and the RedisDistributedLock implementation have been added to the executor source file. The code compiles under the project's TypeScript settings in local validation.

Build:
- No build system changes required besides the updated source files. ioredis is already a dependency in the project.

Runtime Validation:
- Full runtime validation is deferred until AH-3D.3 (Scheduling UI and environment validation) per project policy.
- The implementation tries to avoid eager Redis connections; the Redis client is lazily connected on first lock acquire.

Remaining Limitation:
- The RedisDistributedLock requires a reachable Redis instance at runtime. If REDIS_URL is not configured or Redis is unreachable, scheduled occurrences will be skipped for safety. This avoids lost occurrences but may reduce availability of scheduled generation.
- The default TTL (5 minutes) may be too short for very large reports; increase REPORT_SCHEDULE_LOCK_TTL_MS if needed.

Remaining Work:
- Optionally extract the RedisDistributedLock into a shared application-level service for reuse by other modules (e.g., worker queues), and add centralized connection management and graceful shutdown hooks.
- Operational validation in staging with a Redis instance and realistic generation durations.
- Consider integrating a more full-featured lock library if advanced features (reentrancy, lock renewal) are required.

Final Decision:
- Use Redis-based SET NX PX locks (ioredis) for distributed duplicate protection.
- Acquire the occurrence lock before performing the DB claim to avoid lost occurrences on lock infra failures.
- Preserve existing DB compare-and-set claim semantics and update lastRunAt behavior.
- Fail closed when lock infrastructure is unavailable.
