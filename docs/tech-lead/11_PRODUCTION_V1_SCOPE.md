# 11 — Production V1 Scope

Definition of a realistic TechFusion AI Production V1, derived from the evidence in `00`-`10`. Priorities: security, device reliability, monitoring, tenant isolation, billing correctness, operational reliability, Linux support, Windows support, usable UX.

## P0 — Required for public/paid V1

1. **Fix SSO login bypass** (S1) — server-side IdP assertion verification, or disable the route until real SAML/OIDC integration. (Security gate.)
2. **Tenant isolation hardening** — resolve RLS: either implement transactional `set_config` + non-owner role + `FORCE ROW LEVEL SECURITY`, or remove decorative policies and add a cross-tenant isolation regression test suite covering every controller's orgId scoping. (Security gate.)
3. **Device credential hygiene** — remove plaintext `deviceToken` fallback after full backfill to `deviceTokenHash`; rotation sweep for legacy devices.
4. **Billing correctness** — enforce `maxTeamMembers` and `maxAlertRules`; consolidate quota checks; extend downgrade/webhook integration tests; self-serve plan change UX.
5. **Entitlement architecture** — implement `UsageService`/`assertLimit` and `Plan → Subscription → Entitlements → Limits → Server authorization → UI state` per `09`.
6. **Fix KB embedding + REPORT queue** — add real `POST /ai/embed` route (or point worker at KB embedding service) so embeddings are real; wire or remove the REPORT queue and fix worker delegation path.
7. **Windows agent MVP** — service lifecycle (SCM), installer, secure credential storage (DPAPI/Credential Manager), metrics, network/inventory/security adapters, updates, code signing, x64 (+arm64) targets. (Requires the platform-adapter split from `05`.)
8. **Agent self-update** — signed, atomic self-update with version reporting so the server can track fleet versions.
9. **Operational reliability** — fix Helm chart (T1-T4) so staging/production CD actually deploys; CI GitHub-native green run.
10. **Core UX hardening** — remote-support real control or explicit "pending" state; audit-log viewer; retention settings UI; empty/error states on all P0 pages.

## P1 — Important but can follow

1. Network diagnostics + topology polish; discovery scheduling UX.
2. Security reporting (executive summary, remediate workflow) UI depth.
3. Recordings/Viewer (real player).
4. Report schedules (async path) + branding.
5. Admin console (web).
6. Notification center (in-app) + webhook management UI.
7. AI provider config admin UI + cost dashboard.
8. Monitoring retention tiering and plan-tiered retention enforcement.
9. MFA recovery codes + enrollment flow polish.
10. Performance: large-fleet dashboard queries, presence sweep scalability.

## P2 — Post-V1 / advanced

1. Multi-organization per user; cross-org analytics.
2. Real remote desktop protocol (TURN/WebRTC) with consent UX.
3. Agent full control surface (screen capture, input injection) — gated.
4. AI auto-remediation / autonomous troubleshooting.
5. Marketplace/integrations (SSO OIDC/SAML full, email, ITSM).
6. Object-storage-backed reports/recordings (S3).
7. Mobile/web push notifications.
8. Enterprise on-prem / air-gapped deployment.

## Scope Protection Rules

- Do not classify every idea as P0. P0 is bounded by: security, tenant isolation, billing correctness, Linux+Windows device reliability, monitoring, and CD being actually deployable.
- The Windows agent is P0 only because "Linux AND Windows production support" is an explicit mission requirement; if founder re-scopes, move to P1.
- Feature pages without backend defects (audit viewer, admin UI, notification center) are P1 — they do not block a paying customer base, but their absence degrades the "usable UX" P0 criterion; decisions in `14`.
