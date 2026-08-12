# NET-00 — Network Evidence & Current-State Audit

> Audit / evidence / diagnosis only. No runtime code changed, no defects fixed.
> Establishes the verified V1 Network baseline that becomes the NET-01
> implementation contract. Date: 2026-08-12. Evidence markers follow
> `docs/tech-lead/README.md` conventions. Cyber-security remains CLOSED and is
> not touched.

## 0a. NET-01A Status Update (2026-08-12) — IMPLEMENTED_PENDING_REAL_DEVICE_CERTIFICATION

NET-01A implemented the P0 fix (NET-A01) on top of this audit: default-enabled
real-device agent discovery **and** the Web-vs-Agent auth/polling boundary (Web
confined to the user-JWT read path with honest terminal states). Evidence
markers follow `docs/tech-lead/README.md`. No schema change; Cybersecurity and
Enrollment/Device Identity are untouched.

| Item | State after NET-01A | Evidence |
|---|---|---|
| Agent discovery default | **ENABLED** — `config.rs:80` `TF_NETWORK_DISCOVERY` default `true` | `VERIFIED_BY_CURRENT_CI` — `config::tests::test_network_discovery_default_enabled_with_env_opt_out` |
| `TF_NETWORK_DISCOVERY=false` opt-out | preserved as an intentional opt-out | `VERIFIED_BY_CURRENT_CI` — same config test; installer `resolve_network_discovery` preserves an explicit value |
| Installer (normal V1 install) | writes `TF_NETWORK_DISCOVERY=true` to `agent.env`; an explicit operator value in an existing `agent.env` is preserved across reinstall/upgrade | `VERIFIED_BY_CURRENT_CI` — `verify-linux-bootstrap.sh` §4c (fresh→`true`, explicit `false`→`false`, explicit `true`→`true`); `VERIFIED_THIS_RUN` config-rendering simulation |
| Enabled agent polling path | an enabled agent with a device identity enters `poll_pending_discovery_commands` (`should_poll_network_discovery` gate) | `VERIFIED_BY_CURRENT_CI` — `agent::tests::test_should_poll_network_discovery_*` |
| Discovery auth | unchanged — persistent device Bearer credential on pending/status/result | `VERIFIED_BY_CURRENT_CI` — `client::tests::test_pending_discovery_commands_send_bearer_header`; `DeviceTokenGuard` untouched |
| **Web-vs-Agent auth boundary** | Web discovery trigger = user JWT + RBAC `POST /network/discovery/trigger`; Web status polling = user JWT read path `GET /network/scans?limit=50` ONLY — the Web NEVER calls the device-token routes (`/network/discovery/pending|status|result`); the device token is never exposed to the browser | `VERIFIED_BY_CURRENT_CI` — `test/tenant-isolation-security.spec.ts` F2 (user JWT rejected 401 on `/network/discovery/pending`; user JWT read path org-scoped 200) + `use-network-discovery.spec.ts` (asserts `/network/discovery/pending` is never requested) |
| **Web discovery terminal states** | `useStartDiscovery` is a full terminal-state machine (`idle`/`triggering`/`running`/`completed`/`failed`/`timeout`) polling `/network/scans` for the active scan id; completed/failed stop polling, a 90 s backstop turns a stuck scan into an honest timeout state, 401/403 + unexpected failures stop polling with an honest error banner — never infinite loading; a stale in-flight status write can never overwrite a terminal state | `VERIFIED_BY_CURRENT_CI` — `use-network-discovery.spec.ts` (5 tests: completed / failed / timeout / 401 / trigger-denied) |
| Network page UI | "Start Discovery" button now reflects `Starting... / Discovering... / Retry Discovery` and renders a terminal banner for completed/failed/timeout with the honest reason | `INFERRED_FROM_CODE` — `apps/web/src/app/dashboard/network/page.tsx` |
| Enrollment / device identity | unchanged — no enrollment/identity code modified; installer identity-preservation paths untouched | `INFERRED_FROM_CODE` + `VERIFIED_BY_CURRENT_CI` (E1-E8 suite green in gate) |
| Agent capability banner | `main.rs` prints `Network: ENABLED` / `DISABLED (TF_NETWORK_DISCOVERY=false opt-out)` unconditionally | `INFERRED_FROM_CODE` |

