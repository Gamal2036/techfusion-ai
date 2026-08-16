# ACC-SEC-02D2A — Session Identity & Refresh Token Hardening

> Backend foundation. **PUSHED: NO. PRODUCTION DEPLOYED: NO. MANUAL VERCEL/RAILWAY CERTIFICATION: PENDING.**
> Scope owned by this mission and committed locally on `fix/acc-sec-02d2a-session-foundation`.
> Prior mission unchanged: `ACC-UX-02C` (`feat/acc-ux-02c-interactive-account-security`).

## 1. Objective

Harden the auth session layer and give sessions a stable identity so that a
later session-management surface (ACC-SEC-02D2B) can list/revoke sessions as a
unit:

1. **Stable `sessionId`** that survives the full refresh rotation chain
   (login → refresh → refresh → …), bound to access tokens via an additive,
   non-authoritative `sid` JWT claim.
2. **Refresh-token verifier-only storage**: persist only `rt:v1:<sha256-hex>`
   at rest, with a controlled legacy-plaintext compatibility path that upgrades
   legacy rows atomically — no raw token ever remains in the database.
3. **Truthful server-observed session metadata** (`lastUsedAt`, `ipAddress`,
   `userAgent`, `deviceName` reserved) captured only from the request
   environment, never from the request body.

Deliberately **out of scope** (ACC-SEC-02D2B): password-change endpoint,
session list/revoke endpoints, frontend session UI, reset-password, access-token
denylist, cookie migration, email infrastructure.

## 2. Scope

- `apps/api-gateway/prisma/schema.prisma` — `RefreshToken` additive columns + indexes.
- `apps/api-gateway/prisma/migrations/20260816210000_refresh_session_identity/migration.sql` — new additive migration.
- `apps/api-gateway/src/auth/refresh-token.util.ts` — new verifier utilities.
- `apps/api-gateway/src/auth/auth.service.ts` — session/verifier/metadata logic.
- `apps/api-gateway/src/auth/auth.controller.ts` — server-observed metadata extraction.
- `apps/worker/prisma/schema.prisma` — synced schema copy (via `scripts/sync-prisma-schema.sh`).
- Tests: new `apps/api-gateway/test/refresh-token-hardening.spec.ts` (20 proofs) +
  4 updated direct-seed suites (`auth`, `session-refresh`, `app.integration`, `lifecycle-data-integrity`).
- Docs: `00`/`04`/`08`/`10`/`14` (this report = §8 certification gate).

## 3. Evidence Markers

`VERIFIED_THIS_RUN` (this branch, local): failing-then-passing 20-proof spec,
full api-gateway suite 64 suites / 1099 tests green, `pnpm lint` + `pnpm build`
clean, `git diff --check` clean, V1 gate 18/19 PASS (sole failure = pre-existing
MFA TOTP 30 s time-window flake under local load — passes standalone and in the
full suite run; unrelated to this change). Scratch-DB migration validation run
on a pre-change copy seeded with a legacy plaintext row.

## 4. Design Summary

### 4.1 Stable session identity

- `RefreshToken.sessionId String` — server-generated `crypto.randomUUID()`, or
  preserved from the current row across rotation. NON-SECRET (a UUID leaks no
  credential), deliberately **NOT unique** (historical rows of one chain share
  the same `sessionId`).
- Every access JWT carries `sid: <sessionId>`. The claim is **additive and
  non-authoritative**: guards still require only `sub` + `orgId`, so pre-stage
  access tokens without `sid` remain accepted until their natural 15 m expiry
  (proof P6).
- Backfill: `gen_random_uuid()` per existing row (idempotent; validated on the
  scratch DB).

### 4.2 Refresh-token verifier-only storage

- `generateRefreshToken()` → 96-char hex (48 random bytes).
- `hashRefreshToken(token)` → `rt:v1:<sha256-hex>`; `isRefreshVerifier()` +
  exported prefix; raw tokens are never stored and never logged (structured
  logger redacts `/token/gi`).
- Lookup on refresh: **verifier-first**, then — only on a miss — a single exact
  raw-token lookup (legacy path, flagged `legacyMatch`).
- Upgrade: the CAS `updateMany { id, revokedAt: null }` rotation also rewrites
  `token → verifier` for legacy rows, in the same atomic statement, so no raw
  value remains at rest even if a concurrent rotation wins (P11/P12/P13).

### 4.3 Truthful server-observed metadata

- `lastUsedAt` — set on create and every successful refresh.
- `ipAddress` — **first-seen preserved** across rotation; captured only from the
  request environment: `x-forwarded-for` first entry (validated, ≤45 chars) else
  `socket.remoteAddress`. **No global trust-all-proxy mode**; Railway/proxy
  spoofing limitation documented (debt register T31, principle 7 — security
  boundary wins, forensics gap documented).
- `userAgent` — current value each refresh, 300-char cap (`sanitizeUserAgent`).
- `deviceName` — column added, **reserved, never fabricated**.
- Body injection of `deviceName`/`ipAddress`/`userAgent`/`sessionId` proven
  inert (P16) — nothing metadata-related is read from the request body
  (principle 8).

### 4.4 Schema / migration (additive only)

