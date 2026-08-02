# AH-3C.2B — Roadmap Ownership Map

**Project:** Tech Fusion AI
**Phase:** AH-3C.2B
**Date:** 2026-07-21

---

## AH-3D — Reports Completion

| Item | Type | Current Status |
|------|------|---------------|
| Report generation worker processor | Backend | Stub (sets status=generating, returns) |
| PDF generation integration | Backend | Generator exists, not called by worker |
| DOCX generation integration | Backend | Generator exists, not called by worker |
| HTML generation integration | Backend | Generator exists, not called by worker |
| Report file storage | Backend | Service exists, not called by worker |
| Report download with signed URLs | Backend | Endpoint exists, returns 404 |
| Report status lifecycle | Backend | PENDING→generating only |
| Report failure handling | Backend | Not implemented |

---

## AH-3E — Frontend API Integration Hardening

| Item | Type | Current Status |
|------|------|---------------|
| Server-side route protection (middleware.ts) | Frontend | Missing entirely |
| Settings page expansion (profile, MFA, notifications) | Frontend | Only AI config shown |
| MFA setup UI (enroll + verify) | Frontend | Backend exists, no UI |
| Organization settings UI | Frontend | No page exists |
| User profile editing UI | Frontend | No page exists |
| Error handling standardization across hooks | Frontend | Inconsistent |
| Loading state standardization | Frontend | Per-component only |

---

## AH-3F — Frontend Functional Completion

| Item | Type | Current Status |
|------|------|---------------|
| Dashboard hardcoded scores → real computation | Frontend | Hardcoded 23%/76% |
| Dashboard Quick Action button handlers | Frontend | Decorative only |
| Dashboard onboarding real download links | Frontend | Placeholder URLs |
| Cybersecurity PDF export with auth | Frontend | window.open() without token |
| Team invite flow | Frontend | Not implemented |
| Backup restore real progress bar | Frontend | Hardcoded w-2/3 |
| Report download (after AH-3D) | Frontend | 404 currently |
| KB semantic search wiring | Frontend | Hook exists, unused |
| AI chat conversation persistence | Frontend | No persistence |
| AI chat setup wizard for missing provider | Frontend | No guidance |
| Remote support control implementation | Frontend | Decorative buttons |
| Recording playback | Frontend | Not implemented |
| Root page `/` redirect or proper landing | Frontend | Dead end |
| Audit logs frontend page | Frontend | No page |
| Enrollment token management UI | Frontend | No page |

---

## AH-3G — UI/UX Finalization

| Item | Type | Current Status |
|------|------|---------------|
| Error boundaries (error.tsx) on routes | Frontend | None exist |
| Loading skeletons (loading.tsx) | Frontend | None exist |
| KB markdown rendering | Frontend | Plain text |
| Dead code cleanup (getProviderIcon, etc.) | Frontend | Dead code present |
| cn() utility consolidation | Frontend | Redefined in 5 files |
| Agent download link styling | Frontend | Placeholder |
| Responsive design review | Frontend | Acceptable but needs polish |
| Accessibility audit | Frontend | Basic compliance |
| Dark mode consistency | Frontend | Generally consistent |

---

## AH-3H — End-to-End Acceptance

| Item | Type | Current Status |
|------|------|---------------|
| Full E2E user journey test | Test | Not implemented |
| Cross-tenant isolation test | Test | Verified manually in AH-3C.2A |
| RBAC enforcement test | Test | Not automated |
| WebSocket integration test | Test | Not automated |
| Performance baseline test | Test | Not implemented |

---

## AH-3I — Beta/Production Hardening

| Item | Type | Current Status |
|------|------|---------------|
| Real Stripe price IDs | Config | Placeholder values |
| Docker Compose production config | Infra | Not created |
| Database migration execution script | Infra | Partial |
| Environment variable validation | Infra | .env.example exists |
| Health check verification | Infra | Endpoints exist |
| Rollback plan | Infra | Not documented |

---

## New Phase Recommendation: AH-3AI — AI Provider Platform

| Item | Type | Current Status |
|------|------|---------------|
| AI provider configuration UI | Frontend | No settings for keys |
| Provider API key management | Backend | Env vars only |
| Model selection interface | Frontend | No UI |
| Provider health monitoring | Backend | Exists but no UI setup |
| Cost tracking and usage display | Frontend | Backend exists, limited UI |
| Chat history persistence | Backend+Frontend | Not implemented |
| AI troubleshooter integration with KB | Backend | Partial (citations exist) |
| Provider fallback configuration | Backend | Exists in router |
| AI usage quotas per plan | Backend | Exists in plan features |

### Rationale for Separate Phase

AI completion spans multiple domains:
1. **Configuration**: Provider key management, model selection, testing
2. **Frontend**: Setup wizard, usage dashboard, cost display
3. **Backend**: Chat persistence, quota enforcement, fallback configuration
4. **Integration**: KB semantic search, device context enrichment

This is a distinct product domain that doesn't fit cleanly into:
- AH-3E (integration hardening) — requires new UI components
- AH-3F (functional completion) — distinct domain
- AH-3D extension — conflates reports with AI

A dedicated AH-3AI phase allows focused work on the complete AI platform experience.

---

## Execution Order Recommendation

```
1. AH-3D    — Report generation (unblocks report download)
2. AH-3E    — Integration hardening (auth, settings, error handling)
3. AH-3AI   — AI provider platform (chat, config, usage)
4. AH-3F    — Functional completion (remaining frontend features)
5. AH-3C.6  — Agent final acceptance (network discovery, remote control)
6. AH-3C.3  — Inventory pipeline (inventory data population)
7. AH-3C.4  — Security pipeline (security data population)
8. AH-3G    — UI/UX polish (error boundaries, skeletons, a11y)
9. AH-3H    — End-to-end acceptance (comprehensive testing)
10. AH-3I   — Beta/production hardening (Stripe, Docker, infra)
```