The shipped real-device Agent path is now enabled by default and the Web is
bounded to the user-JWT read path with a terminal-state machine; real-device
manual certification (§18) is still REQUIRED before Network can be certified on
a live host. **NET-A01 = IMPLEMENTED_PENDING_REAL_DEVICE_CERTIFICATION.**

## 1. Status

**COMPLETE (audit).** The full Network path (Agent → API → DB → Web → real
device) was traced in current code. Security boundary is certified intact.
Discovery data is real agent data end-to-end. **One P0 defect was proven: the
shipped real-device Agent never executes network discovery unless
`TF_NETWORK_DISCOVERY=true` is set manually, and the official installer never
sets it** — this is the likely root cause of the known real-device Network
failure ("page keeps loading / no usable discovery results"). Multiple P2
truthfulness/lifecycle gaps are proven. No fabricated value is presented as
real on the Network surface.

## 2. Scope

- In scope: Network module only — agent discovery, API, persistence, Web,
  diagnostics, attribution, scan lifecycle, auth, test coverage.
- Out of scope (untouched): Cybersecurity, Enrollment/Device Identity, CD/Deploy,
  any runtime code.
- Canonical sources read: `AGENTS.md`, `PRD.md`, `00`, `01`, `08`, `12`, `14`,
  `15`, `V1-STAGE-02-SUB-01A` report. No repo-wide doc discovery performed.

## 3. Network Architecture Map

```
Web (apps/web/src/app/dashboard/network/page.tsx, hooks/useNetwork.ts, components/NetworkMap.tsx)
  │  JWT (apiFetch, membership-authoritative org) · WS /network (org room, JWT WS auth)
  ▼
API (apps/api-gateway/src/network/network.controller.ts, network.service.ts, network.gateway.ts)
  │  Web routes: @RequirePermissions(NETWORK_VIEW / NETWORK_SCAN_TRIGGER)
  │  Agent routes: @Public + @UseGuards(DeviceTokenGuard) + Throttle
  │  Prisma → NetworkDevice / NetworkScan · execFileSync (diagnostics, API-host)
  ▼
Agent (apps/agent/src/agent.rs poll_pending_discovery_commands, client.rs, network_discovery.rs)
  │  Bearer persistent device credential (SHA-256 hash-only, fail-closed)
  ▼
Persistence: NetworkDevice (org pool, @@unique([orgId,ip])) · NetworkScan (org + optional deviceId)
```

Layer separation matches the Module Extensibility Contract (`15`): UI → service →
agent/provider → persistence are distinct; discovery is an agent-side provider
behind the `/network/discovery/*` contract (ARP/ICMP today; SNMP/LLDP/mDNS are
future adapters, not a rebuild). Diagnostics are a server-side provider behind
`/network/diagnostics/*`.

## 4. End-to-End Data Flow (traced in current code)