```prisma
model RefreshToken {
  ...
  sessionId  String
  lastUsedAt DateTime?
  ipAddress  String?
  userAgent  String?
  deviceName String?
  @@index([userId, revokedAt])
  @@index([userId, sessionId])
}
```

`migration.sql`: ADD COLUMN × 5 → backfill `sessionId` (idempotent, existing
legacy plaintext row preserved on the scratch DB) → SET NOT NULL → both indexes.
No column dropped, no unique constraint added, no data rewritten.

## 5. Failing-Then-Passing Evidence

- 17 of the 20 proofs failed against the pre-change implementation (raw-token
  storage, absent sessionId, absent metadata) → after the change, 20/20 pass.
- Two real defects surfaced by the suite and fixed: P12 legacy upgrade persistence
  (upgrade must survive the exact-match rotation write) and P18 logout of a
  session chain must return 201 (logout contract) — both covered by proofs.

## 6. Test Evidence

| Suite | Result |
|-------|--------|
| `test/refresh-token-hardening.spec.ts` (20 proofs P1–P20) | 20/20 PASS |
| Full api-gateway suite | 64 suites / 1099 tests PASS (30 s timeout) |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `scripts/ci-secret-scan.sh` | PASS |
| `scripts/ci-v1-gate.sh` | 18/19 PASS — sole failure pre-existing TOTP time-window flake (`mfa-recovery.spec.ts` "disables MFA atomically…"), passes standalone (1.16 s); unrelated to this change |
| `git diff --check` | PASS |
| Scratch DB migration validation | PASS (idempotent backfill, NOT NULL, indexes, legacy row preserved) |

### 6.1 Proof list

- P1 signup → access `sid` equals stored `sessionId`
- P2 login → `sid` equals stored `sessionId`
- P3 refresh → new access `sid` unchanged (chain preserved)
- P4 multi-hop refresh (3 hops) → `sessionId` stable across all hops
- P5 two logins → distinct `sessionId`s (independent sessions)
- P6 pre-stage access token (no `sid`) still accepted by a guarded route
- P7 `sessionId` is a UUID (non-secret shape; never a JWT/refresh value)
- P8 raw refresh token never stored (only `rt:v1:` verifier at rest)
- P9 stored value matches `hashRefreshToken(...)` format
- P10 verifier lookup path returns the current row
- P11 legacy plaintext row (pre-seeded) refreshes successfully (exact-lookup fallback)
- P12 legacy row upgraded to verifier-only after successful refresh (no raw value at rest)
- P13 revoked legacy row cannot be replayed (CAS guard holds)
- P14 `lastUsedAt` set at login and refreshed on each rotation
- P15 first-seen `ipAddress` preserved across rotation; latest `userAgent` stored
- P16 request-body `sessionId`/`deviceName`/`ipAddress`/`userAgent` injection is inert
- P17 replayed/rotated token fails CAS (no double-use)
- P18 logout revokes the current row and the whole chain (same `sessionId`)
- P19 membership removal blocks refresh even with a valid verifier
- P20 org-switch issues a new `sessionId` (never reuses the old chain)

## 7. Security Properties

- DB leak cannot yield a usable refresh credential (verifier-only, D16-style).
- Legacy plaintext rows cannot survive a successful refresh (atomic upgrade).
- Session identity is server-generated, non-secret, non-authoritative — safe for
  client surfacing in a future session UI (02D2B).
- No security boundary weakened: CAS rotation, membership binding, tenant
  isolation, logout all preserved; `sid` is additive; metadata never authorizes.

## 8. Certification / Operator Gate (PENDING)

- [ ] `pnpm test` full api-gateway suite green on a clean checkout of the
      merged commit (this branch).
- [ ] `scripts/ci-v1-gate.sh` 19/19 PASS (verify the known TOTP flake is absent
      in CI-like conditions).
- [ ] Migration `20260816210000_refresh_session_identity` applied to a staging
      DB pre-seeded with legacy rows; verify backfill + NOT NULL + indexes.
- [ ] Deploy to Railway (certification env only); verify login → refresh →
      refresh chain keeps a stable `sid`, refresh rows show `rt:v1:` verifiers
      and truthful metadata, legacy rows upgrade.
- [ ] Verify no raw token appears in DB dumps or logs.

**Status: PENDING — operator action required.**

## 9. What Was NOT Built (deliberately)

Password change, reset password, session list/revoke-one/revoke-others/revoke-current
endpoints, frontend session UI, access-token denylist, cookie migration, email
infrastructure, trust-all-proxy mode. All are ACC-SEC-02D2B (or later) scope and
remain recorded in the debt register (T25).

## 10. Document Updates

- `docs/tech-lead/00_CURRENT_STATE.md` — headline finding 17, Git State, §5 test evidence.
- `docs/tech-lead/04_BACKEND_CAPABILITY_MAP.md` — auth matrix row, finding 10.
- `docs/tech-lead/08_FEATURE_READINESS_MATRIX.md` — Authentication row, Account profile row.
- `docs/tech-lead/10_TECHNICAL_DEBT_REGISTER.md` — T25/T28 annotations, new T29/T30/T31.
- `docs/tech-lead/14_DECISION_LOG.md` — new D31.

## 11. Commit

Single commit, scoped: `fix(auth): harden refresh sessions and bind session identity`
(local only; **PUSHED: NO; PRODUCTION DEPLOYED: NO**).
