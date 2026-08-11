# V1-STAGE-02-SUB-01A — Real Device Product Integration Certification Report

> Audit/certification of the real integration boundary between Linux Agent, Device
> Identity, Presence/Telemetry, Dashboard, Cybersecurity, and Network.
> Date: 2026-08-11. Built on the SUB-01 certified baseline (enrollment/token/
> device-link reliability, presence truthfulness). This stage fixed only
> integration-boundary defects; it did NOT redesign Cybersecurity or Network.
> Evidence markers follow `docs/tech-lead/README.md` conventions.

## 1. Status

**MANUAL CERTIFICATION REQUIRED.** All automated gates pass and three proven
integration defects were fixed, but the real Linux-agent ↔ API ↔ Web integration
(binary on a real host against the real stack) cannot be certified by automated
tests alone. Manual operator evidence is required before this stage may be
marked COMPLETE (see §8).

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

`AGENT CHANGE: NONE`. `MIGRATION: NONE` (schema untouched; gate schema-sync + migration validation passed).

## 8. Automated Evidence (`VERIFIED_THIS_RUN`, local)

| Item | Result |
|------|--------|
| api-gateway full suite | **58 suites / 994 tests PASS** (re-run clean; first run had one flaky AI-timing test, green on re-run) |
| web full suite | 35 suites / 791 tests PASS |
| worker suite | 8 suites / 80 tests PASS (via gate) |
| agent in-source | 78 tests PASS |
| `pnpm lint` + `pnpm build` (api/web/worker) | PASS |
| `scripts/ci-v1-gate.sh` | **19/19 PASS** — incl. migration validation, worker schema sync, secret scan (**NO SECRETS DETECTED**) |
| Baseline suites re-verified | E1-E8 enrollment/device-link, P1-P4 presence-telemetry, Stage-01 security suites (66), cross-tenant isolation (20), tenant-isolation-security — all PASS |

What automated tests **prove**: device authority propagation, Cybersecurity and
Network org/device scoping, cross-tenant isolation (incl. the shadow-risk
`scans/detail` route), no fake fallback data, and UNKNOWN/absence behavior
(presence UNKNOWN, security/network empty states).

What automated tests **cannot prove** (requires a real device + operator):

1. Real Linux agent binary (this machine) → real API+DB+Web stack end-to-end telemetry render.
2. Presence transitions across a real stop/restart cycle (ONLINE → DEGRADED → OFFLINE → restart → ONLINE, same Device).
3. Reconnect after restart uses the SAME Device with no new enrollment token (real binary).
4. Real security findings (apt/ufw/ss) from this exact machine appear under the correct Device on the Cybersecurity page.
5. Real ARP/ICMP discovery data appears on the Network page and belongs to this org/device session.

## 9. Manual Certification Required (operator)

Commands/actions needed for evidence that automation cannot produce. Start backend, Web, and agent; do NOT stop any system service:

1. `docker compose up -d postgres redis` (or `scripts/dev-up.sh` if present) then start API (`apps/api-gateway`, `pnpm dev`), worker (`apps/worker`, `pnpm dev`), Web (`apps/web`, `pnpm dev`).
2. Start the Linux agent: `TF_API_URL=http://localhost:3001 TF_ORG_TOKEN=<enrollment token from Web> ~/.techfusion/...` / `cargo run` in `apps/agent`. Confirm identity: `agent --identity-status` (device_id + token files exist, 0600).
3. Login to Dashboard, open Settings → Enrollment, issue an enrollment token.
4. Verify the SAME Device appears in Dashboard device-health list, and presence stays **UNKNOWN** until the first heartbeat.
5. Watch presence flip to **ONLINE** within ~1 min of agent activity (30s telemetry tick), and telemetry values update (CPU/RAM/disk).
6. Open **Cybersecurity**, select the device: confirm the displayed security data (updates/firewall/ports/weak config/password policy) is this exact machine's real scan and belongs to this Device. Run a scan from the page and confirm it completes.
7. Open **Network**: trigger discovery and confirm real subnet devices (with this machine as the "local/This Device" node), and that the data appears in Devices + Scan History.
8. `systemctl stop techfusion-agent` (or `kill` the agent): verify presence transitions (DEGRADED after 5 min, OFFLINE after 15 min — 15-min band is by design).
9. Restart the agent with the SAME stored `device_token`/`device_id`: verify reconnect uses the SAME Device with **no** new enrollment token, and presence returns to ONLINE.

Return: agent logs, `GET /devices` + `GET /dashboard/summary` responses, Cybersecurity page state for the exact Device, Network page state, and presence timestamps across stop/restart.

## 10. Remaining Product Gaps (not defects, out of scope)

- **Cybersecurity push-path token transport inconsistency** (SEC-1 residual): `/devices/security-report` authenticates via body `deviceToken` instead of `Authorization: Bearer`/`DeviceTokenGuard`. Same credential model (hash-only, now fail-closed), but a future stage should align the agent to header auth for all device endpoints (breaking agent/API contract — deferred by design, D16/principle 9).
- **Network discovery org-pool merge**: `NetworkDevice` is keyed on `(orgId, ip)` with no `deviceId`; multi-agent orgs merge discoveries into one pool. Org-safe, but per-device attribution is not modeled. Needs a product decision before multi-agent fleets.
- **Unassigned scans claimable by any org agent** (`OR [{deviceId},{deviceId:null}]`): org-scoped and safe, but unclaimed-scan semantics should be defined for fleets.
- **Network diagnostics run from the API-gateway host**, not the agent; results are not persisted. A product decision on vantage point is needed.
- **Score gauges default to 0/100 for never-scored devices** (dashboard health + cybersecurity `?? 0`): presentational ambiguity — a "no score yet" state should ideally render UNKNOWN/pending, not 0.
- **`00` §6 presence latency**: OFFLINE classification/alert remains 15 min by design.
- **Route/shadowing** verified NOT present; no action.

## 11. Documentation Updated

- `00_CURRENT_STATE.md` — git state, headline findings (SEC-1/NET-1/NET-2), test evidence, working-tree hygiene.
- `08_FEATURE_READINESS_MATRIX.md` — Cybersecurity/Network/security-ingestion rows annotated with SUB-01A evidence.
- `12_MASTER_ROADMAP.md` — SUB-01A completed block; NEXT substage unchanged = `V1-STAGE-02-SUB-02` (Deployment/CD) unless this report's manual gate precedes it.

## 12. Commit

One atomic commit: `fix(integration): align device-backed product data flows`.
Not pushed (AGENTS.md policy 13). `apps/api-gateway/.env.test` untouched and untracked.

## 13. Recommended Next Stage

- **First:** complete the **manual real-device gate** (§9) and return evidence to close this stage (COMPLETE).
- Then, per roadmap: `V1-STAGE-02-SUB-02` (Deployment Reliability & CD Repairs), OR a dedicated **Cybersecurity End-to-End Reliability** stage that aligns the security push path to `DeviceTokenGuard` (header auth) as a backward-compatible agent update, followed by **Network End-to-End Reliability** (per-device attribution, unassigned-scan semantics, diagnostics vantage point).