| Step | FILE / FUNCTION | AUTH | ORG/DEVICE AUTHORITY | INPUT → OUTPUT | PERSISTENCE | FAILURE STATE | STATUS |
|------|-----------------|------|----------------------|----------------|-------------|---------------|--------|
| 1. User clicks Start Discovery | `page.tsx:81 handleStartDiscovery` → `useNetwork.startDiscovery` → `POST /network/discovery/trigger` | JWT + `NETWORK_SCAN_TRIGGER` | org from token; optional body `deviceId` checked in-org (`devices.service.findById:280`) | `{deviceId?}` → `{scanId, status, startedAt}` | none (pre-persist) | non-OK → error state, no scan | VERIFIED |
| 2. Scan created | `network.service.createDiscoveryCommand:77` | — | org auth-derived; `deviceId` optional | org → `NetworkScan{status:'pending', startedAt}` | `NetworkScan` row | existing pending/running dedupe returned | VERIFIED |
| 3. Agent polls for work | `agent.rs:537` → `client.rs:539 GET /network/discovery/pending?deviceId=` | Bearer device credential (`DeviceTokenGuard`) | scan match = `orgId AND (deviceId=token.device OR deviceId=null)` | → pending scans | none | 401 → logged; non-2xx → empty | VERIFIED (code); **PARTIAL (real device — discovery default OFF)** |
| 4. Agent claims (running) | `agent.rs:555` → `client.rs:617 POST /network/discovery/status` | Bearer | `getScanForDevice` ownership check | `{scanId,status}` → scan `running` | `NetworkScan.status` | non-owned → 403 (log `tenant_ingestion_denied`) | VERIFIED |
| 5. Discovery executes | `network_discovery.rs:495 discover_network` | — | — | ARP + ICMP sweep → `DiscoveryResult` | none | 60 s tokio timeout / 55 s deadline → error report | VERIFIED (code + 16 unit tests); **PARTIAL (real device)** |
| 6. Result submitted | `agent.rs:586` → `client.rs:567 POST /network/discovery/result` | Bearer | ownership check | result → devices upserted + result `NetworkScan` created + command scan `completed` | `NetworkDevice` upsert `(orgId,ip)`; `NetworkScan` (2 rows/trigger) | `error` field → command scan `failed` + broadcast | VERIFIED (code + isolation tests) |
| 7. WS push | `network.gateway.broadcastTopology/ScanStatus:61-71` | WS JWT (membership) | org room `org:<orgId>` | → `topology`, `scan-status` events | none | WS dropped → client refetch | VERIFIED |
| 8. Web refresh | `useNetwork` hooks (30 s poll devices/topology; WS refetch; 5 s during active discovery) | JWT | org | → devices/topology/scans | none | errors swallowed (`console.error`), no banner | VERIFIED (code); **PARTIAL (no error state)** |
| 9. Render | `page.tsx` (map/devices/diagnostics/scans), `NetworkMap.tsx` | — | org-wide pool | → nodes/devices/history | — | empty states ("No topology data available." / "No scans recorded yet") | VERIFIED |

## 5. Agent Discovery Capability (exactly what exists)

- **Local interface/subnet**: `ip -4 addr show scope global`, private-only
  (10/8, 172.16-31/12-16, 192.168/16), refuses public subnets.
  `network_discovery.rs:115-153, 517-538`.
- **ARP collection**: `/proc/net/arp` read; all-zero MACs excluded
  (`network_discovery.rs:179-208`).
- **ICMP sweep**: `ping -c 1 -W 1 -q -- <ip>`, max `/24`–`/25` (254 hosts,
  `MAX_HOSTS`), 16-way concurrency, 800 ms/host, 55 s overall deadline,
  network-base/subnet enumeration (`network_discovery.rs:360-462`).
- **MAC handling**: local MAC from `/sys/class/net/<iface>/address`; gateway
  MAC via ARP table; ICMP-only hosts fall back to sentinel `00:00:00:00:00:00`
  (rendered `-` in Web post-NET-2).
- **hostname**: reverse DNS via `host` / `nslookup` (2 s timeout). **Vendor**:
  compile-time OUI table (~90 prefixes) — vendor = REAL lookup, but the table is
  small; unknown OUI → null → `-`. **Device type**: none exists.
- **Local node**: local IP always added (`source: "local"`, reachable, 0 ms).
- **Scan request/poll/result flow**: server-command-driven only
  (`agent.rs:537-656`). **No periodic/scheduled discovery** exists
  (contradicts `PRD.md` §6.4 "network sweep (5m)" — flag as doc correction).
- **Auth headers**: `Authorization: Bearer <persistent device token>` on all
  three discovery endpoints (`client.rs:551, 589, 632`).
- **Error handling**: claim→running best-effort; result POST failure → error
  report back (`report_discovery_error_with_status`); 401 logged. **Timeout**:
  60 s agent-side wrapper over 55 s discovery deadline.

**Critical gate**: `poll_pending_discovery_commands` only runs when
`config.network_discovery_enabled` is true (`agent.rs:446`); CLI/env default is
**false** (`config.rs:80` `TF_NETWORK_DISCOVERY=false`); the official installer
writes `agent.env` with only `TF_API_URL`/`TF_STATE_DIR`/`RUST_LOG`
(`install-linux.sh:301-306`). **A stock installed agent never processes network
discovery.** (see §14 NET-A01).

## 6. Authentication & Authority (Phase 6, verified)

