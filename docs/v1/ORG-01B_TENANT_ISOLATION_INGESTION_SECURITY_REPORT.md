# ORG-01B — Tenant Isolation & Ingestion Security Hardening Report

| Field | Value |
| --- | --- |
| Mission | ORG-01B |
| Date | 2026-08-07 |
| Status | **ORG-01B COMPLETE — TENANT ISOLATION HARDENED** |
| RLS Decision | **APPLICATION-LAYER-AUTHORITATIVE** (RLS non-enforcing, documented truthfully) |
| Scope | Inventory ingestion (F1), network discovery ingestion (F2), security scan ingestion (same vuln class), tenant authority model, cross-tenant adversarial tests, RLS reality audit, full regression |

---

## 1. Executive Summary

Client-controlled org identifiers (`X-Org-Id` header and `body.orgId`) previously acted as the tenant
authority for machine-to-machine (agent) write endpoints. A caller with network access could submit
inventory, network-discovery, and security-scan data into any organization by simply supplying the
target org's UUID in a header or body field, with **no authentication required**.

This report documents the elimination of that vulnerability class for the agent ingestion surface:

- **F1** `POST /inventory/report` — now requires a valid Device Token; org/device authority is derived
  exclusively from the resolved Device row.
- **F2** `POST /network/discovery` (+ `discovery/pending`, `discovery/status`, `discovery/result`) —
  now requires a valid Device Token; scan ownership is verified against the authenticated device.
- **Security ingestion** `GET /security/pending/:deviceId`, `POST /security/scan-result` — same
  hardening applied (same vulnerability class).
- `X-Org-Id` / `body.orgId` are no longer tenant authority on any ingestion path. They are treated as
  **optional consistency metadata only**, and a mismatch against the authenticated device's org is
  rejected with `403`.
- RLS was proven **non-enforcing** (table-owner app role bypasses it). Decision: the application layer is
  the authoritative tenant boundary for V1. RLS hardening is documented as future infrastructure work.

---

## 2. F1 — Inventory Ingestion (Result: HARDENED)

### Before (vulnerable)

`POST /inventory/report` was `@Public()` and derived its tenant authority as:

```ts
const orgId = req.headers['x-org-id'] || body?.orgId;   // client-controlled → attacker-controlled
```

with a zero-UUID fallback when neither was supplied. No device authentication was required. The test
suite even asserted this unsafe anonymous-write behavior.

### After (hardened)

- `@Public()` + `@UseGuards(DeviceTokenGuard)` — device credential required, `401` on missing/invalid.
- `orgId` and `deviceId` come only from `req.device` (the row resolved by the Device Token).
- `X-Org-Id` / `body.orgId` are accepted only as consistency metadata; mismatch → `403 Forbidden`.
- `body.deviceId` is validated against the authenticated device; mismatch → `403` (no cross-device mutation).
- Payload is queued via `queueService.addInventoryIngest({ orgId, deviceId, ... })` using the trusted values.
- Denials emit structured observability events (`tenant_ingestion_denied`, `device_org_mismatch`)
  with no tokens or payload contents logged.

### Security contract (verified by tests)

- no token + forged `X-Org-Id` → `401`
- no token + forged `body.orgId` → `401`
- invalid Device Token + forged org → `401`
- valid Device A token + Org B header/body → `403` (Device A is authoritative; B is rejected)
- Device A token + Device B payload `deviceId` → `403`
- Device A legitimate report → accepted under Org A only

---

## 3. F2 — Network Discovery Ingestion (Result: HARDENED)

### Before (vulnerable)

`POST /network/discovery` was `@Public()` and called
`networkService.ingestDiscovery(orgId, body)` where `orgId` came from `req.headers['x-org-id'] || body?.orgId`.
The discovery `pending`/`status`/`result` endpoints were `@Public()` with no device ownership checks.

### After (hardened)

- `discovery/pending`, `discovery/status`, `discovery/result`, `discovery` all require a valid Device Token.
- Org/device authority is derived from the authenticated device (`req.device`).
- New `networkService.getScanForDevice(scanId, orgId, deviceId)` guarantees a scan is owned by the
  requesting device's org **and** device (or is a null-device org-wide command) before any status/result write.
- `getPendingDiscoveryCommands(orgId, deviceId)` scopes the pending-command poll to the device's org.
- `POST /network/discovery` (legacy path, exercised by e2e) is retained but now requires the Device Token;
  header/body orgId is metadata-only with `403` mismatch rejection.

---

## 4. Tenant Authority Model

Three trusted authority chains are used; client-supplied org identifiers are never an authority:

| Context | Credential | Authority resolution |
| --- | --- | --- |
| Human (dashboard/API) | JWT → `OrganizationMember` | `req.user.orgId` / `req.user.role` (membership-authoritative, ORG-01A3) |
| Machine (agent) | Device Token (Bearer) | `DeviceTokenGuard` resolves `Device` row → `req.device.orgId` |
| Enrollment (bootstrap) | Enrollment Token | `EnrollmentService.validateToken` → `EnrollmentToken` row `orgId` |

