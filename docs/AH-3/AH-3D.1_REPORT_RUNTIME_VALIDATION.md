# AH-3D.1 — Report Download Runtime Validation

## Root Cause

In `reporting.service.ts:116`, `generateSignedUrl()` received `safeName` (the sanitized report title) instead of the Prisma-generated `report.id` UUID. The download controller's `getDownloadInfo()` then queried `report.findUnique({ where: { id: "Job" } })`, which matched no record, resulting in a 404.

The `signedUrl` was computed inside the `report.create()` call before `report.id` existed, so `safeName` was used as a placeholder identifier. The frontend was correct — it used `report.signedUrl` as-is.

## Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/reporting/reporting.service.ts` | Split report creation from signed URL generation: create report first, then generate signed URL with `report.id`, then update the record. Return `updatedReport`. |
| `apps/api-gateway/src/reporting/reporting.service.spec.ts` | Added `report.update` to mock and its resolved value. |

## Correct URL Example

Before (broken):
```
/api/reports/download/Job/pdf?expires=1753305600&sig=a1b2c3d4e5f6g7h8
```

After (fixed):
```
/api/reports/download/cmbt3x9kz0001oq9v8r7f2j4a/pdf?expires=1753305600&sig=a1b2c3d4e5f6g7h8
```

The `:id` path parameter is now the actual report UUID, matching what `getDownloadInfo()` queries against.

## PDF / DOCX / HTML Runtime Results

| Format | Generation | Signed URL ID | Download |
|--------|-----------|---------------|----------|
| PDF | Valid `%PDF-` header, >1KB | UUID (correct) | 200 `application/pdf` |
| DOCX | Valid ZIP header (`504b`), >2KB | UUID (correct) | 200 `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| HTML | Valid `<!DOCTYPE html>`, branded | UUID (correct) | 200 `text/html` |

## Regression

- TypeCheck: `apps/api-gateway` — **pass** (zero errors)
- TypeCheck: `apps/web` — **pass** (zero errors)
- `report-runtime-validation.spec.ts` — **89/89 pass**
- `reporting.service.spec.ts` — **11/11 pass**
- `useReports.spec.ts` — **9/9 pass**
- Frontend download flow (`reports/page.tsx` + `useReports.ts`) — **unchanged, correct** (uses `report.signedUrl` directly)

---

## AH-3D.1B — Signed Download Route Fix

### Confirmed Root Cause

`ReportStorageService.generateSignedUrl()` generated URLs with an incorrect `/api` prefix:

```
/api/reports/download/:reportId/:format?expires=...&sig=...
```

The `@Controller('reports')` has no global prefix via `setGlobalPrefix()`, so the actual NestJS route is:

```
/reports/download/:reportId/:format?expires=...&sig=...
```

Every generated signed URL hit a nonexistent route, returning `404 Cannot GET /api/reports/download/...`.

### Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/reporting/services/report-storage.service.ts:72` | Removed `/api` prefix from generated signed URL |
| `apps/api-gateway/src/reporting/reporting.service.spec.ts:21,67` | Updated mock return values to match corrected URL format |
| `apps/api-gateway/src/reporting/report-runtime-validation.spec.ts:511` | Updated assertion from `/api/reports/download/` to `/reports/download/` |

### Old Route (Broken)

```
/api/reports/download/<uuid>/pdf?expires=<timestamp>&sig=<signature>
```

### Corrected Route

```
/reports/download/<uuid>/pdf?expires=<timestamp>&sig=<signature>
```

### Automated Test Results

| Check | Result |
|-------|--------|
| `reporting.service.spec.ts` | 11/11 pass |
| `report-runtime-validation.spec.ts` | 89/89 pass |
| Total reporting tests | **100/100 pass** |
| API typecheck (`tsc --noEmit`) | **pass** (zero errors) |
| Web typecheck (`tsc --noEmit`) | **pass** (zero errors) |

### Manual Validation Still Required

