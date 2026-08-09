# 14 — Decision Log

Chronological record of architectural and governance decisions. First entry covers the V1-MASTER-ROADMAP-00 discovery mission (2026-08-09).

| # | Date | Decision | Rationale | Status |
|---|------|----------|-----------|--------|
| D1 | 2026-08-09 | Documentation-only discovery mission; no product code changed, no refactors, no deletions. | Mission mandate; evidence must precede change. | ✅ Done |
| D2 | 2026-08-09 | `docs/tech-lead/` is the authoritative technical-lead documentation area; legacy root `TF_*.md` reports and `TECHFUSION_V1_READINESS_AUDIT.md` are historical, not authoritative. | Single source of truth; avoid duplicate conflicting docs. | ✅ Done |
| D3 | 2026-08-09 | Highest commercial tier is referenced as `PREMIUM_TIER_PLACEHOLDER`; the internal name "GM1" is not used as a commercial name. | Founder will rename; no hard-coded prices. | ⏳ Open (founder names tier) |
| D4 | 2026-08-09 | V1-STAGE-01 (security/tenancy/credentials) is the next stage; SSO remediation is the first substage. | S1 is an active auth bypass and gates everything. | ⏳ Pending implementation |
| D5 | 2026-08-09 | RLS decision deferred to Stage 01: either implement (transactional `set_config` + non-owner role + FORCE) or remove decorative policies + app-layer isolation suite. | RLS is inert today; both options are valid with different risk. | ⏳ Open (founder/AI lead decision at Stage 01) |
| D6 | 2026-08-09 | Windows agent is P0 because "Linux AND Windows production support" is an explicit launch requirement. | Mission constraint. Founder may re-scope to P1. | ⏳ Open (founder) |
| D7 | 2026-08-09 | Stage ordering differs from the brief: identity/RBAC moved into existing certified base (not a new early stage); deploy/CD reliability and billing moved earlier; Windows placed after fleet-reliability groundwork. | Evidence shows RBAC/membership already certified; CD is undeployable; billing gaps are paid-launch gates. | ✅ Accepted |
| D8 | 2026-08-09 | Free-tier feature surface (whether network/inventory/security are free or PRO) requires founder sign-off before Stage 03 entitlement work. | Current `PLAN_CONFIGS` does not gate these; the mapping is a commercial decision. | ⏳ Open (founder) |
| D9 | 2026-08-09 | No commit of `apps/api-gateway/.env.test`; it remains untracked (test placeholders). | Working-tree hygiene; gitignore exception is intentional. | ✅ Accepted |
| D10 | 2026-08-09 | One documentation-only commit created for this mission. | Isolated clean docs change; per git safety rules. | ✅ Done |
| D11 | 2026-08-09 | **SSO strategy (founder): do NOT implement real SAML/OIDC for Production V1. Disable the unsafe `POST /auth/sso/login` path FAIL-CLOSED.** The incomplete login must never issue a session from client-supplied identity. SSO domain/database architecture (SsoConfig, admin config routes, User.sso*) is preserved for a future real implementation. | S1 is an active P0 auth bypass; real IdP verification is out of scope for this substage. | ✅ Done (`V1-STAGE-01-SUB-01`) |
| D12 | 2026-08-09 | Fail-closed mechanism = keep the `POST /auth/sso/login` route registered and `@Public()`, but have `SsoService.ssoLogin` throw a deterministic `501 Not Implemented` BEFORE touching any data (no org/config/user reads → zero information leak; slug/enabled/existence indistinguishable). Route removal rejected: preserving the route keeps an intact contract for the future SAML/OIDC implementation, and 501 is a better client contract than 404. Insecure code (`generateRefreshToken`, `ensureMembership`, imports) deleted so the exploit cannot be re-triggered by any caller. | Deterministic, safe, architecture-preserving; consistent with NestJS error architecture. | ✅ Done |
| D13 | 2026-08-09 | SSO is classified **DISABLED_SAFE** (not CERTIFIED). Re-enablement is gated on a future substage implementing the verification contract in `V1-STAGE-01-SUB-01_SSO_REMEDIATION_REPORT.md` §7 (OIDC issuer/audience/JWKS/exp/nonce+PKCE; SAML signature/issuer/audience/destination/validity/replay; JIT + linking only after verified identity). | Avoids a false "certified" claim; SSO must not be marketed/used until verified. | ✅ Done |

## Open Founder Decisions

1. **Tier naming** — rename `PREMIUM_TIER_PLACEHOLDER` (D3).
2. ~~**SSO strategy** — disable route vs. implement real SAML/OIDC (D5 sibling; Stage 01-SUB-01).~~ **DONE — disable fail-closed (D11/D12).** Remaining: decide when to schedule a real SAML/OIDC verification substage (future; not P0 for this substage).
3. **RLS strategy** — implement vs. remove (D5).
4. **Windows scope** — confirm P0 or move to P1 (D6).
5. **Free-tier feature surface** — network/inventory/security on Free? (D8).
6. **Remote support V1 shape** — consent-gated real control vs. explicit "pending" state (Stage 06).

## Appended After This Mission

This log is the canonical place for future substage decisions; each completed stage appends a row.
