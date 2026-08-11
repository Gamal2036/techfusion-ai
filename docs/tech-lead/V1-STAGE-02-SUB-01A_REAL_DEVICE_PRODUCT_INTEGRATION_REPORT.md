# V1-STAGE-02-SUB-01A — Real Device Product Integration Certification Report

> Audit/certification of the real integration boundary between Linux Agent, Device
> Identity, Presence/Telemetry, Dashboard, Cybersecurity, and Network.
> Date: 2026-08-11. Built on the SUB-01 certified baseline (enrollment/token/
> device-link reliability, presence truthfulness). This stage fixed only
> integration-boundary defects; it did NOT redesign Cybersecurity or Network.
> Evidence markers follow `docs/tech-lead/README.md` conventions.

## 1. Status

**MANUAL CERTIFICATION: PASS — CYBER-01 CLOSED.** All automated gates pass (V1
gate 19/19), five proven integration defects/root causes are fixed, and the real
Linux-agent ↔ API ↔ Web integration is now certified on a real Ubuntu host
(operator evidence, §9.1). **CYBER-01 (Cybersecurity real-device reliability)
is CLOSED for V1**; Cybersecurity is preserved as the V1 stable baseline, and
future Cybersecurity capabilities remain extensible under the Module
Extensibility Contract (`15`). The Cybersecurity + device/dashboard portion of
the SUB-01A manual gate is COMPLETE. Network real-device evidence is deferred to
the next stage: `NET-00 — Network Evidence & Current-State Audit`.

> **MANUAL CERTIFICATION RESULT — FAILED (annotation, 2026-08-11).** The real
> Ubuntu-host manual gate (§9) exposed a Cybersecurity runtime failure: opening
> the Cybersecurity page shows `GET /security/pending/:deviceId → 401` with
> `DeviceTokenGuard rejected: authHeader present=false`, and the Cybersecurity
> UI remains in a loading/"Scan in progress" state with no truthful terminal
> transition. The device path itself was operational in the same run
> (enrollment OK, persistent credential stored, `techfusion-agent.service`
> running, `POST /devices/metrics → 201`, `GET /devices → 200`). Root cause
> analysis and minimal fix plan are recorded in the stage diagnosis
> (`V1-STAGE-02-SUB-01A_MANUAL_CYBER_DIAG`): the deployed agent binary predates
> the `Authorization: Bearer` header on on-demand agent endpoints (added in
> `942ed1f`; present at `apps/agent/src/client.rs:484`), so the agent's pending
> security-scan poll is rejected before reaching the pending-scan state, and
> `apps/web/src/hooks/useSecurity.ts` polling has no terminal/backstop when a
> scan never completes or fails. Stage remains **NOT COMPLETE** pending the fix
> and a successful manual retest.

> **CYBER-01 FIX — IMPLEMENTED, AUTOMATED EVIDENCE GREEN (annotation, 2026-08-11).**
> The two confirmed root causes are fixed and covered by focused regression tests
> (see §7 Fixes CYB-1/CYB-2 and §8): the Web Cybersecurity flow now has a
> complete terminal-state machine (`useSecurity.ts`), and `GET
> /security/latest/:deviceId` exposes failed terminal scans backward-compatibly.
> The agent source already carried the Bearer credential on the pending-security
> request; an agent regression test now proves it, and the **deployed binary on
> the real host is still stale**. Stage remains **NOT COMPLETE** — the real-device
> manual gate (§9) must be re-run with a REBUILT/REINSTALLED agent before the
> stage may be marked COMPLETE.

> **MANUAL CERTIFICATION — PASS (annotation, 2026-08-11).** The real Ubuntu-host
> manual gate (§9.1) returned **PASS** for Cybersecurity: the agent was REBUILT
> from current repository source and REINSTALLED (`/usr/local/bin/techfusion-agent`);
> the persistent device identity/credential was preserved (no re-enrollment); the
> agent service operates normally; the Dashboard recognizes the real enrolled
> device; the Cybersecurity page is stable; the real-device Cybersecurity scan
> flow completes successfully. The previous permanent-loading/timeout behavior is
> resolved — root cause was the STALE deployed binary (which predated the Bearer
> header on the pending-security request), now eliminated by the rebuild.
> **CYBER-01 is CLOSED for V1**; Cybersecurity remains the V1 stable baseline.

