# ORG-01A1 — Membership Schema, Migration & Backfill Report

Status: ORG-01A1 COMPLETE — MEMBERSHIP FOUNDATION READY
Date: 2026-08-07
Mode: Schema / migration foundation only. No Organization APIs, no org switching,
no JWT changes, no frontend changes, no Agent/monitoring changes, no invites,
no full RBAC. Nothing committed or pushed.

---

## 1. Pre-change Schema

Source: `apps/api-gateway/prisma/schema.prisma` (byte-identical to `apps/worker/prisma/schema.prisma`).

- `User` — `orgId String` (REQUIRED, single FK to `Organization`), `org Organization`,
  `role Role`, `@@unique([orgId, email])`, `refreshTokens RefreshToken[]`.
- `Organization` — `users User[]` plus ~27 tenant-scoped relation arrays
  (devices, alerts, reports, remoteSessions, auditLogs, ...). No membership model.
- `Role` enum — `Owner | Admin | Technician | Viewer` (unchanged).
- No `OrganizationMember` / membership table anywhere in the codebase (verified by grep).
- Architecture was ONE USER = ONE ORGANIZATION, enforced by the single required `orgId` column.
- Dev DB baseline: 5 users, 2 organizations, 4 devices, 41 tables, 14 applied migrations.

## 2. New OrganizationMember Model

Added to both schemas (identical):

```prisma
model OrganizationMember {
  id        String   @id @default(uuid())
  userId    String
  orgId     String
  role      Role
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
  @@index([userId])
  @@index([orgId])
}
```

Relation additions:
- `User.memberships OrganizationMember[]`
- `Organization.memberships OrganizationMember[]`

`onDelete: Cascade` on both relations matches existing conventions
(`RefreshToken.userId` Cascade, `Subscription.orgId` Cascade) and preserves the
existing `AdminService.removeUser` → `prisma.user.delete` path unchanged.

## 3. Compatibility Strategy

The legacy single-org contract is preserved for the duration of ORG-01A1:

- `User.orgId` kept required — NOT made nullable / active-org pointer (deferred to ORG-01A2/A3; making it nullable is unsafe without rewiring every `where: { orgId }` consumer).
- `User.role` kept — still the source for JWT role claim.
- JWT `{ sub, orgId, role }` shape untouched.
- `OrganizationMember` is the future access source of truth; backfilled from legacy rows.

The mission was purely additive: one new table + relations. No existing column,
relation, constraint, or row was altered.

## 4. Migration SQL Summary

Migration: `apps/api-gateway/prisma/migrations/20260807000000_organization_membership/migration.sql`

1. `CREATE TABLE "OrganizationMember"` — id, userId, orgId, role (`"Role"` enum),
   createdAt (`DEFAULT CURRENT_TIMESTAMP`), updatedAt, `PRIMARY KEY (id)`.
2. `CREATE UNIQUE INDEX "OrganizationMember_userId_orgId_key"` on `(userId, orgId)`.
3. `CREATE INDEX "OrganizationMember_userId_idx"`, `CREATE INDEX "OrganizationMember_orgId_idx"`.
4. `ALTER TABLE ... ADD CONSTRAINT`:
   - `OrganizationMember_userId_fkey` → `User(id)` `ON DELETE CASCADE ON UPDATE CASCADE`
   - `OrganizationMember_orgId_fkey` → `Organization(id)` `ON DELETE CASCADE ON UPDATE CASCADE`
5. Backfill `INSERT ... SELECT` (see §5).

No enum changes, no column changes to existing tables, no RLS statements added.

## 5. Backfill Logic

```sql
INSERT INTO "OrganizationMember" ("id", "userId", "orgId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u.id, u."orgId", u.role, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM "OrganizationMember" m
    WHERE m."userId" = u.id AND m."orgId" = u."orgId"
)
ON CONFLICT ("userId", "orgId") DO NOTHING;
```

- Mapping: `userId = User.id`, `orgId = User.orgId`, `role = User.role` (copied verbatim, never fabricated).
- Idempotent-safe: `NOT EXISTS` guard + `ON CONFLICT DO NOTHING` make a second run a no-op.
- Does not modify any existing User / Organization / Device row.

