# AH-3C.2C — Security Validation

**Project:** Tech Fusion AI
**Phase:** AH-3C.2C — Alpha Closure & Production Foundation
**Date:** 2026-07-21

---

## 1. JWT Authentication

| Check | Status | Details |
|-------|--------|---------|
| Access token valid | ✅ | 15-minute expiry, signed with HMAC-SHA256 |
| Refresh token rotation | ✅ | Old revoked on use, 7-day expiry |
| Token storage | ✅ | localStorage (frontend), HttpOnly recommended for production |
| Client-side auth check | ✅ | `isAuthenticated()` decodes exp locally |
| Auto-refresh on 401 | ✅ | Single-flight refresh deduplication |

## 2. Authorization

| Check | Status | Details |
|-------|--------|---------|
| Role hierarchy | ✅ | Owner(4) > Admin(3) > Technician(2) > Viewer(1) |
| Global guard | ✅ | `CombinedAuthGuard` on all routes by default |
| Public route decorator | ✅ | `@Public()` bypasses auth |
| Device token auth | ✅ | SHA-256 hash-based + fallback to plaintext lookup |
| Org isolation in queries | ✅ | All queries use `orgId` from JWT |

## 3. Route Middleware

| Check | Status | Details |
|-------|--------|---------|
| Admin routes | ✅ | `@Roles('Owner', 'Admin')` class-level |
| Owner-only actions | ✅ | Role change, user removal, billing admin |
| Report download | ⚠️ | No role check (any auth user), signed URLs not validated |
| Report generation | ✅ | Admin/Owner only |
| Alert rule management | ✅ | Admin/Owner only |
| AI router config | ✅ | Owner/Admin only |
| Device metrics (agent) | ✅ | DeviceTokenGuard + Public |

## 4. Sensitive Exports & Downloads

| Endpoint | Status |
|----------|--------|
| `GET /security/export-pdf/:deviceId` | ✅ **FIXED** — now uses apiFetch with auth |
| `GET /reports/download/:id/:format` | ⚠️ Signed URL validation is dead code |
| `GET /audit/export/csv` | ✅ JWT required |
| `GET /audit/export/json` | ✅ JWT required |

## 5. CSP & CORS

| Check | Status | Details |
|-------|--------|---------|
| CSP script-src | ⚠️ | `'unsafe-inline'` and `'unsafe-eval'` allowed |
| CSP style-src | ⚠️ | `'unsafe-inline'` allowed |
| CORS origin | ✅ | Configured via `ALLOWED_ORIGINS` env |
| CORS credentials | ✅ | `credentials: true` |
| CORS methods | ✅ | Explicit allowlist |
| CORS headers | ✅ | Explicit allowlist |
| HSTS | ✅ | Production only, 1 year, includeSubDomains |
| X-Frame-Options | ✅ | DENY |
| X-Content-Type-Options | ✅ | nosniff |
| Referrer-Policy | ✅ | strict-origin-when-cross-origin |

## 6. Secrets & Environment Variables

| Check | Status | Details |
|-------|--------|---------|
| .env gitignored | ✅ | Confirmed not tracked |
| .env.example tracked | ✅ | Contains empty placeholder values |
| Validation on startup | ✅ | Rejects missing/min-length secrets in production |
| Frontend secrets | ✅ | Only `NEXT_PUBLIC_*` exposed |
| Database URL | ✅ | Not exposed to frontend |
| AI encryption key | ✅ | AES-256-GCM in database providers |

## 7. Issues Found & Fixed

| Issue | Severity | Status |
|-------|----------|--------|
| Cybersecurity PDF export missing auth (DEFECT-003) | P2 | **FIXED** |
| Inconsistent orgId extraction in SecurityController | Medium | **FIXED** (6 endpoints) |
| Report download signed URL not validated | Medium | **DOCUMENTED** for AH-3D |
| CSP allows unsafe-inline/unsafe-eval | Medium | **DOCUMENTED** — requires build-time CSP |

## 8. Security Validation Result

**PASS** — All critical and high-severity issues resolved.