## 2. Integration Map (traced in code, `VERIFIED_THIS_RUN`)

### A. Agent telemetry/presence → Dashboard

| Segment | Implementation | Evidence |
|---|---|---|
| SOURCE | `MetricsCollector::collect()` real system metrics | `apps/agent/src/collector.rs`, invoked `agent.rs:183` |
| AUTH | Bearer device credential (persistent, server-issued) | `apps/agent/src/client.rs:289-357` (`send_metrics`) |
| DEVICE IDENTITY | Token → `Device.deviceTokenHash` (SHA-256, hash-only) → `Device` row | `apps/api-gateway/src/devices/device-token.guard.ts:11-71` |
| ORG IDENTITY | Derived from the verified `Device` row (`req.orgId = device.orgId`); never from body | `device-token.guard.ts:61-62`; `devices.controller.ts:118-152` |
| DATA SOURCE | Agent-generated metrics only; no demo/mock data anywhere on the path | web audit: 0 hardcoded device values in `dashboard/**`, `device-health/**` |
| PERSISTENCE | `DeviceMetric` + `Device.lastSeenAt` written ONLY by `ingestMetrics` | `devices.service.ts:288-392` (`lastSeenAt` at 325-328) |
| API | `POST /devices/metrics` (DeviceTokenGuard); `GET /devices`, `GET /devices/:id/latest`, `GET /dashboard/summary` (JWT) | `devices.controller.ts`, `dashboard.service.ts:22-253` |
| WEB CONSUMER | `useDevices`, `useDashboardSummary`, `/metrics` WS; presence re-derived client-side from `lastSeenAt` | `apps/web/src/hooks/useDevices.ts`, `device-presence-state.ts:29-42` |
| STATUS | CERTIFIED: same Device on reconnect, UNKNOWN for null lastSeenAt, 5/15-min bands, no fabricated values | E1-E8 + P1-P4 suites (SUB-01), re-verified green this run |

### B. Cybersecurity

| Segment | Implementation | Evidence |
|---|---|---|
| SOURCE | 5 real host checks: updates (`apt list --upgradable`), firewall (`ufw`/`iptables`), open ports (`ss -tlnp`), weak config (`sshd_config`), password policy (`login.defs`) | `apps/agent/src/security.rs:36-376` |
| AUTH (agent push) | Persistent device credential in JSON body `deviceToken` → hash lookup; **now fail-closed 401 on invalid (defect SEC-1 fixed)** | `security.controller.ts:29-50`; `devices.service.ts:266-271` |
| AUTH (agent on-demand) | Bearer credential → `DeviceTokenGuard`; path `deviceId` cross-checked against token device | `security.controller.ts:62-135` |
| DEVICE IDENTITY | Push: server-derived from token row. On-demand: `req.device.id` (+param cross-check). Web: JWT org + URL deviceId re-scoped in service | `security.service.ts:27-367` |
| ORG IDENTITY | Always auth-derived (`req.device.orgId` / `req.user.orgId`); no endpoint accepts org/device from body | all security routes |
| DATA SOURCE | Real scan/finding rows only; web page audit → zero mock/demo/placeholder values | `apps/web/src/app/dashboard/cybersecurity/`, `useSecurity.ts` |
| PERSISTENCE | `SecurityScan`/`SecurityFinding`/`SecurityScore` stamped orgId+deviceId from the verified device/scan row | `security.service.ts:32-74, 175-257` |
| API | Push `/devices/security-report`; on-demand `/security/pending/:deviceId`, `/security/scan-result`; web `/security/latest|scans|executive-summary|export-pdf/:deviceId`, `/trigger`, `/remediate` | `security.controller.ts` |
| WEB CONSUMER | Device dropdown (org-scoped `GET /devices`) → device-specific, org-scoped server-side queries; honest empty states ("No scan data available") | `page.tsx:254-290` |
| STATUS | REAL_AGENT_DATA; org/device never client-authoritative; cross-tenant detail reads fail 404; route ordering verified correct (no shadowing) | isolation suites green |

### C. Network

