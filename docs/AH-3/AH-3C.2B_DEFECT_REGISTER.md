# AH-3C.2B — Defect Register

**Project:** Tech Fusion AI
**Phase:** AH-3C.2B
**Date:** 2026-07-21

---

## P1 — High Priority

### DEFECT-001: Dashboard Hardcoded Fleet Scores
- **ID:** DEFECT-001
- **Title:** Dashboard displays hardcoded Risk Assessment and Security Posture percentages
- **Severity:** P1 High
- **Domain:** Dashboard
- **Route:** `/dashboard`
- **Action:** Page load
- **Symptom:** `Risk Assessment: 23%` and `Security Posture: 76%` shown as real metrics
- **Expected:** Scores computed from actual device health and security scan data
- **Actual:** Static JSX string literals unrelated to any real data
- **Frontend Evidence:** `apps/web/src/app/dashboard/page.tsx` — hardcoded percentage strings
- **Backend Evidence:** No API endpoint provides fleet-wide risk/security scores
- **API Status:** N/A (frontend-only defect)
- **Reproduction:** Navigate to `/dashboard`, observe Fleet Scores section
- **Probable Cause:** Placeholder values left during initial implementation
- **Ownership Phase:** AH-3F
- **Recommended Action:** Compute from `GET /devices` health scores + `GET /security/latest` per device
- **Blocking:** No (dashboard loads with other real data)

### DEFECT-002: AI Chat Non-Functional Without Provider Configuration
- **ID:** DEFECT-002
- **Title:** AI Chat fails silently when no AI provider API key is configured
- **Severity:** P1 High
- **Domain:** AI Chat
- **Route:** `/dashboard/ai-chat`
- **Action:** Send message
- **Symptom:** Chat request fails with provider error
- **Expected:** Clear "configuration required" state with setup instructions
- **Actual:** Error message without actionable guidance
- **Frontend Evidence:** `apps/web/src/hooks/useAiChat.ts` — SSE stream fails
- **Backend Evidence:** `apps/api-gateway/src/ai/router/ai-router.service.ts` — no configured providers
- **API Status:** Request returns error (no provider available)
- **Reproduction:** Navigate to AI Chat, send any message
- **Probable Cause:** No AI provider API keys in environment variables
- **Ownership Phase:** AH-3F or new AH-3AI
- **Recommended Action:** Add provider configuration UI; detect missing keys and show setup wizard
- **Blocking:** Yes (entire AI Chat feature unusable)

---

## P2 — Medium Priority

### DEFECT-003: Cybersecurity PDF Export Missing Auth Token
- **ID:** DEFECT-003
- **Title:** PDF export opens browser window without Authorization header
- **Severity:** P2 Medium
- **Domain:** Security
- **Route:** `/dashboard/cybersecurity`
- **Action:** Click Export Report
- **Symptom:** Browser navigates to PDF URL without auth → 401
- **Expected:** PDF downloads with authentication
- **Actual:** 401 Unauthorized
- **Frontend Evidence:** `apps/web/src/app/dashboard/cybersecurity/page.tsx` — `window.open()` without auth
- **API Status:** `GET /security/export-pdf/:deviceId` requires JWT
- **Reproduction:** Login, go to Cybersecurity, select device, click Export Report
- **Ownership Phase:** AH-3F
- **Recommended Action:** Use apiFetch with blob download or pass token as query parameter

### DEFECT-004: No Server-Side Route Protection
- **ID:** DEFECT-004
- **Title:** Dashboard routes accessible to unauthenticated users before client redirect
- **Severity:** P2 Medium
- **Domain:** Authentication
- **Route:** All `/dashboard/*` routes
- **Action:** Direct URL access without token
- **Symptom:** Page renders briefly before redirect to /login
- **Expected:** Server-side redirect to /login
- **Actual:** Client-side redirect with flash of content
- **Frontend Evidence:** No `middleware.ts` exists in `apps/web/src/`
- **Reproduction:** Open incognito, navigate to `http://localhost:3000/dashboard`
- **Ownership Phase:** AH-3E
- **Recommended Action:** Add Next.js middleware.ts for JWT verification

### DEFECT-005: Settings Page Only Shows AI Provider Config
- **ID:** DEFECT-005
- **Title:** Settings page lacks user profile, password, MFA, and notification settings
- **Severity:** P2 Medium
- **Domain:** Settings
- **Route:** `/dashboard/settings`
- **Action:** Page load
- **Symptom:** Only AI provider/router status displayed
- **Expected:** User profile, password change, MFA setup, notification preferences
- **Actual:** AI infrastructure monitoring only
- **Frontend Evidence:** `apps/web/src/app/dashboard/settings/page.tsx` — only AI endpoints
- **API Status:** MFA endpoints exist (`POST /mfa/enroll`, `GET /mfa/status`) but no frontend
- **Ownership Phase:** AH-3E
- **Recommended Action:** Add profile, security, notification tabs to settings page