| Actor | Token model | Status |
|---|---|---|
| Web trigger/view | JWT access/refresh; `NETWORK_VIEW`/`NETWORK_SCAN_TRIGGER` permissions; membership-authoritative org (`req.user.orgId`) | VERIFIED (`network.controller.ts:23-35, 148-219`; `rbac-permissions.spec.ts`) |
| Agent discovery (pending/status/result) | Bearer persistent device credential → `DeviceTokenGuard` (SHA-256 hash-only, fail-closed 401), Throttle(30/min) | VERIFIED (`controller.ts:37-117`) |
| Legacy agent push (`POST /network/discovery`) | Bearer; `x-org-id`/`body.orgId` mismatch → 403 | VERIFIED (`controller.ts:119-146`; F2 tests) |
| WS `/network` | JWT + membership via `createWsAuthMiddleware`; org room | VERIFIED (`network.gateway.ts:28-47`) |
| Enrollment token | NOT used for Network | VERIFIED |
| orgId/deviceId from client body | never authoritative; trigger `deviceId` existence-checked in-org; scan ownership enforced on all agent writes | VERIFIED |
| Cross-tenant | scan status/result/pending substitution → 403; cleanup org-scoped | VERIFIED (`cross-tenant-isolation.spec.ts:381-443`) |
| Raw token persisted/logged | none (hash-only D16) | VERIFIED |

## 7. Scan Lifecycle (real states, from DB/API)

Real status values: **`pending` → `running` → `completed` | `failed`**.
No `timeout`/`queued`/`claimed` states exist.

- **Who creates**: Web trigger (or test via `POST /network/discovery`).
- **How agent finds work**: 15 s command ticker polls `pending` for
  `(orgId AND (deviceId | null))`.
- **How claim happens**: `status` → `running` (no atomic claim; two agents can
  race on the same pending scan — both may run it).
- **Duplicate-claim prevention**: none beyond the status transition.
- **Agent dies mid-scan**: scan stays `running` until (a) an agent polls pending
  and `cleanupStaleScans` (3 min) marks it `failed`; or (b) forever if no agent
  polls (`cleanupStaleScans` runs only inside `getPendingDiscoveryCommands`,
  `controller.ts:43`).
- **No agent online**: scan stays `pending` indefinitely; Web stops polling at
  its 65 s backstop; **no server-side/worker sweep exists**.
- **Zero devices returned**: `ingestDiscovery` still creates a `completed`
  scan with `deviceCount: 0`; Web empty state shows. Honest but indistinguishable
  from "no agent ran" without the status column (see §10).
- **Partial discovery**: per-device upsert wrapped in try/catch; a bad device
  row is dropped, others persist.
- **What stops Web polling**: scan reaches `completed`/`failed` (3 s check) or
  65 s backstop. Infinite-loading loop is closed (NET-1 fix). `useNetwork`
  30 s polls continue regardless.
- **Failed scans visible?**: persisted (`status=failed`, `error` set), but the
  Web Scan History table has **no Status/Error column** → failed scans are
  invisible in the UI.
- **Timeout truthfulness**: the 65 s Web backstop is honest; the server
  `failed` reason string is "Scan timed out — exceeded maximum allowed duration".

## 8. Persistence Model

- `NetworkDevice` (`schema.prisma:454`): `@@unique([orgId, ip])`, `mac/hostname/
  vendor/interface/source/reachable/latencyMs`, `metadata Json`, **no `deviceId`
  column** → org-wide pool. `lastSeenAt` = `@updatedAt` (last scan upsert).
- `NetworkScan` (`schema.prisma:476`): `orgId`, **optional `deviceId`**, `status`
  (default `completed`), gateway/local/subnet, `deviceCount`, `discoveredIps Json`,
  `error`, `startedAt/completedAt`. Index `(orgId, startedAt)`.
- One triggered discovery writes **two** `NetworkScan` rows: the command scan
  (deviceCount 0, completed by `updateDiscoveryStatus`) + the result scan
  (`ingestDiscovery` create). `getLatestScan` (no status filter) orders by
  `startedAt desc` and is used for topology gateway/local markers.