**Trust rule:** a client may supply an org identifier only as consistency metadata; it can never grant,
override, or redirect tenant context.

---

## 5. Device Token Authority

- `DeviceTokenGuard` (route-level) resolves `Authorization: Bearer <token>`:
  1. SHA-256 hash lookup on `Device.deviceTokenHash` (production path);
  2. fallback unique lookup on plaintext `Device.deviceToken` (legacy/pre-hash devices, kept for
     backward compatibility — see Remaining Risks).
- Rejects missing/malformed headers and inactive devices with `401`.
- Stashes the full Device row on `request.device`; all ingestion handlers read org/device from there.
- `DeviceTokenGuard` is now exported from `DevicesModule` so Inventory, Network, and Security modules
  can apply it.

---

## 6. Removal of X-Org-Id / body.orgId Authority

| Endpoint | Previous behavior | Current behavior |
| --- | --- | --- |
| `POST /inventory/report` | trusted `X-Org-Id`/`body.orgId` | Device Token authoritative; orgId metadata-only; mismatch → 403 |
| `POST /network/discovery` | trusted `X-Org-Id`/`body.orgId` | Device Token authoritative; orgId metadata-only; mismatch → 403 |
| `GET /network/discovery/pending` | unauthenticated | Device Token required; org/device scoped |
| `POST /network/discovery/status` | unauthenticated | Device Token + scan-ownership check |
| `POST /network/discovery/result` | unauthenticated | Device Token + scan-ownership check |
| `GET /security/pending/:deviceId` | unauthenticated | Device Token + device-id match |
| `POST /security/scan-result` | unauthenticated | Device Token + scan-ownership check |

Grep result: no ingestion route derives tenant authority from `X-Org-Id` or `body.orgId` after this change.

---

## 7. Agent Compatibility (Result: PASS)

- The Rust agent (`apps/agent`) was **not** redesigned. Its identity architecture is unchanged:
  enrollment (register-public + persistent device token), telemetry/metrics, reconnect logic, and
  systemd behavior are untouched.
- The only agent changes are additive HTTP headers on **existing** endpoints:
  - `get_pending_security_scans`, `complete_security_scan`,
    `get_pending_discovery_commands`, `update_discovery_status`,
    `report_discovery_result`, `report_discovery_error(_with_status)`
    now send `Authorization: Bearer <device_token>`.
  - Inventory reporting already sent the Bearer header.
- `agent.rs` call sites pass `&self.device_token`.
- `cargo build` OK; `cargo test` 60/60 pass. No new credential types introduced.

---

## 8. Cross-Tenant Security Tests

New suite: `apps/api-gateway/test/tenant-isolation-security.spec.ts` (28 tests, all passing).

- **F1 inventory:** cases A (no auth + forged X-Org-Id → 401), B (no auth + body.orgId → 401),
  E (invalid token + forged org → 401), D (Device A token + Org B header/body → 403),
  F (Device A token + Device B payload → 403), PASS (Device A legitimate → accepted under Org A).
- **F2 network:** equivalent A/B/E/D cases plus pending-poll scoping, cross-device scan status/result → 403,
  and legitimate self-scan completion.
- **Security ingestion:** unauthenticated poll → 401, cross-device poll → 403, cross-org scan completion → 403,
  legitimate self-scan completion → success.
- **Cross-tenant human reads:** Org A user cannot read Org B device (404), network scans (no data), or
  security scan detail (404).
- **Cross-tenant human writes:** Org A user cannot trigger discovery or security scans on Org B devices (404).
- **Enrollment:** client-supplied `orgId`/`X-Org-Id` cannot override `EnrollmentToken.orgId` — device is
  bound to the token's org.
- **ORG-01A3:** `membership-authoritative.spec.ts` remains green (regression confirmed).

---

## 9. RLS Reality Audit

Non-destructive proof executed as the application role against the live database:

```sql
SELECT current_user;                  -- techfusion  (application DB role = table OWNER)
SELECT count(*) FROM "Device";        -- 3
BEGIN;
SET LOCAL app.current_org_id = '99999999-9999-4999-9999-999999999999'; -- nonexistent org
SELECT count(*) FROM "Device";        -- 3   (unchanged → context has no effect)
COMMIT;

SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class JOIN pg_namespace ...;
-- Device      | t | f
-- NetworkScan | t | f
-- SecurityScan| t | f
```

Findings:

- RLS **is enabled** on tenant tables (`relrowsecurity = t`).
- RLS **is NOT forced** (`relforcerowsecurity = f`), and the application role **owns** the tables —
  table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is set.
- `SET LOCAL app.current_org_id` to a nonexistent org still returns all rows → **context is not enforced**.
- The previous `OrgContextInterceptor` used `set_config(..., is_local := true)` on a separate pooled
  connection/statement path that never reached the Prisma queries, so it could not have worked and was
  misleading.