### DEFECT-006: No Team Invite Flow
- **ID:** DEFECT-006
- **Title:** Team page has no invite member functionality
- **Severity:** P2 Medium
- **Domain:** Team Management
- **Route:** `/dashboard/team`
- **Action:** Page load
- **Symptom:** Only role change and remove buttons visible
- **Expected:** Invite button with email-based invitation flow
- **Actual:** Empty state says "Add team members through your organization settings"
- **Frontend Evidence:** `apps/web/src/app/dashboard/team/page.tsx` — no invite button
- **Ownership Phase:** AH-3F
- **Recommended Action:** Add invite member form with email sending

### DEFECT-007: Placeholder Stripe Price IDs
- **ID:** DEFECT-007
- **Title:** Billing page uses placeholder Stripe price IDs
- **Severity:** P2 Medium
- **Domain:** Billing
- **Route:** `/dashboard/billing`
- **Action:** Click Upgrade
- **Symptom:** Stripe checkout fails with invalid price ID
- **Expected:** Real Stripe price IDs for each plan tier
- **Actual:** Hardcoded `'price_pro'`, `'price_business'`, `'price_enterprise'`
- **Frontend Evidence:** `apps/web/src/hooks/useBilling.ts` — placeholder price IDs
- **Ownership Phase:** AH-3I
- **Recommended Action:** Configure real Stripe price IDs in environment

### DEFECT-008: Report Generation Worker Is a Stub
- **ID:** DEFECT-008
- **Title:** Report processor marks status as generating but never produces files
- **Severity:** P2 Medium (deferred)
- **Domain:** Reports
- **Route:** `/dashboard/reports`
- **Action:** Generate Report
- **Symptom:** Report record created with PENDING status; worker sets to generating; no file produced; download returns 404
- **Expected:** Worker generates PDF/DOCX/HTML file, updates status to COMPLETED
- **Actual:** Stub processor logs and returns without generating
- **Backend Evidence:** `apps/worker/src/processors.ts` — processReportJob is placeholder
- **Ownership Phase:** AH-3D
- **Recommended Action:** Implement report generation calling PDF/DOCX/HTML generators

### DEFECT-009: Dashboard Onboarding Download Links Are Fake
- **ID:** DEFECT-009
- **Title:** Agent download buttons in onboarding wizard link to placeholder URLs
- **Severity:** P2 Medium
- **Domain:** Onboarding
- **Route:** `/dashboard` (onboarding section)
- **Action:** Click download button
- **Symptom:** Navigates to placeholder URL
- **Expected:** Real download links for agent binary
- **Actual:** Non-functional links
- **Frontend Evidence:** `apps/web/src/app/dashboard/page.tsx` — placeholder href
- **Ownership Phase:** AH-3G
- **Recommended Action:** Link to real agent binaries or installation documentation

### DEFECT-010: Backup Restore Uses Fake Progress Bar
- **ID:** DEFECT-010
- **Title:** Recovery wizard progress bar is hardcoded, not based on actual progress
- **Severity:** P2 Medium
- **Domain:** Backups
- **Route:** `/dashboard/backup`
- **Action:** Execute restore
- **Symptom:** Progress bar shows `w-2/3` (66%) regardless of actual progress
- **Expected:** Real progress from polling backup run status
- **Actual:** Static CSS class
- **Frontend Evidence:** `apps/web/src/app/dashboard/backup/page.tsx` — hardcoded width
- **Ownership Phase:** AH-3F
- **Recommended Action:** Poll `GET /backups/runs/:id` for real status updates

---

## P3 — Low Priority

### DEFECT-011: Decorative Quick Action Buttons on Dashboard
- **ID:** DEFECT-011
- **Title:** Quick Actions grid buttons have no onClick handlers
- **Severity:** P3 Low
- **Domain:** Dashboard
- **Route:** `/dashboard`
- **Action:** Click any Quick Action button
- **Symptom:** No action occurs
- **Expected:** Navigate to relevant page or trigger action
- **Actual:** Buttons are purely decorative
- **Ownership Phase:** AH-3F