- Migrations: none added by this audit. Schema is the authoritative
  `apps/api-gateway/prisma/schema.prisma`; worker copy must stay synced if
  NET-01 changes schema.

## 9. Device / Scan Attribution (Phase 4 — CRITICAL)

| Question | Answer (verified) |
|---|---|
| Does `NetworkScan` have `deviceId`? | Yes, optional (null for unassigned Web triggers). |
| Does `NetworkDevice` have `deviceId`? | **No.** Pooled by `(orgId, ip)` only. |
| Devices pooled only by org? | Yes — `NetworkDevice.orgId` is the only scoping key. |
| Can multiple agents' results merge? | Yes — same `(orgId, ip)` upsert overwrites fields; last writer wins per IP. |
| Can one agent see another's discovery? | Yes — org-wide `GET /network/devices`, `/topology`, `/scans` show the full pool, with no per-scan/per-agent marker in the Web UI. |
| How is "This Device" determined? | `node.ip === latestScan.localIp` (`network.service.ts:277`) — the most recent scan's local IP, not the viewing session's device. Multi-agent ambiguity. |
| Attribution today | **organization + scan session (optional deviceId) + IP**; device-level attribution of discovery rows does not exist. |

Fleet limitation: with several enrolled agents, a Web-triggered scan
(`deviceId: null`) is claimable by **any** org agent
(`getPendingDiscoveryCommands`/`getScanForDevice` OR-clause), and all results
collapse into one org pool. Per-device attribution for discovery is an
**architectural decision required** before multi-agent fleets (see §15/§17).

## 10. Web / UI Behavior

- Tabs: Topology Map, Devices, Diagnostics, Scan History.
- Hooks: `useNetworkDevices`/`useNetworkTopology` (30 s poll),
  `useNetworkScans` (one-shot fetch + refetch), `useStartDiscovery`,
  diagnostics hooks, `useNetworkWebSocket` (topology/diagnostics/scan-status).
- Discovery UX: `Start Discovery` → 5 s refetch + 3 s terminal-scan check +
  65 s backstop. Button states `Starting...` / `Discovering...`.
- Loading/empty/error states: loading spinners present; empty states honest
  ("No topology data available.", "No scans recorded yet"); **no error banner —
  API failures are swallowed (`console.error`)**, and failed/stuck scans render
  as empty rather than as an honest failure (contrast: Cybersecurity's
  `useSecurity` terminal-state machine, CYB-1).
- Devices table: Status (reachable dot), IP, Hostname, MAC (sentinel `-`),
  Vendor, Latency, Source, Last Seen. No staleness annotation — reachable/
  latency are **scan-time snapshots** rendered as live.
- Scan History table: Time, Subnet, Devices, Gateway, Duration — **no Status,
  no error**; shows the duplicate command rows (0 devices, `-` duration).
- `NetworkMap`: force-directed render of `topology.nodes`; gateway amber /
  local blue / unreachable gray / vendor cyan; tooltip shows IP/MAC/vendor/
  latency + "Gateway"/"This Device" badges; MAC sentinel hidden (NET-2).

## 11. Data Truthfulness Matrix (Phase 3)

| Surface value | Classification | Proof / risk |
|---|---|---|
| IP | REAL_AGENT_DATA | ARP table / ICMP sweep / local interface |
| hostname | REAL_AGENT_DATA | reverse DNS `host`/`nslookup`; null → `-` |
| MAC | REAL_AGENT_DATA (sentinel handled) | `/proc/net/arp`; DB may store `00:00:00:00:00:00` (NET-2 masks it in UI) |
| vendor | REAL_AGENT_DATA (bounded) | compile-time OUI table (~90 prefixes); unknown → null → `-` |
| device type | NOT PRESENT | no field exists (product gap) |
| local device marker | SERVER_DERIVED, ambiguous | `latestScan.localIp`; multi-agent/org-pool risk |
| online/offline status | SERVER_DERIVED snapshot | `reachable` set at scan time, rendered as live dot; no staleness note |
| latency (device row) | REAL_AGENT_DATA | agent ping during discovery |
| latency (diagnostics) | SERVER_DERIVED | API-host ping (§12) |
| DNS / traceroute / connectivity | SERVER_DERIVED | API-host `dig`/`traceroute`/`ping` (§12) |
| topology relationships | INFERRED, presented as links | star from latest scan gateway to every reachable node; **not** layer-2 adjacency |
| scan duration | REAL_AGENT_DATA | `scan_duration_ms` (result scans); command scans null |
| scan status/history | SERVER_DERIVED | real rows; duplicate command rows; failed/pending not surfaced |
| scan completion polling | REAL | NET-1 fixed — real `GET /network/scans` |