| Segment | Implementation | Evidence |
|---|---|---|
| SOURCE | ARP (`/proc/net/arp`) + ICMP ping sweep (private /24-/25 only) | `apps/agent/src/network_discovery.rs:179-725` |
| AUTH | Bearer credential → `DeviceTokenGuard` on all agent routes | `network.controller.ts:37-146` |
| DEVICE IDENTITY | Agent routes: `req.device`. Web trigger: body `deviceId` validated to exist in org, then stored on scan. `NetworkDevice` rows are org-scoped (no deviceId column — org-wide pool by design) | `network.controller.ts:23-35`, `network.service.ts:77-227` |
| ORG IDENTITY | Auth-derived everywhere; legacy `x-org-id`/`body.orgId` rejected on mismatch | `network.controller.ts:119-146` |
| DATA SOURCE | Real ARP/ICMP discovery; diagnostics run from the API-gateway host (not the agent) — documented product gap (§10) | `network.service.ts:311-438` |
| PERSISTENCE | `NetworkDevice` upserted on `(orgId, ip)`; `NetworkScan` org-scoped (+optional deviceId); diagnostics not persisted | `network.service.ts:173-252` |
| API | 14 routes; agent routes DeviceTokenGuard, web routes JWT+RBAC, all org-scoped; `/network` WS room per org | `network.controller.ts`, `network.gateway.ts` |
| WEB CONSUMER | Org-wide surface (no deviceId sent); real API data only; empty states "No topology data available."/"No scans recorded yet" | `page.tsx`, `useNetwork.ts` |
| STATUS | REAL_AGENT_DATA for discovery; two defects fixed (NET-1 dead endpoint fetch, NET-2 unknown-MAC sentinel rendered as real) | full web+api suites green |

## 3. Data Authority (verified)

- **Telemetry:** agent Bearer credential → hash-only lookup → `req.device`/`req.orgId` → server writes `lastSeenAt` and metrics. Client payload is telemetry-only (DTO has no deviceId/orgId members; whitelist strips unknowns). SUB-04 certified.
- **Cybersecurity:** org/device never accepted from request bodies. Push path resolves the device from the credential; on-demand path validates the path `deviceId` against the token's device; web path re-scopes every URL deviceId by JWT org. Worker re-verifies org from the DB row before any write.
- **Network:** org always auth-derived. Web trigger `deviceId` is the only client-supplied identity and is existence-checked in-org. Agent claim/status/result endpoints gate on scan ownership within the token's org+device.
- **Cross-tenant:** `cross-tenant-isolation.spec.ts` (20) + `tenant-isolation-security.spec.ts` prove read/write isolation for security (incl. `scans/detail` 404) and network (`/network/scans/latest` empty, discovery trigger 404).

## 4. Truthfulness Certification (Phase 2)

Surfaced-value classification per path:

| Surface | Classification | Notes |
|---|---|---|
| Dashboard device list / presence / metrics / scores | REAL_AGENT_DATA / SERVER_DERIVED | No hardcoded hostnames/metrics in production pages; `Math.random` only in landing 3D visuals |
| Dashboard score gauges for never-scored devices | CACHED_BUT_VALID with presentational ambiguity | `scores?.healthScore ?? 0` renders a "0/100" gauge; not fabricated, but a "no score yet" device shows 0 — documented as cosmetic gap (§10) |
| Cybersecurity findings/score/risk | REAL_AGENT_DATA | Risk level null → "Unknown" (honest). Color map defaults to `low` when null (cosmetic only). Gauge `?? 0` same ambiguity as dashboard |
| Cybersecurity empty state | PLACEHOLDER_EXPLICIT | "No scan data available" + explicit "Run First Scan" CTA |
| Network topology/devices/scans | REAL_AGENT_DATA | Discovery rows from agent ARP/ICMP only |
| Network diagnostics (latency/dns/traceroute/connectivity) | SERVER_DERIVED | Measured from API-gateway host, not the agent; documented |
| Network unknown MACs | **PLACEHOLDER_EXPLICIT — now rendered as UNKNOWN (NET-2 fixed)** | `00:00:00:00:00:00` sentinel was shown as a real MAC; now `-` |
| Network scan-completion polling | **Defect (NET-1) — dead endpoint removed** | `fetch('/api/network/scans')` queried a non-existent route; now uses real `GET /network/scans` data |
| Cybersecurity push path with invalid credential | **Defect (SEC-1) — fail-open fixed** | HTTP 200+error body previously let the agent believe an unpersisted report succeeded; now 401 (agent re-registers) |

**No FABRICATED value presented as real remains on any certified surface.** All
defects fixed were integration-boundary, not module-architecture.