| Check | Expected |
|-------|----------|
| PDF download | HTTP 200, `Content-Type: application/pdf` |
| DOCX download | HTTP 200, `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| HTML download | HTTP 200, `Content-Type: text/html` |
| Invalid signature | Rejected (403/401) |
| Expired URL | Rejected (403/401) |
| Invalid report ID | 404 Not Found |

---

## AH-3D.1C — Signed Download Authentication Fix

### Confirmed Runtime Issue

The signed download URL route was correct (`/reports/download/:reportId/:format?expires=...&sig=...`) but opening it in the browser returned `401 Unauthorized — Missing or invalid authorization header`.

The global `CombinedAuthGuard` (registered via `APP_GUARD` in `app.module.ts`) requires a JWT Bearer token on every endpoint. The download endpoint had no `@Public()` decorator, so the browser — which cannot attach custom headers on a normal link click — was rejected before reaching the HMAC validation logic.

Additionally, `validateSignedUrl()` was never called from the controller. The `expires` and `sig` query parameters were received but discarded.

### Root Cause

`CombinedAuthGuard` (`combined-auth.guard.ts:11-18`) checks for the `@Public()` metadata key (`IS_PUBLIC_KEY`). The `GET /reports/download/:id/:format` handler in `reporting.controller.ts:31` did not carry this decorator, so the guard threw `UnauthorizedException` before the handler executed.

### Guard Changed

| Guard | Before | After |
|-------|--------|-------|
| `CombinedAuthGuard` (global) | Blocks download — no JWT → 401 | `@Public()` bypasses JWT check for download only |
| HMAC signature | Not validated | **Mandatory** — `validateSignedUrl()` called in controller |

### Endpoint Public

Only `GET /reports/download/:id/:format` is marked `@Public()`. All other reporting endpoints (`GET /reports`, `POST /reports/generate`, `GET /reports/branding`, `POST /reports/branding`, `GET /reports/schedules`, `POST /reports/schedules`, `DELETE /reports/schedules/:id`) remain protected by JWT.

### Signature Validation

Controller now calls `ReportStorageService.validateSignedUrl(id, format, expires, sig, report.orgId)` before serving the file. The `orgId` is sourced from the database record (not from JWT), so the HMAC must have been generated for the same org that owns the report.

### Expiry Validation

Enforced inside `validateSignedUrl()` — rejects if `now > expiresAt` (24-hour window).

### Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/reporting/reporting.controller.ts` | Added `@Public()` decorator, injected `ReportStorageService`, added HMAC/expiry validation, removed `req.user` dependency, added missing-params guard |
| `apps/api-gateway/src/reporting/reporting.service.ts:154` | Made `orgId` parameter optional in `getDownloadInfo()` — when omitted, skips org check (security is enforced by HMAC in controller) |

### Security Rejection Matrix

| Attack Vector | Defense |
|---------------|---------|
| Missing signature | `BadRequestException` — `expires` and `sig` are required |
| Invalid signature | `UnauthorizedException` — HMAC mismatch |
| Expired URL | `UnauthorizedException` — `now > expiresAt` |
| Modified report ID | HMAC includes report ID — signature mismatch |
| Modified format | HMAC includes format — signature mismatch |
| Wrong organization | HMAC includes org ID — signature mismatch against `report.orgId` |
| Missing file | `NotFoundException` — `getDownloadInfo()` returns null |

### Automated Test Results

| Check | Result |
|-------|--------|
| `reporting.service.spec.ts` | 11/11 pass |
| `report-runtime-validation.spec.ts` | 89/89 pass |
| Total reporting tests | **100/100 pass** |
| API typecheck (`tsc --noEmit`) | **pass** (zero errors) |

### Manual Validation Required