**Result: RLS is NON-ENFORCING.**

---

## 10. RLS Decision

**APPLICATION-LAYER-AUTHORITATIVE.**

- The application layer (controllers → services → Prisma queries) is the tested tenant boundary:
  every tenant-scoped query includes `orgId` (and, for ingestion, `deviceId`) derived from trusted
  authority chains.
- Proper RLS enforcement would require `FORCE ROW LEVEL SECURITY` plus a restricted non-owner production
  role and organization-wide `set_config` propagation across Prisma transactions/pooled connections —
  a DB-role/architecture redesign. That is **BLOCKED** for V1 (see Remaining Risks).
- The misleading `OrgContextInterceptor` was **deleted** and its `APP_INTERCEPTOR` registration removed.
  No false claim of RLS enforcement is made anywhere in the codebase or docs.
- Existing RLS policies in migrations are left in place (harmless) and are documented here as
  non-authoritative. **No new migration was required or added.**

---

## 11. Regression Results

| Suite | Baseline | Result |
| --- | --- | --- |
| api-gateway | 721/721 | **749/749** (+28 new adversarial tests) |
| worker | 79/79 | **79/79** |
| web | 742/742 | **742/742** |
| agent (Rust) | 60/60 | **60/60** |
| lint (`pnpm lint`) | — | **PASS** |
| build (`pnpm build`) | — | **PASS** |

No ORG-01B regressions, no pre-existing failures surfaced, no environment failures.

---

## 12. Files Changed (ORG-01B scope)

Source:

- `apps/api-gateway/src/inventory/inventory.controller.ts` — rewritten; Device Token authority, org/device
  from `req.device`, mismatch rejection, `@Public()` + `DeviceTokenGuard`.
- `apps/api-gateway/src/network/network.controller.ts` — rewritten; Device Token authority + scan ownership.
- `apps/api-gateway/src/network/network.service.ts` — added `getPendingDiscoveryCommands(orgId, deviceId)`
  and `getScanForDevice(scanId, orgId, deviceId)`.
- `apps/api-gateway/src/security/security.controller.ts` — hardened pending/scan-result with Device Token
  + ownership checks.
- `apps/api-gateway/src/security/security.service.ts` — added `getPendingScansForAgent`,
  `getPendingScanForDevice`, `completePendingScan(scanId, orgId, deviceId, ...)`.
- `apps/api-gateway/src/devices/devices.module.ts` — export `DeviceTokenGuard`.
- `apps/api-gateway/src/common/structured-logger.ts` — extended `LogContext` with audit fields.
- `apps/api-gateway/src/common/org-context.interceptor.ts` — **deleted** (misleading non-enforcing RLS hook).
- `apps/api-gateway/src/app.module.ts` — removed `OrgContextInterceptor` registration.
- `apps/agent/src/client.rs` — Bearer device token on discovery/security calls.
- `apps/agent/src/agent.rs` — pass `&self.device_token` at call sites.

Tests:

- `apps/api-gateway/test/tenant-isolation-security.spec.ts` — **new** adversarial suite (28 tests).
- `apps/api-gateway/src/inventory/inventory.controller.spec.ts` — rewritten for the secure contract.
- `apps/api-gateway/test/full-e2e-scenario.spec.ts` — network discovery uses Bearer auth.

Migrations: **NONE** added or removed.

---

## 13. Remaining Risks

1. **Plaintext `deviceToken` fallback lookup** in `DeviceTokenGuard`: legacy/pre-hash devices are still
   resolvable by their plaintext token. This is required for backward compatibility with enrolled devices;
   mitigation is full device-token-hash backfill (future work). Every enrolled device already stores
   `deviceTokenHash` on registration.
2. **RLS non-enforcement** (documented above): tenant isolation depends on the application layer.
   Fortifying RLS (`FORCE ROW LEVEL SECURITY` + restricted non-owner role + context propagation) is
   recommended infrastructure work for a later release.
3. `devices/security-report` (body-based device token) remains a legacy machine path; it still resolves
   the device by token and binds org from the Device row — it is safe, but should be migrated to the
   Bearer pattern for consistency.
4. Rate limiting is per-endpoint and global; no per-org quota for ingestion volume (out of scope).

---

## 14. Final Verdict

**ORG-01B COMPLETE — TENANT ISOLATION HARDENED.**

Client-controlled `X-Org-Id` / `body.orgId` no longer grant tenant write authority on any ingestion path.
All agent ingestion now requires a valid Device Token, org/device authority is derived from the resolved
Device row, cross-device and cross-tenant operations are rejected, the Agent remains fully compatible,
the full regression suite passes (API 749/749, Worker 79/79, Web 742/742, Agent 60/60), and the RLS
reality is documented truthfully as non-enforcing with an application-layer-authoritative decision.