## 5. Token / Credential Architecture (Phase 6)

| Actor | Token model | Status |
|---|---|---|
| Enrollment | One-time enrollment token (`tfenr_*`), consumed at `POST /devices/register-public`, single-use/expiry/revocation, never persisted on disk, never reused for security/network calls | SUB-01 certified |
| Agent (metrics, on-demand security, all network) | Persistent device credential, `Authorization: Bearer`, SHA-256 hash-only vs `Device.deviceTokenHash`, fail-closed 401 | Stage-01 D16/SUB-03 certified |
| Agent (push security report) | Same persistent device credential transported in JSON body `deviceToken` (hash-only lookup) — **not a separate token model**, but inconsistent transport vs `DeviceTokenGuard`; now fail-closed 401 on invalid | Defect SEC-1 fixed; transport inconsistency documented (§10) |
| Web user | JWT access/refresh (rotation, DB-backed revocation), membership-authoritative org | Stage-01 certified |
| Device/org authority | Server-derived from verified token/session everywhere; client-provided orgId/deviceId never authoritative | Certified |

Cybersecurity and Network do **not** depend on the enrollment token, a
UI-generated token, or a client-copied token. Neither module invents an ad-hoc
device token model.

## 6. Defects Discovered

| ID | Severity | Path | Description |
|----|----------|------|-------------|
| SEC-1 | High (fail-open) | Cybersecurity push | `POST /devices/security-report` returned HTTP **200** with `{error:'Invalid device token'}` for an unknown/revoked/rotated credential. Agent `send_security_report` treats 2xx as success (`client.rs:380-388`), so a device whose credential was rotated silently "succeeded" while persisting nothing — while the on-demand security path (DeviceTokenGuard) correctly returned 401 for the same credential. |
| NET-1 | Medium (dead endpoint) | Network page | `apps/web/src/app/dashboard/network/page.tsx:87` polled `fetch('/api/network/scans')` — a relative URL with no matching Next.js route. The request 404'd, the catch swallowed it, and scan-completion detection never fired; polling only stopped via the 65s timeout. |
| NET-2 | Low (truthfulness) | Network surface | Agent emits `00:00:00:00:00:00` as the MAC when ARP lookup fails (unknown), and the web devices table + topology tooltip rendered it as a real MAC. |
| CYB-1 | High (real-device reliability) | Cybersecurity web | `useSecurity.ts` polling had no terminal-state model: only `completed` stopped polling. A failed or stuck-pending scan left the UI permanently in "Scan in progress"/loading with no truthful terminal transition, and 401/403/unexpected failures never stopped polling (infinite loading). |
| CYB-2 | High (real-device reliability) | Cybersecurity API | `GET /security/latest/:deviceId` filtered to `status: 'completed'` only, so a failed terminal scan (written by `POST /security/scan-result` with `error`) was invisible to the Web polling loop — a failed scan could never be surfaced. |

Not defects (verified, intentionally not changed): `GET /security/scans/detail/:scanId`
is **not** shadowed by `GET /security/scans/:deviceId` (single-segment `:deviceId`
cannot match a 2-segment path; isolation tests confirm 404s); unassigned
(`deviceId: null`) discovery scans claimable by any org agent is an org-scoped
product behavior; server-host diagnostics are an existing design.

## 7. Fixes Performed