No FABRICATED value found. All inference risk is flagged above; the highest-risk
inference is topology "links" and the "This Device" marker.

## 12. Diagnostics Vantage Point (Phase 8)

All four diagnostics execute **on the API-gateway host** via
`execFileSync` in `network.service.ts`:

| Diag | EXECUTION HOST | INPUT | RESULT SOURCE | PERSISTED? | DEVICE-SPECIFIC? | TRUTHFULNESS RISK |
|---|---|---|---|---|---|---|
| Latency | API host | sanitized target IP | `ping -c1 -W2` | No | No | Medium — node-click implies device-relative measurement |
| DNS | API host | sanitized hostname | `dig <resolver> +short` (1.1.1.1/8.8.8.8/9.9.9.9) | No | No | Low |
| Traceroute | API host | sanitized target | `traceroute -n -q1 -w2` | No | No | Medium — vantage is server, not device |
| Connectivity | API host | fixed 1.1.1.1/8.8.8.8/google.com | `ping -c1 -W3` | No | No | Low |

The UI does **not** disclose the vantage point (no "measured from API gateway
host" note). This is the documented "server-host diagnostics" product gap; the
SUB-01A report already flags it. No change made in NET-00.

## 13. Automated Test Coverage (Phase 9)

Existing Network tests and what they prove:

| Behavior | Covered by | Status |
|---|---|---|
| Device-token auth fail-closed (pending/status/result 401, unauthenticated, forged org) | `tenant-isolation-security.spec.ts` F2 (11) | ✅ |
| Org isolation (x-org-id/body.orgId 403; legacy push writes into own org only) | F2; `cross-tenant-isolation.spec.ts` | ✅ |
| Scan ownership (status/result cross-org 403; cleanup cannot mark Org B stale; own scan completes) | `cross-tenant-isolation.spec.ts:381-443`, F2 | ✅ |
| RBAC trigger/view (Viewer denied trigger, can view; Technician can trigger) | `rbac-permissions.spec.ts:99-160` | ✅ |
| Legacy result ingestion + device persistence + topology 200 | `full-e2e-scenario.spec.ts:322-357` | ✅ |
| Topology graph construction, device filters, scans ordering, ingest upsert (unit) | `network.service.spec.ts` | ✅ |
| WS org-room broadcasts + connect rejection | `network.gateway.spec.ts` | ✅ |
| Web WS subscription wiring | `useNetworkWebSocket.spec.ts` | ✅ |
| Agent discovery engine (subnet/ARP/vendor/limits) | `network_discovery.rs` 16 tests | ✅ |
| Claim race / duplicate claim | none | ❌ gap |
| Positive `/network/discovery/result` trigger-flow (claim→run→result→terminal) | none | ❌ gap (NET-02) |
| Zero-device / empty scan; partial/malformed result; duplicate `(orgId,ip)` merge | none | ❌ gap (NET-02) |
| Stale-scan cleanup; failed-scan persistence + UI visibility | none | ❌ gap (NET-02) |
| Web error/terminal states, failed-scan banner | none | ❌ gap (NET-02) |

No tests were added by NET-00.

## 14. Proven Defects

| ID | Sev | Layer | Evidence | Root cause | User impact | Security impact | Data-truth impact | Minimal fix direction | NET-01 |
|---|---|---|---|---|---|---|---|---|---|
| NET-A01 | **P0** | Agent + Installer (runtime config) | `config.rs:80` `TF_NETWORK_DISCOVERY=false`; `agent.rs:446` gate; `install-linux.sh:301-306` writes only `TF_API_URL`/`TF_STATE_DIR`/`RUST_LOG` | Discovery ships opt-in but **no shipped path enables it**; Web has no capability signal | Real-device Network page stays "Discovering..." ~65 s then empty; no usable results (known failure) | None (fail-safe; private-subnet-only even when enabled) | None — no data at all, never fake | Default-enable (safe, bounded /24-/25, private-only) or wire `TF_NETWORK_DISCOVERY=true` in installer/env; add agent capability report so UI can say "discovery disabled" honestly | **NET-01A (P0)** |
| NET-A02 | P2 | API/Web | `controller.ts:43` cleanup inside agent poll; `service.ts:125-150` | Stale-scan cleanup coupled to an online agent; no server/worker sweep | Failed/stuck scans invisible; pending rows accumulate | None | Scan history truthfulness degraded; "0 devices" rows look like completed scans | Server-side/worker stale sweep + Status/error column in Scan History | NET-01B |
| NET-A03 | P2 | API/Web | `controller.ts:97-116`; `service.ts:211-224` | Trigger flow creates command scan + result scan (2 rows) | Duplicate empty rows in history; `getLatestScan` ambiguity | None | Redundant rows; limits/ordering distorted | Single scan per trigger (update command scan with result) or exclude command rows | NET-01B |
| NET-A04 | P2 | Web | `useNetwork.ts` swallows errors; `page.tsx` no banner; no terminal-state machine | No honest error state (Cybersecurity got CYB-1; Network did not) | 401/403/500 during discovery → silent empty after 65 s | None | "No data" presented without reason | Mirror CYB-1: terminal-state machine + error banner | NET-01B |
| NET-A05 | P3 | API/Web | `schema.prisma:454-474`; `service.ts:261-309` | Org-pool keying + latest-scan markers | Multi-agent fleets misattribute "This Device"/gateway; mixed-subnet star topology | None | "This Device"/links inferred, presented as certain | Product decision on attribution model (see §15) | NET-01C |
| NET-A06 | P3 | API/Web | `service.ts:311-438`; UI no vantage note | Diagnostics run from API host | Latency/traceroute not device-relative | None | Vantage point undisclosed | Disclose vantage in UI and/or add agent-side diagnostics | NET-01C |
| NET-A07 | P3 | API | `controller.ts:80,123` (`body: any`); `service.ts:173-209` | No DTO validation on agent ingress | Malformed rows silently dropped (per-device catch) | None | Agent data unvalidated; `console.error` logging | Validated `DiscoveryResultDto` + structured logger | NET-01B/P3 |
| NET-A08 | P3 | Web | `page.tsx:157-158, 293` | `reachable`/latency are scan-time snapshots rendered live | Stale online/offline/latency display | None | Snapshot presented as current | Staleness annotation (e.g., "as of <scan time>") | NET-01B/P3 |

Not defects (verified, intentionally unchanged): `GET /network/scans/latest` is
not shadowed; unassigned `deviceId: null` scans claimable by any org agent is an
org-scoped product behavior; diagnostics-from-server is an existing design.

## 15. Product Gaps (not defects)

- **Agent discovery default-disabled** — see NET-A01 (P0, listed as defect above).
- **Scheduled discovery missing**: `PRD.md` §6.4 claims a periodic "network
  sweep (5m)"; the agent only runs discovery on server command. (Doc correction
  needed — see §20.)