## 6. Indexes / Constraints

| Name | Type | Definition |
|---|---|---|
| `OrganizationMember_pkey` | PK | `("id")` |
| `OrganizationMember_userId_orgId_key` | UNIQUE | `("userId", "orgId")` |
| `OrganizationMember_userId_idx` | INDEX | `("userId")` |
| `OrganizationMember_orgId_idx` | INDEX | `("orgId")` |
| `OrganizationMember_userId_fkey` | FK | `("userId") → "User"("id")` ON DELETE CASCADE ON UPDATE CASCADE |
| `OrganizationMember_orgId_fkey` | FK | `("orgId") → "Organization"("id")` ON DELETE CASCADE ON UPDATE CASCADE |

## 7. API / Worker Schema Parity

`apps/worker/prisma/schema.prisma` synced via repository script
(`scripts/sync-prisma-schema.sh`) and `prisma format` applied to both.

```
diff -u apps/api-gateway/prisma/schema.prisma apps/worker/prisma/schema.prisma  →  no diff
```

- `prisma validate` — PASS (api-gateway, local prisma 6.19.3) and PASS (worker).
- `prisma format` — clean on both.
- Prisma client regenerated (model `OrganizationMember` present in generated client).

## 8. Dev DB Migration Result

Command: `prisma migrate deploy --schema prisma/schema.prisma` (DATABASE_URL from
`apps/api-gateway/.env`), applied non-destructively.

- Migration `20260807000000_organization_membership` applied; recorded in `_prisma_migrations`.
- `prisma migrate status` → "15 migrations found ... Database schema is up to date!"
- No reset, no `migrate reset`, no destructive DDL.

Note: dev DB still records `20260617000200_rls_extended` as applied while that
folder was removed from the repo in a prior commit. This is a pre-existing state,
does not block `migrate deploy`, and is out of scope for ORG-01A1 (documented, not changed).

## 9. Existing-User Backfill Verification (read-only SQL)

| Check | Result |
|---|---|
| users | 5 (preserved) |
| organizations | 2 (preserved) |
| devices | 4 (preserved) |
| memberships | 5 (one per user) |
| users without a membership | 0 |
| users with >1 membership | 0 |
| memberships whose orgId ≠ User.orgId | 0 |
| memberships whose role ≠ User.role | 0 |
| memberships with missing User | 0 |
| memberships with missing Organization | 0 |
| duplicate (userId, orgId) | 0 |

Membership distribution matches the legacy state exactly: Owner=2, Admin=1,
Technician=1, Viewer=1; techfusion-e2e=4, ahmed=1.

## 10. Fresh DB Verification