| ID | Change | Files |
|----|--------|-------|
| SEC-1 | Invalid/unknown credential on `POST /devices/security-report` now throws `UnauthorizedException` → 401 (fail-closed, consistent with `DeviceTokenGuard`; agent already handles 401 by re-registering). Valid flow unchanged (200 + scan result). | `src/security/security.controller.ts`; tests updated in `test/device-credential-hardening.spec.ts` (expect 401), `test/security.spec.ts` (tightened to 401), `src/security/security.integration.spec.ts` (expects `UnauthorizedException`) |
| NET-1 | Removed dead `fetch('/api/network/scans')`; scan-completion detection now uses real `GET /network/scans` data (`useNetworkScans`) via a latest-scans ref, so discovery polling stops when the triggered scan actually completes/fails. | `apps/web/src/app/dashboard/network/page.tsx` |
| NET-2 | All-zero unknown-MAC sentinel (`00:00:00:00:00:00`) rendered as `-`/omitted instead of a fake MAC. | `apps/web/src/app/dashboard/network/page.tsx`, `apps/web/src/components/NetworkMap.tsx` |
| CYB-1 | Cybersecurity Web polling given a complete terminal-state machine (`idle` / `triggering` / `running` / `completed` / `failed` / `timeout`) in `useSecurity.ts`: `completed` and `failed` stop polling on a scan that is new since the trigger; a client backstop times out a stuck pending scan after 120 s into an honest timeout/retry state; 401/403 and unexpected API failures stop polling and surface an honest error banner (never infinite loading). Empty successful results render truthfully ("No findings — clean posture"). Polling is reset on device change. | `apps/web/src/hooks/useSecurity.ts`, `apps/web/src/app/dashboard/cybersecurity/page.tsx`, new `apps/web/src/__tests__/use-security.spec.ts` (6 tests) |
| CYB-2 | `GET /security/latest/:deviceId` now returns the latest **terminal** scan (`status IN (completed, failed)`, ordered by `completedAt` desc) instead of completed-only, and exposes the scan `error` field — additive/backward-compatible (completed path unchanged; pending scans still return 404 while running). | `apps/api-gateway/src/security/security.service.ts`; tests in `src/security/security.integration.spec.ts` (+3) |
| CYB-3 | Agent regression test proving the pending-security request (`GET /security/pending/:deviceId`) carries `Authorization: Bearer <persistent-device-credential>`. Source was already correct (`apps/agent/src/client.rs:484`); the **deployed binary is stale** and must be rebuilt/reinstalled on the real host for the manual gate. | `apps/agent/src/client.rs` (test) |

`AGENT SOURCE CHANGE: TEST-ONLY` (source behavior was already correct at
`client.rs:484`; no token/enrollment model change). `MIGRATION: NONE` (schema
untouched; gate schema-sync + migration validation passed).

## 8. Automated Evidence (`VERIFIED_THIS_RUN`, local)

| Item | Result |
|------|--------|
| api-gateway full suite | **58 suites / 997 tests PASS** (includes +3 CYB-2 `getLatestScan` regression tests) |
| web full suite | 36 suites / 797 tests PASS (includes +6 CYB-1 `use-security.spec.ts` tests) |
| worker suite | 8 suites / 80 tests PASS (via gate) |
| agent in-source | 79 tests PASS (includes +1 CYB-3 Bearer-header regression test) |
| `pnpm lint` + `pnpm build` (api/web/worker) | PASS |
| `scripts/ci-v1-gate.sh` | **19/19 PASS** — incl. migration validation, worker schema sync, secret scan (**NO SECRETS DETECTED**) |
| Baseline suites re-verified | E1-E8 enrollment/device-link, P1-P4 presence-telemetry, Stage-01 security suites (66), cross-tenant isolation (20), tenant-isolation-security, `security.spec.ts`, `device-metrics-security.spec.ts`, `metrics-auth-security.spec.ts` — all PASS |

**CYBER-01 focused regression evidence (`VERIFIED_THIS_RUN`):**

| Requirement | Proved by |
|-------------|-----------|
| 1. Agent pending-security request carries Bearer credential | `apps/agent/src/client.rs` `test_pending_security_scans_send_bearer_header` (local TCP mock asserts `authorization: bearer <token>` + `GET /security/pending/<deviceId>`) |
| 2. `completed` terminates Web polling | `use-security.spec.ts` "stops polling when a triggered scan reaches completed" |
| 3. `failed` terminates Web polling | `use-security.spec.ts` "stops polling and reports failed when the scan fails" (asserts honest `failed` state + scan error) |
| 4. timeout/stuck pending terminates safely | `use-security.spec.ts` "times out and stops polling when a scan is stuck pending" (120 s backstop → `timeout`) |
| 5. 401/403 does not cause permanent loading | `use-security.spec.ts` "does not produce permanent loading on 401 during polling" (+ unexpected 500 case) |
| 6. successful real scan result remains compatible | `security.integration.spec.ts` completed scan with findings+score unchanged; `use-security.spec.ts` load-compat test; empty-successful scan returns `findings: []` + `totalFindings: 0` truthfully |
| 7. existing Cybersecurity security/isolation tests remain green | `security.spec.ts`, `tenant-isolation-security.spec.ts`, `device-metrics-security.spec.ts`, `metrics-auth-security.spec.ts`, `security.integration.spec.ts` — all PASS |

