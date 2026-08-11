# V1-STAGE-02-SUB-01 — Enrollment, Token & Device-Link Reliability Report

> Recovery + completion + certification of the interrupted SUB-01 checkpoint
> preserved by GOV-01. Date: 2026-08-11. Scope decision D21 (founder):
> Enrollment / Token / Device-Link / Presence reliability promoted ahead of
> Deployment/CD within V1-STAGE-02; CD preserved as `V1-STAGE-02-SUB-02`.

## 1. Checkpoint Recovery

The working tree at HEAD `5ca0b21` (GOV-01) matched the GOV-01 checkpoint exactly:

- **12 modified files** — schema (api + worker, `lastSeenAt` nullable),
  dashboard ordering, devices controller/service (race handling, hostname
  removal, strong-identity recovery), device-health report (`lastBoot`
  nullable), presence-telemetry spec, web presence/onboarding surfaces.
- **Untracked migration** `apps/api-gateway/prisma/migrations/20260810120000_device_lastseen_nullable_presence_truth/`
  (`ALTER TABLE "Device" ALTER COLUMN "lastSeenAt" DROP NOT NULL; ... DROP DEFAULT;`).
- **Untracked test** `apps/api-gateway/test/enrollment-device-link.spec.ts`
  (437 lines, E1-E8, 16 tests).
- **`.env.test` intentionally untracked** (16 placeholder lines), untouched.

No interrupted work was deleted, reset, or regenerated. Status: **COMPLETE**.

## 2. Governance Decision (D21)

Founder decision: trustworthy device identity is a prerequisite for
Cybersecurity, Network, Monitoring and other device-backed modules, so the
enrollment/token/device-link/presence reliability work was promoted ahead of
Deployment/CD. Recorded in `12_MASTER_ROADMAP.md` (Stage-02 re-scope,
`V1-STAGE-02-SUB-02` = Deployment/CD preserved) and `14_DECISION_LOG.md` (D21).
Historic reports untouched.

## 3. Implementation Completed (from the checkpoint)

- **Presence truthfulness**: migration applied; `Device.lastSeenAt` nullable
  with no default; only `DevicesService.ingestMetrics` writes it. A Device row
  never implies ONLINE.
- **Enrollment token lifecycle**: single-use/expiry/revocation semantics
  verified (atomic `updateMany` consumption re-asserts not-revoked,
  not-expired, below-maxUses under row lock).
- **Device identity**: persistent reconnect resolves to the SAME Device via
  strong identity (identityFingerprint/installationId). Hostname removed from
  `findExistingDevice` identity matching. `register`/`register-public`/recovery
  store only `deviceTokenHash` (Stage-01 D16 intact).
- **Registration race**: `P2002` catch → idempotent `reuseExistingDevice` —
  concurrent first-time registrations collapse to one row.
- **Credential recovery**: requires strong identity; hostname/deviceId alone →
  `IDENTITY_REQUIRED`; fingerprint/installationId rotate only the matching
  device (old verifier invalidated immediately, `CredentialRotationEvent`
  recorded).
- **Null-safety**: dashboard `orderBy` nulls-last; `findByOrg` nulls-last;
  report `lastBoot` nullable → "Never"; web surfaces accept `lastSeenAt:
  string | null` (UNKNOWN); worker presence-state already null → UNKNOWN.
- **Onboarding truthfulness**: `OnboardingFlow` anchors the baseline to the
  first fully-loaded fleet snapshot and re-anchors on token issuance — completes
  only when a NEW device appears.

## 4. Certification Evidence

| Item | Result |
|------|--------|
| E1 first enrollment (single-use token, hash-only, no ONLINE) | PASS |
| E1 token reuse rejected | PASS |
| E2 unknown/expired/foreign tokens fail closed | PASS |
| E3 reconnect → same Device, safe rotation | PASS |
| E3 restart with stored credential → same Device ONLINE | PASS |
| E4 concurrent registration race → single row | PASS |
| E5 cross-tenant identity isolation | PASS |
| E6 never-seen → UNKNOWN (list + dashboard summary) | PASS |
| E6 stale heartbeat → OFFLINE | PASS |
| E6 unauthenticated ingest cannot set lastSeenAt | PASS |
| E7 same hostname, two machines → two Devices (no false-merge) | PASS |
| E8 hostname-only recovery rejected; fingerprint recovery rotates only matching device | PASS |
| P1-P4 presence telemetry null-baseline | PASS |
| Stage-01 security suites (credential-hardening 13, metrics-security 15, cross-tenant-isolation 20, sso-login 10, metrics-auth 8) | 66 PASS |
| api-gateway full suite | 58 suites / 994 tests PASS |
| web full suite | 35 suites / 791 tests PASS (incl. onboarding baseline test) |
| worker full suite | 8 suites / 80 tests PASS |
| `pnpm lint` + `pnpm build` (api/web/worker) | PASS |
| `scripts/ci-v1-gate.sh` | **19/19 PASS** (incl. migration validation, worker schema sync, secret scan — NO SECRETS DETECTED) |

## 5. Security Check

- No plaintext device credential persistence (hash-only, D16 preserved).
- No raw enrollment/device token logged (DEV logs: ids, models, timestamps only).
- No real secrets introduced; V1 secret scan clean.
- `.env.test` untouched and untracked; no `.env*` staged; only SUB-01 files + docs staged.

## 6. Documentation Updated

- `00_CURRENT_STATE.md` — status line, git state, test evidence (994/791/80/78), presence finding, headline findings, working-tree hygiene.
- `08_FEATURE_READINESS_MATRIX.md` — presence UNKNOWN handling + enrollment/identity lifecycle evidence.
- `12_MASTER_ROADMAP.md` — Stage-02 re-scope (D21), SUB-01 completed block, NEXT substage = SUB-02 (Deployment/CD preserved).
- `14_DECISION_LOG.md` — D21 (priority decision), D22 (presence truthfulness + strong identity).

## 7. Residual Risks

- The legacy authenticated `POST /devices/register` path (`devices.service.ts`
  `register()`) still matches by hostname; it is device-token-guarded and not
  the enrollment path, but a future stage should align it to strong identity.
- `inventory.controller.ts` online-device filter treats null `lastSeenAt` as
  epoch (excluded) — truthful but implicit; could use `derivePresenceState`.
- OFFLINE alert latency (15 min band) remains inherent by design (`00` §6).
- CD (`V1-STAGE-02-SUB-02`) and `METRICS_AUTH_TOKEN` Helm wiring deferred.

## 8. Commit

One atomic commit: `fix(device): certify enrollment and device-link reliability`.
Not pushed (per policy 13).