- **Discovery protocol coverage absent** (all future): SNMP, LLDP, mDNS,
  NetBIOS, SSDP, ARP active probing, external MAC vendor DB, OS/service
  fingerprinting, switch/router topology, Wi-Fi discovery, IPv6.
- **Device type/role classification absent**.
- **Diagnostics not persisted**, not device-relative, vantage undisclosed.
- **No capability detection** for agent discovery enablement (fails Module
  Contract principle 7).
- **No multi-agent attribution** (see §9).

## 16. Future Capabilities (design headroom)

The `/network/discovery/*` agent contract and `/network/diagnostics/*` server
contract are already provider-shaped: new discovery protocols (SNMP/LLDP/mDNS/
SSDP/Wi-Fi/IPv6) and MAC-vendor DB can be added behind the `DiscoveryResult`
contract without rebuilding the service; topology can absorb real layer-2 links
(additive fields); a MAC vendor DB replaces the compile-time OUI table. These
are NET-01C+ / post-V1, NOT V1 blockers.

## 17. NET-01 Implementation Plan (evidence-only)

Network is **not mostly healthy on real devices** (NET-A01). NET-01 splits:

- **NET-01A — P0 (blocks correct real-device Network operation).**
  1. Enable agent discovery by default (keep private-subnet /24–/25, 55 s
     deadline, 254-host, 16-way limits) and/or have `install-linux.sh` write
     `TF_NETWORK_DISCOVERY=true` to `agent.env` (re-run-safe, idempotent).
  2. Add agent capability reporting (discovery enabled/disabled + last-run) so
     the Web surface can render an honest "Agent network discovery is disabled"
     state instead of a silent 65 s wait.
  3. Rebuild/reinstall agent; run the real-device manual gate (§18).