What automated tests **prove**: the Web flow deterministically reaches a
truthful terminal state for every required outcome (completed / failed /
timeout / auth-denied / unexpected failure), failed scans are exposed by the
API without breaking the completed-scan contract, and the agent's pending-security
request is authenticated with the persistent device credential.

What automated tests **cannot prove** (requires a real device + operator):
a **rebuilt** Linux agent binary on the real host performing the full
`Run First Scan → pending → execute → result → terminal` loop against the real
stack (the previously-deployed binary predates the Bearer header). See §9.

## 9. Manual Certification Required (operator)

Commands/actions needed for evidence that automation cannot produce. Start backend, Web, and agent; do NOT stop any system service:

0. **REBUILD/REINSTALL the agent on the real host first** (the installed binary
   predates the Bearer header on the pending-security request): rebuild from
   source (`cargo build --release` in `apps/agent`) or re-run the installer with
   `--binary`/release, restart `techfusion-agent.service`, and confirm
   `agent --identity-status` still shows the SAME `device_id` (persistent
   credential preserved; do NOT re-enroll).
1. `docker compose up -d postgres redis` (or `scripts/dev-up.sh` if present) then start API (`apps/api-gateway`, `pnpm dev`), worker (`apps/worker`, `pnpm dev`), Web (`apps/web`, `pnpm dev`).
2. Start the Linux agent: `TF_API_URL=http://localhost:3001 TF_ORG_TOKEN=<enrollment token from Web> ~/.techfusion/...` / `cargo run` in `apps/agent`. Confirm identity: `agent --identity-status` (device_id + token files exist, 0600).
3. Login to Dashboard, open Settings → Enrollment, issue an enrollment token.
4. Verify the SAME Device appears in Dashboard device-health list, and presence stays **UNKNOWN** until the first heartbeat.
5. Watch presence flip to **ONLINE** within ~1 min of agent activity (30s telemetry tick), and telemetry values update (CPU/RAM/disk).
6. Open **Cybersecurity**, select the device: confirm the displayed security data (updates/firewall/ports/weak config/password policy) is this exact machine's real scan and belongs to this Device. Run a scan from the page and confirm it completes — the UI must reach a truthful `completed` state and stop polling.
7. **CYBER-01 retest:** (a) open the Cybersecurity page and confirm `GET /security/pending/:deviceId` returns **200** (agent Bearer credential accepted — no more 401); (b) trigger a scan and confirm the UI leaves "Scan in progress" and reaches `completed`; (c) with the agent stopped, trigger a scan and confirm the UI reaches the honest `timeout`/retry state (no permanent loading); (d) a revoked/rotated agent credential must produce the agent's documented re-registration path (401 → re-register), never silent success.
8. Open **Network**: trigger discovery and confirm real subnet devices (with this machine as the "local/This Device" node), and that the data appears in Devices + Scan History.
9. `systemctl stop techfusion-agent` (or `kill` the agent): verify presence transitions (DEGRADED after 5 min, OFFLINE after 15 min — 15-min band is by design).
10. Restart the agent with the SAME stored `device_token`/`device_id`: verify reconnect uses the SAME Device with **no** new enrollment token, and presence returns to ONLINE.

Return: agent logs, `GET /devices` + `GET /dashboard/summary` responses, Cybersecurity page state for the exact Device, Network page state, and presence timestamps across stop/restart.

### 9.1 Manual Certification Result — PASS (operator, 2026-08-11)

> `MANUAL_CERTIFICATION: PASS`

Observed real behavior on the Ubuntu host (`VERIFIED_THIS_RUN` by operator):

| # | Evidence |
|---|----------|
| 1 | Linux Agent **rebuilt from current repository source** (includes the Bearer header on the pending-security request, `client.rs:484`). |
| 2 | Current binary installed as `/usr/local/bin/techfusion-agent`. |
| 3 | Existing persistent device identity/credential **preserved** (same `device_id`/`device_token`; no re-enrollment). |
| 4 | Agent service operates normally. |
| 5 | Dashboard recognizes the real enrolled device (device-health list, same Device). |
| 6 | Cybersecurity page is stable — opens without the previous 401/permanent-loading. |
| 7 | Real-device Cybersecurity scan flow works successfully — pending → execute → result → truthful terminal state (polling stops). |
| 8 | Previous permanent-loading / timeout behavior caused by the **stale deployed Agent binary** is resolved by the rebuild. |