### DEFECT-012: Remote Support Mouse/Keyboard Control Decorative
- **ID:** DEFECT-012
- **Title:** Mouse and keyboard control buttons in remote viewer have no implementation
- **Severity:** P3 Low
- **Domain:** Remote Support
- **Route:** `/dashboard/remote-support`
- **Action:** Click mouse/keyboard buttons
- **Symptom:** No action
- **Expected:** Input forwarding to remote device
- **Actual:** Buttons exist but have no handlers
- **Ownership Phase:** AH-3F

### DEFECT-013: Recording Playback Not Implemented
- **ID:** DEFECT-013
- **Title:** Play Recording button exists but has no playback functionality
- **Severity:** P3 Low
- **Domain:** Remote Support
- **Route:** `/dashboard/remote-support`
- **Action:** Click Play Recording
- **Symptom:** No action
- **Expected:** Video/image playback of recording
- **Actual:** Button exists, no implementation
- **Ownership Phase:** AH-3F

### DEFECT-014: Knowledge Base Markdown Rendered as Plain Text
- **ID:** DEFECT-014
- **Title:** KB articles display raw markdown syntax instead of rendered HTML
- **Severity:** P3 Low
- **Domain:** Knowledge Base
- **Route:** `/dashboard/knowledge-base`
- **Action:** View article
- **Symptom:** Raw markdown visible (e.g., `## Header`, `**bold**`)
- **Expected:** Rendered HTML from markdown
- **Actual:** `whitespace-pre-wrap` plain text
- **Ownership Phase:** AH-3G

### DEFECT-015: KB Semantic Search Hook Unused
- **ID:** DEFECT-015
- **Title:** `useKbQuery` hook exists but is never called in the KB page
- **Severity:** P3 Low
- **Domain:** Knowledge Base
- **Route:** `/dashboard/knowledge-base`
- **Action:** N/A
- **Symptom:** Semantic search not available in UI
- **Expected:** Search functionality using embeddings
- **Actual:** Hook exported but not imported
- **Ownership Phase:** AH-3F

### DEFECT-016: AI Chat Has No Conversation Persistence
- **ID:** DEFECT-016
- **Title:** Chat history is lost on page refresh
- **Severity:** P3 Low
- **Domain:** AI Chat
- **Route:** `/dashboard/ai-chat`
- **Action:** Refresh page
- **Symptom:** All chat messages disappear
- **Expected:** Conversation persisted in database
- **Actual:** Messages only in React state
- **Ownership Phase:** AH-3F

### DEFECT-017: No Error Boundaries on Dashboard Routes
- **ID:** DEFECT-017
- **Title:** No `error.tsx` files in any route segment
- **Severity:** P3 Low
- **Domain:** All routes
- **Route:** All `/dashboard/*`
- **Action:** Runtime error in any component
- **Symptom:** White screen of death
- **Expected:** Graceful error boundary with recovery
- **Actual:** Default Next.js behavior
- **Ownership Phase:** AH-3G

### DEFECT-018: No Loading Skeleton Files
- **ID:** DEFECT-018
- **Title:** No `loading.tsx` files for route-level loading states
- **Severity:** P3 Low
- **Domain:** All routes
- **Route:** All `/dashboard/*`
- **Action:** Navigate between routes
- **Symptom:** No loading indicator during route transitions
- **Expected:** Skeleton loading UI
- **Actual:** Blank until component renders
- **Ownership Phase:** AH-3G

### DEFECT-019: Dead Code in Settings (getProviderIcon)
- **ID:** DEFECT-019
- **Title:** `getProviderIcon()` function returns null and is never called
- **Severity:** P3 Low
- **Domain:** Settings
- **Route:** `/dashboard/settings`
- **Action:** N/A
- **Symptom:** Dead code
- **Ownership Phase:** AH-3G

### DEFECT-020: cn() Utility Redefined Locally
- **ID:** DEFECT-020
- **Title:** `cn()` utility function redefined in 5 page files instead of importing from `@techfusion/ui`
- **Severity:** P3 Low
- **Domain:** Code Quality
- **Route:** Multiple pages
- **Action:** N/A
- **Symptom:** Code duplication
- **Ownership Phase:** AH-3G

### DEFECT-021: Root Page Is a Dead End
- **ID:** DEFECT-021
- **Title:** Landing page `/` shows static content with no navigation to login or signup
- **Severity:** P3 Low
- **Domain:** Landing
- **Route:** `/`
- **Action:** Page load
- **Symptom:** Static "TechFusion AI" text, no buttons or links
- **Expected:** Link to login/signup
- **Actual:** Dead page
- **Ownership Phase:** AH-3F

---

## Defect Summary

| Severity | Count |
|----------|-------|
| P0 Critical | 0 |
| P1 High | 2 |
| P2 Medium | 8 |
| P3 Low | 11 |
| **Total** | **21** |