- **NET-01B — P1/P2 (data truth + lifecycle).**
  4. Server-side/worker stale-scan sweep independent of agent polling.
  5. Single `NetworkScan` row per trigger (fold result into command scan) and a
     Status/error column in Scan History.
  6. Web terminal-state machine + error banner for discovery polling (mirror
     CYB-1 in `useSecurity.ts`); annotate reachable/latency as scan-time.
  7. Validated agent-ingress DTO + structured logging (A07).
- **NET-01C — P3 / architectural decisions (do not block V1).**
  Attribution model, unassigned-scan semantics, diagnostics vantage/persistence,
  topology honesty (links/labels), periodic scheduling.

## 18. Manual Certification Requirements (operator, NET-01A)

1. Rebuild + reinstall agent from current source; confirm `/etc/techfusion/
   agent.env` now enables discovery (or default-on) without touching identity.
2. `docker compose up -d postgres redis`; start API, worker, Web.
3. Enrolled agent running; `systemctl status techfusion-agent` active.
4. Web → Network → Start Discovery: confirm button leaves `Discovering...` to a
   truthful terminal state (results or honest failure) — not a silent 65 s wait.
5. Confirm the scanning device appears as a node with the "This Device" marker
   matching its real local IP; gateway matches the real default gateway.
6. Confirm real subnet devices appear in Devices + Scan History with correct IP/
   hostname/MAC/vendor; unknown-MAC rows show `-`.
7. With the agent stopped, trigger a scan: confirm the UI reaches an honest
   failed/timeout state (no permanent loading) and the Scan History shows it as
   failed.
8. Diagnostics tab: record that results are measured from the API host and the
   UI discloses the vantage point.
9. `journalctl -u techfusion-agent` shows `[DISCOVERY]` phases ending in
   "completed".
10. Return: agent logs, `GET /network/scans` + `GET /network/topology`
    responses, Network page states for each step.

## 19. Risks

- **Default-enabling discovery** (NET-01A) increases agent activity on private
  subnets (bounded: /24–/25, ≤254 hosts, ≤55 s, once per server command). Low
  risk; cap and rate-limit already exist.
- **Schema change** (if NET-01B single-scan or attribution lands) requires the
  named-migration + worker-schema-sync discipline (`AGENTS.md` principle 10).
- **Attribution model change** (NET-01C) is a product decision; do not ship an
  unvetted model to avoid breaking the org pool.
- The real-device gate is the only proof that covers the shipped installer path
  (config.rs default + `install-linux.sh` env) — automated tests cannot prove it.
- `TF_NETWORK_DISCOVERY=true` on the operator host is unverifiable from the repo;
  the shipped default is what the audit certifies.

## 20. Recommended Next Stage + Documentation

**Next: NET-01A (P0)**, then NET-01B, then NET-01C. Do NOT mark Network
COMPLETE.

Documentation updated by this audit (minimal, evidence-backed):
- `00_CURRENT_STATE.md` — status line + headline finding (NET-A01) + git state.
- `08_FEATURE_READINESS_MATRIX.md` — Network row annotated with NET-00 evidence
  (agent discovery default-disabled → real-device PARTIAL until NET-01A).
- `12_MASTER_ROADMAP.md` — NET-00 completed block; NET-01A/B/C next.
- `PRD.md` §6.4 "network sweep (5m)" corrected to "server-commanded discovery"
  (living-doc factual correction; no status change).