**Closure reason:** root cause of the observed real-device failure was the
**stale deployed agent binary**, which predated the `Authorization: Bearer`
header on the on-demand pending-security request (added in `942ed1f`, present at
`apps/agent/src/client.rs:484`); the stale binary's pending-security poll was
rejected with `401` before reaching the pending-scan state, leaving the UI
permanently loading. The fix commits (`871b4a3` + `340a15e`) plus the
REBUILT/REINSTALLED agent satisfy the §9 CYBER-01 retest: the pending-security
request succeeds, the scan reaches a truthful terminal state, and no
permanent-loading/timeout is observed.

**Scope of this certification:** Cybersecurity (CYBER-01) and the
device/dashboard integration path (Dashboard recognizes the enrolled device,
persistent identity/credential preserved across the rebuild). Network real-device
evidence (manual §9 step 8) is deferred to the next stage: `NET-00 — Network
Evidence & Current-State Audit`.

## 10. Remaining Product Gaps (not defects, out of scope)

- **Cybersecurity push-path token transport inconsistency** (SEC-1 residual): `/devices/security-report` authenticates via body `deviceToken` instead of `Authorization: Bearer`/`DeviceTokenGuard`. Same credential model (hash-only, now fail-closed), but a future stage should align the agent to header auth for all device endpoints (breaking agent/API contract — deferred by design, D16/principle 9).
- **Network discovery org-pool merge**: `NetworkDevice` is keyed on `(orgId, ip)` with no `deviceId`; multi-agent orgs merge discoveries into one pool. Org-safe, but per-device attribution is not modeled. Needs a product decision before multi-agent fleets.
- **Unassigned scans claimable by any org agent** (`OR [{deviceId},{deviceId:null}]`): org-scoped and safe, but unclaimed-scan semantics should be defined for fleets.
- **Network diagnostics run from the API-gateway host**, not the agent; results are not persisted. A product decision on vantage point is needed.
- **Score gauges default to 0/100 for never-scored devices** (dashboard health + cybersecurity `?? 0`): presentational ambiguity — a "no score yet" state should ideally render UNKNOWN/pending, not 0.
- **`00` §6 presence latency**: OFFLINE classification/alert remains 15 min by design.
- **Route/shadowing** verified NOT present; no action.

## 11. Documentation Updated

- `00_CURRENT_STATE.md` — git state, headline findings (SEC-1/NET-1/NET-2 + CYB-1/CYB-2), test evidence, working-tree hygiene.
- `08_FEATURE_READINESS_MATRIX.md` — Cybersecurity/Network/security-ingestion rows annotated with SUB-01A evidence.
- `12_MASTER_ROADMAP.md` — SUB-01A completed block; NEXT stage = `NET-00 — Network Evidence & Current-State Audit` after this manual certification PASS; `V1-STAGE-02-SUB-02` (Deployment/CD) preserved as a later substage.
- `14_DECISION_LOG.md` — D24: CYBER-01 manual real-device certification PASS / CLOSED for V1; Cybersecurity preserved as the V1 stable baseline; extensibility under `15`.
- This report (§1 status + PASS annotation, §6/§7 CYB rows, §8 CYBER-01 evidence, §9 CYBER-01 retest, §9.1 manual result) — automated + manual certification evidence for CYBER-01.

## 12. Commit

- Automated fix: one atomic commit `fix(cybersecurity): close real-device scan polling failures` (`340a15e`). Not pushed (AGENTS.md policy 13).
- Closure: one atomic documentation commit `docs(cybersecurity): certify real-device V1 flow`. Not pushed.
- `apps/api-gateway/.env.test` untouched and untracked.

## 13. Recommended Next Stage

- **CYBER-01 is CLOSED** — manual real-device certification **PASS**; Cybersecurity remains the **V1 stable baseline**. Future Cybersecurity capabilities remain extensible under the Module Extensibility Contract (`15`).
- Next: **`NET-00 — Network Evidence & Current-State Audit`** — real-device Network evidence (manual §9 step 8), then per-device attribution, unassigned-scan semantics, and diagnostics vantage point. `V1-STAGE-02-SUB-02` (Deployment Reliability & CD Repairs) remains preserved as a later substage.