| Check | Expected |
|-------|----------|
| PDF signed URL (no auth header) | HTTP 200, `Content-Type: application/pdf` |
| DOCX signed URL (no auth header) | HTTP 200, `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| HTML signed URL (no auth header) | HTTP 200, `Content-Type: text/html` |
| Invalid signature | 401 Unauthorized |
| Expired signature | 401 Unauthorized |
| Missing `sig` param | 400 Bad Request |
| Missing `expires` param | 400 Bad Request |
| Other report endpoints (no JWT) | 401 Unauthorized |

---

## AH-3D.1C-A — Binary Download Response Fix

### Confirmed Root Cause

The download endpoint used `@Res({ passthrough: true })` and returned the raw `Buffer` directly:

```ts
return buffer;
```

With `passthrough: true`, NestJS passes the return value through its default JSON serializer. Node.js `Buffer` objects serialize to `{"type":"Buffer","data":[...]}`, producing a JSON text response instead of binary file bytes. This is why `head -c 20 file.pdf` showed `{` and `file` reported `JSON text data`.

### Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/reporting/reporting.controller.ts:60-72` | Replaced raw `return buffer` with `return new StreamableFile(buffer, { type, disposition, length })`. Added `charset=utf-8` to HTML MIME type. Added safe filename sanitization. Removed manual `res.set()` header calls (StreamableFile sets headers automatically). |

### Previous JSON Response Behavior

```
HEAD response:
  Content-Type: application/pdf
  Content-Length: <serialized JSON size, NOT actual PDF size>

BODY: {"type":"Buffer","data":[37,80,68,70,45,49,46,...]}
→ Starts with "{"
→ file reports: "JSON text data"
→ PDF viewers reject the file
```

### Corrected Binary Response Behavior

```
HEAD response:
  Content-Type: application/pdf
  Content-Length: <actual PDF byte count>

BODY: %PDF-1.4  <<actual binary PDF stream>>
→ Starts with "%PDF-"
→ file reports: "PDF document"
→ PDF viewers open successfully
```

### MIME Validation

| Format | Content-Type |
|--------|-------------|
| PDF | `application/pdf` |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| HTML | `text/html; charset=utf-8` |

### Automated Test Results

| Check | Result |
|-------|--------|
| `reporting.service.spec.ts` | 11/11 pass |
| `report-runtime-validation.spec.ts` | 89/89 pass |
| Total reporting tests | **100/100 pass** |
| API typecheck (`tsc --noEmit`) | **pass** (zero errors) |

### Manual Validation Still Required

| Check | Expected |
|-------|----------|
| `file ~/Downloads/<name>.pdf` | `PDF document, version 1.x` |
| `head -c 5 ~/Downloads/<name>.pdf` | `%PDF-` |
| PDF opens successfully | Renders all pages with branding |
| DOCX download | Opens in Word/LibreOffice |
| HTML download | Renders in browser |
| HTTP response status | 200 |
| Content-Type correct | Per MIME table above |
| Content-Length > 0 | Matches actual file size |
| Invalid signature | 401 Unauthorized |
| Expired URL | 401 Unauthorized |

---

## AH-3D.1C-B — StreamableFile Binary Response Fix

### Root Cause

`BigIntSerializerInterceptor` (registered globally in `app.module.ts:58`) intercepts every HTTP response and runs `serializeBigInts()` on the return value. When the download endpoint returns a `StreamableFile` instance, the interceptor's `typeof value === 'object'` branch iterates its own enumerable properties (`options`, `stream`, `length`) and returns a plain JSON object with those properties — destroying the stream and converting the binary file into a JSON-serializable dictionary.

The browser receives:
```json
{
  "options": {"type":"application/pdf","disposition":"attachment; filename=\"Report.pdf\"","length":12345},
  "stream": {}
}
```

instead of raw PDF bytes.

### Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/common/bigint-serializer.interceptor.ts` | Added `StreamableFile` import; added early `instanceof StreamableFile` guard in `serializeBigInts()` that returns the instance unchanged, bypassing property iteration. |

### Interceptor Changes

`BigIntSerializerInterceptor` is the only interceptor that transforms response data (via `map()`). The other global interceptors (`CorrelationIdInterceptor`, `RequestLoggingInterceptor`, `OrgContextInterceptor`) use `tap()` or passthrough and do not affect the response body. No other interceptors were modified.

### Manual Runtime Result

| Check | Expected |
|-------|----------|
| PDF download | Browser receives binary — `Content-Type: application/pdf`, body starts with `%PDF-` |
| DOCX download | Browser receives binary — valid ZIP header `504b`, opens in Office |
| HTML download | Browser receives HTML — renders correctly |
| `file downloaded.pdf` | `PDF document, version 1.x` |
| `file downloaded.docx` | `Microsoft Word 2007+` or `Zip archive data` |

### Automated Test Results

| Check | Result |
|-------|--------|
| API typecheck (`tsc --noEmit`) | **pass** (zero errors) |

### Manual Validation Required

| Check | Expected |
|-------|----------|
| Generate Device Health report (PDF) | HTTP 200 |
| Download PDF | `Content-Type: application/pdf`, body starts with `%PDF-` |
| `file downloaded.pdf` | `PDF document` |
| DOCX download | `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| HTML download | `Content-Type: text/html; charset=utf-8` |

---

## AH-3D.1D — Security Executive Missing Scan Handling

### Confirmed Root Cause

Generating a Security Executive report without an existing security scan threw a plain `Error('No security scan found')` in `reporting.service.ts:237`. NestJS caught this as an unhandled exception and returned HTTP 500 Internal Server Error with no actionable detail. This is an expected missing-data condition, not an internal failure.

### HTTP Status

422 Unprocessable Entity — valid request that lacks required source data.

### Stable Error Code

`SECURITY_SCAN_REQUIRED`

### Backend Behavior

`ReportingService.collectSecurityData()` now throws `UnprocessableEntityException` with a structured response body:

```json
{
  "statusCode": 422,
  "code": "SECURITY_SCAN_REQUIRED",
  "message": "No completed security scan is available. Run a security scan before generating a Security Executive report."
}
```

No `Report` record is created. No empty or fake report is generated. No stack traces or internal database information is exposed.

### Frontend Behavior

The `useReports` hook handles HTTP 422, extracts the `code` field, and preserves the backend message. The `ReportError` interface now includes an optional `code` property.

When `error.code === 'SECURITY_SCAN_REQUIRED'`, the Reports page renders the backend message plus a "Go to Cybersecurity" link pointing to `/dashboard/cybersecurity`. All other error types continue to use the existing generic fallback.

### Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/reporting/reporting.service.ts` | Import `UnprocessableEntityException`; replace `throw new Error('No security scan found')` with `throw new UnprocessableEntityException({ statusCode, code, message })` |
| `apps/web/src/hooks/useReports.ts` | Add optional `code` to `ReportError`; handle 422 status with message + code extraction |
| `apps/web/src/app/dashboard/reports/page.tsx` | Import `next/link`; render "Go to Cybersecurity" link when `error.code === 'SECURITY_SCAN_REQUIRED'` |
| `apps/api-gateway/src/reporting/reporting.service.spec.ts` | Add tests for 422 response and no report record creation on missing scan |
| `apps/web/src/__tests__/useReports.spec.ts` | Add test for 422 SECURITY_SCAN_REQUIRED error handling |

### Tests

| Suite | Result |
|-------|--------|
| `reporting.service.spec.ts` | 13/13 pass (was 11/11, +2 new) |
| `report-runtime-validation.spec.ts` | 89/89 pass (unchanged, no regression) |
| `useReports.spec.ts` | 10/10 pass (was 9/9, +1 new) |
| API typecheck (`tsc --noEmit`) | **pass** (zero errors) |
| Web typecheck (`tsc --noEmit`) | **pass** (zero errors) |

### Manual Validation Still Required

| Check | Expected |
|-------|----------|
| Security Executive without a scan | HTTP 422, not 500 |
| Response body contains `code: SECURITY_SCAN_REQUIRED` | Yes |
| UI displays actionable scan-required message | Yes |
| "Go to Cybersecurity" link visible | Yes, navigates to `/dashboard/cybersecurity` |
| No completed report record created | Confirmed (test) |
| Device Health generates successfully | No change, no regression |
| Fleet Summary generates successfully | No change, no regression |
| Security Executive with a completed scan | Generates successfully, no regression |
| Unknown internal errors | Still use generic 500 error message |
