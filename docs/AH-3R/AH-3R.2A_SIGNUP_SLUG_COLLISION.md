# AH-3R.2A — Signup Slug Collision Fix

## Root Cause

`AuthService.signup()` generated an organization slug via:

```typescript
const slug = input.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org';
```

Then called `prisma.organization.create({ data: { slug } })` **without any uniqueness check**.

When two users signed up with the same organization name (e.g. "TechFusion"), the second signup hit the database `@unique` constraint on `Organization.slug` and surfaced as a **500 Internal Server Error**.

Additionally, Organization and User creation were **not wrapped in a transaction**, meaning a failure after org creation would leave an orphaned Organization.

## Old Flow

1. Hash password
2. Generate slug from orgName (no uniqueness check)
3. `prisma.organization.create()` — crashes with unique constraint violation on duplicate slug
4. `prisma.user.create()` — never reached
5. Generate tokens

## New Flow

1. Check for existing email → 409 if duplicate
2. Hash password
3. Normalize slug from orgName
4. **Retry loop** (up to 10 attempts):
   a. Try `prisma.$transaction`: create Organization + User atomically
   b. If unique constraint violation (P2002) → increment slug suffix, retry
   c. If success → generate tokens and return
5. If all retries exhausted → throw with internal logging

## Slug Algorithm

```typescript
export function normalizeSlug(input: string): string {
  let slug = input
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/g, '-')   // replace non-alphanumeric with '-'
    .replace(/^-+|-+$/g, '')                      // trim leading/trailing hyphens
    .replace(/-{2,}/g, '-');                       // collapse multiple hyphens
  return slug || 'organization';                   // fallback for empty
}
```

### Rules
- Lowercase
- Unicode-aware (preserves accented characters: `Café` → `café`)
- Removes duplicated separators: `My   Company` → `my-company`
- Trims leading/trailing hyphens: `-My Company-` → `my-company`
- Collapses multiple hyphens: `my--company` → `my-company`
- Fallback: empty/whitespace → `organization`
- Never generates: `company--`, `--company`, `company-`, `""`

## Collision Handling

```
TechFusion         → techfusion
TechFusion (2nd)   → techfusion-2
TechFusion (3rd)   → techfusion-3
...
TechFusion (11th)  → techfusion-11
```

Algorithm: `candidate`, `candidate-2`, `candidate-3`, ..., `candidate-N+1`

Maximum 10 retries beyond the initial attempt (11 total).

## Retry Strategy

- Retry **only** on Prisma error code `P2002` (unique constraint violation)
- Each retry uses a **new `$transaction`** call (avoids PostgreSQL aborted-transaction state `25P02`)
- Bounded to `MAX_SLUG_RETRIES = 10` — no infinite loops
- Any non-P2002 error propagates immediately
- Dev-only debug logging on each collision and retry

## Transaction Safety

```
prisma.$transaction(async (tx) => {
  const org = await tx.organization.create(...)
  const user = await tx.user.create(...)
  return { org, user }
})
```

- Organization + User created atomically
- If User creation fails → Organization rolled back (no orphan)
- If Organization slug collides → entire transaction retried with new slug
- Email duplicate check occurs **before** transaction (avoids wasting transaction)

## Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/auth/auth.service.ts` | Added `normalizeSlug()`, transactional signup with retry, logging |
| `apps/api-gateway/test/slug-collision.spec.ts` | New: 18 focused tests for slug collision fix |

## Tests

18 tests covering:

1. **normalizeSlug** (9 tests): lowercase, duplicate separators, trim hyphens, collapse hyphens, empty fallback, whitespace fallback, unicode, digits, complex input
2. **Signup with slug collision** (6 tests): unique slug, company-2 on duplicate, company-3 on triple, no 500 on collision, duplicate email unchanged, valid user creation
3. **Transaction safety** (1 test): no orphan organization on email duplicate
4. **Existing data unchanged** (1 test): original org slug preserved
5. **Login after signup** (1 test): login works with collision-generated slug

## Typecheck

```
npm run lint (tsc --noEmit) → PASS
```

## Build

```
npm run build (tsc) → PASS
```

## Manual Validation

1. Signup with org name "TechFusion" → Success, slug = `techfusion`
2. Signup again with "TechFusion" → Success, slug = `techfusion-2`
3. Signup again with "TechFusion" → Success, slug = `techfusion-3`
4. Existing login still works
5. Organization list contains all organizations
6. No duplicate slugs
7. No runtime 500 on slug collision

## Remaining Runtime Issues

- Rate limiting on signup is strict (3 requests per 5 minutes) — this is by design
- No slug collision handling for SSO JIT provisioning (out of scope, SSO does not create orgs)
- No slug collision handling for admin-created organizations (out of scope)

## Success Criteria

- [x] Signup never returns 500 because of slug collision
- [x] Unique slug generated automatically
- [x] Existing organizations untouched
- [x] Transaction remains atomic
- [x] Concurrent signup handled safely (bounded retry loop)
- [x] Tests pass (18/18)
- [x] API typecheck passes
- [x] API build passes