Performed on a disposable container (`techfusion-test-postgres`, port 5434,
`tmpfs` data — the repo's standard test database; the dev DB on 5433 was untouched).

- `prisma migrate deploy` applied all 15 migrations cleanly to the empty database.
- `OrganizationMember` table exists with correct columns; `role` is the shared `Role` enum type.
- All indexes/unique constraint and both CASCADE FKs present (verified via `information_schema` / `pg_constraint`).
- Schema-level capability checks (rolled-back transactions):
  - one user in two organizations → 2 memberships ✓
  - per-membership role persists distinctly (Owner in A, Viewer in B) ✓
  - one organization holds many memberships ✓
  - duplicate `(userId, orgId)` insert → rejected with
    `duplicate key value violates unique constraint "OrganizationMember_userId_orgId_key"` ✓

## 11. Tests

New: `apps/api-gateway/test/membership-schema.spec.ts` (NestJS test-module pattern,
real test DB). 6 tests, all PASS:

1. backfills exactly one membership per existing user mirroring orgId and role
2. backfill is idempotent-safe when run twice
3. unique(userId, orgId) rejects a duplicate membership
4. one user can hold memberships in two orgs with a distinct per-membership role
5. one organization can contain many memberships
6. memberships cascade when their user is removed

Regression (no application behavior changed):

- `test/auth.spec.ts`, `test/app.integration.spec.ts`, `test/full-e2e-scenario.spec.ts`,
  `test/slug-collision.spec.ts` — 80/80 PASS (auth, JWT, cross-tenant, org/user seeding).
- `admin.service`, `devices`, `enrollment` specs — 100/100 PASS (incl. user removal path).
- Worker suite — 79/79 PASS.
- `tsc --noEmit` — clean for both api-gateway and worker.
- Full api-gateway suite — 672/676 PASS. The 4 failures are in
  `src/billing/billing.integration.spec.ts` (fully-mocked Stripe webhook tests) and
  pass in isolation; they are a pre-existing full-suite mock-contamination flake,
  causally unrelated to the additive schema change (no billing source/tests modified).

Seeds: `apps/api-gateway/prisma/seed.ts` creates only KB articles (no User records);
no seed changes required. Existing fixtures create User rows with `orgId`+`role`,
which the new optional relation does not require changing.

## 12. Files Changed

1. `apps/api-gateway/prisma/schema.prisma` — added `OrganizationMember` model +
   `memberships` relation on User and Organization. (File also carries pre-existing,
   uncommitted V1-MON-01 schema edits; ORG-01A1 changes are additive on top.)
2. `apps/worker/prisma/schema.prisma` — synced copy, byte-identical to api-gateway.
3. `apps/api-gateway/prisma/migrations/20260807000000_organization_membership/migration.sql` — NEW.
4. `apps/api-gateway/test/membership-schema.spec.ts` — NEW focused schema/backfill tests.
5. `docs/v1/ORG-01A1_MEMBERSHIP_SCHEMA_MIGRATION_BACKFILL_REPORT.md` — this report.

No application source files, no auth/JWT code, no controllers, no frontend, no worker
source, no seed file, no monitoring/agent code were touched.

## 13. Deferred Changes

- Making `User.orgId` nullable as a "default/active org" pointer (currently unsafe
  without rewiring every org-scoped consumer) → ORG-01A2/A3.
- JWT membership resolution / org switching / token re-issue on switch → ORG-01A2/A3.
- Organization CRUD + switch API → ORG-01A2.
- Frontend organization UI / switcher → ORG-01C.
- Invites / join-by-email / per-membership role management UI → ORG-01C.
- Full RBAC rework (per-membership role as sole source of truth) → ORG-01A3.
- RLS hardening for `OrganizationMember` (tenant policy) → ORG-01B, together with the
  pre-existing inert-RLS decision (owner-bypass + session-variable propagation bug).
  No RLS statement was added in ORG-01A1.
- F1/F2 ingestion `X-Org-Id` trust removal → ORG-01B.

## 14. Rollback Notes

- Migration is additive. Safe rollback = `migrate resolve --rolled-back` semantics or
  a new down-migration:
  `DROP TABLE "OrganizationMember";` (indexes, unique constraint, and FKs drop with it).
- Rollback affects only membership rows; it does not touch `User`, `Organization`,
  `Device`, or any other tenant data.
- The unique constraint and CASCADE FKs are dropped with the table; no manual cleanup required.
- After rollback, the system returns to the exact pre-ORG-01A1 single-org behavior.

## 15. Final Status

ORG-01A1 COMPLETE — MEMBERSHIP FOUNDATION READY

Acceptance gate summary:

| Gate | Result |
|---|---|
| OrganizationMember model exists | PASS |
| User → many memberships schema support | PASS |
| Organization → many memberships | PASS |
| Role reused, not duplicated | PASS (shared `Role` enum) |
| Unique(userId, orgId) | PASS |
| Existing users backfilled correctly | PASS (5/5, verified) |
| Existing User.orgId preserved | PASS |
| Existing User.role preserved | PASS |
| No auth/JWT behavior changed | PASS |
| API schema valid | PASS |
| Worker schema valid | PASS |
| Schemas synchronized | PASS (no diff) |
| Migration applies without destructive reset | PASS |
| Existing fleet data preserved | PASS (5 users / 2 orgs / 4 devices) |
| No Agent/Monitoring regression | PASS (worker suite + monitoring tests green) |
| No secrets exposed | PASS (no secrets in code, report, or migration) |
