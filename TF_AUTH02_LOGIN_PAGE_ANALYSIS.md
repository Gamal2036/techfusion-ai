# TechFusion-AI — AUTH-02
# Login Page Engineering & UX Analysis

| | |
|---|---|
| **Phase** | Analysis |
| **Priority** | CRITICAL |
| **Status** | Documentation Only |
| **Scope** | `/login` route — current implementation analysis |
| **References** | TG-1A Brand Identity Foundation · TG-2A Design System Foundation · TG-2X Design System Extensions · AUTH-01 (Register Page Analysis) · AUTH-01B (Register UI Modernization) |
| **Date** | 2026-08-01 |

---

> This document is the official analysis reference for AUTH-02. It describes the
> current Login page implementation only. It proposes **no** redesign, code, or
> implementation changes. Every observation is evaluated against TG-1A, TG-2A,
> TG-2X, and the quality bar established by AUTH-01/AUTH-01B (the Register page).

---

## SECTION 1 — PAGE PURPOSE

### 1.1 Primary purpose
The Login page (route `/login`) is the **re-entry point** of the platform. It
authenticates an existing user (email + password) and, when the account has
two-factor authentication enabled, completes a second-step TOTP challenge. It
is the inverse mirror of the Register page: acquisition happens on `/signup`,
return becomes `/login`.

Implementation: `apps/web/src/app/login/page.tsx` — a **single, self-contained
116-line client component** that contains state, submission logic, the MFA
sub-step, error handling, and all markup inline. There is no page-local
component directory (contrast: `/signup` decomposes into ten modules under
`apps/web/src/components/signup/`).

### 1.2 User goal
A returning user enters email + password, is authenticated, and reaches
`/dashboard` in as few steps as possible. If MFA is enabled, the user completes
one focused 6-digit code step instead of re-entering credentials.

### 1.3 Business goal
Sustain the returning-user session loop with minimal friction and maximal
trust. Per TG-1A §17, authentication is the **first trust moment**; per TG-2X
§4.1.1 it "must be calm, fast, and honest, and it must never look like the
product is selling or celebrating." Login carries no acquisition burden — it
must simply work and never alarm.

### 1.4 Primary action
Submit credentials → `POST /auth/login` → token storage → redirect to
`/dashboard` (or `POST /auth/verify-login` when MFA is required).

### 1.5 Secondary actions
- Cross-link to `/signup` ("Don't have an account? Sign up").
- MFA code entry (second step).
- (Absent today, see §7: show-password toggle, "Forgot password", "Remember me",
  SSO entry — all described in TG-2X §4.1.2/§4.1.3 as standard login actions.)

### 1.6 Expected success criteria
- Valid credentials → 200 → tokens stored → redirect to `/dashboard`.
- MFA-enabled account → challenge step → valid TOTP → tokens → `/dashboard`.
- Invalid credentials → calm, honest, single error surface; **no field revealed
  as the offender**; form state preserved.
- Never a dead end: every failure keeps the user on-screen with a path forward.
- Rate limiting holds (5 req/min login, 10 req/min verify-login).
- The page reaches the same design-system quality as AUTH-01 (parity target).

---

## SECTION 2 — CURRENT USER FLOW

```
Landing page (marketing)
   │  Navbar "Sign in" → /login        (Navbar.tsx:82,138)
   ▼
/login  (LoginPage — single centered glass card)
   │  h1 "Welcome back" + subtitle + email + password + Sign In
   ▼
CREDENTIALS — email (type=email, required) → password (type=password, required)
   │  no autocomplete, no name, no toggle, no client checks beyond native required/type
   ▼
VALIDATION — native browser validation only (required, email format)
   │  no inline per-field errors; no form-level gate
   ▼
LOADING — Button disabled={loading}; label + icon stay static (no spinner,
   │   no aria-busy); inputs remain ENABLED
   ▼
AUTHENTICATION
   │  POST {API_URL}/auth/login {email, password}
   │  Server: LoginDto (IsEmail/IsNotEmpty) → prisma findUnique(email) →
   │          bcrypt.compare → isMfaEnabled?
   ▼
MFA CHALLENGE (if user.isMfaEnabled)
   │  response { mfaRequired: true, userId }
   │  form swaps to a single "MFA Code" field (maxLength 6, autoFocus)
   │  POST {API_URL}/auth/verify-login {userId, token} → speakeasy.totp.verify
   ▼
SUCCESS → setTokens(accessToken, refreshToken) → router.push('/dashboard')
   │        dashboard/layout.tsx re-checks getCurrentUser()/isAuthenticated()
   ▼
FAILURE → catch(err) → setError(err.message) → red-tinted inline banner
   │        inputs preserved; no navigation
   ▼
RECOVERY / EXIT → "Don't have an account? Sign up" → /signup
   │        (no "Forgot password" affordance — endpoint does not exist anywhere)
```

**Entry points confirmed:** `apps/web/src/components/landing/Navbar.tsx:82,138`
(desktop + mobile "Sign in"). The landing **hero primary CTA routes to
`/signup`** (`HeroCTA.tsx:20`), not `/login` — consistent with TG-2X §4.1.3
("first action is sign-in") only in that sign-up is never the *sole* option;
the hero itself is inverted from the recommended default (already recorded in
AUTH-01 §11, Medium).

**Notable flow gaps:**
- **No redirect for already-authenticated users** visiting `/login` — a user
  with a live session can log in again and overwrite tokens.
- **No session-expiry warning** — when a 401 fires, `auth-client.ts` silently
  clears tokens and hard-redirects to `/login` (`apiFetch`, line 128). TG-2X
  §4.1.2 requires a "session-expiry warning (never silent destruction of
  state)". This is inherited from the auth architecture, not the page, and is
  out of UI scope, but it must be on record.
- **No password recovery path exists at all** (frontend *and* backend) — the
  "Forgot password" affordance cannot be added by UI alone; it requires a
  backend contract.

---

## SECTION 3 — LAYOUT ANALYSIS

### 3.1 Overall structure
A single full-screen (`min-h-screen`) centered panel: outer flex
(`items-center justify-center bg-background p-4`) wrapping one `GlassPanel`
(`w-full max-w-sm p-8`). No split, no brand panel, no header/footer, no
secondary column.

### 3.2 Grid
No grid system in use. The card is 384px wide (`max-w-sm`), which satisfies the
TG-2X §4.1.2 form-width rule (form ≤ 480px) but the surrounding **split-auth
anatomy is absent** — TG-2X §4.1.2 defines the login surface as
"Brand panel (left, desktop) + Form (right, ≤ 480px)", and the Register page
(AUTH-01B) delivers exactly that. Login is a floating card instead.

### 3.3 Sections (top→bottom)
1. Outer surface (`bg-background` token — the only tokenized surface value).
2. Glass card → h1 + subtitle → error banner (conditional) → email field →
   password field → submit button → sign-up link.

### 3.4 Spacing
- Form rhythm `space-y-5` (20px between controls) — above the TG-2A §9 ≥16px
  control-to-control rule; acceptable.
- Label→input `space-y-1.5` (6px) — **below** the 8px spec (same defect
  recorded on the pre-modernization Register page, AUTH-01 §3.5).
- Card padding `p-8` (32px) — panel padding spec is 24px standard; 32px is
  acceptable for a single-CTA auth panel but is not a token value.
- All values are ad-hoc Tailwind utilities, not spacing tokens.

### 3.5 Alignment & visual hierarchy
- Hierarchy: h1 (white, 24px bold) → subtitle (white/40) → labels → primary
  button → footer link. Direction is correct (action verb at the CTA).
- **Single column, no left/right tension** — the page reads as "floating modal"
  rather than a composed screen. There is no `h1`-level brand statement, no
  logo, and no visual anchor; the empty surface around a small dark card does
  not communicate the enterprise platform brand.

### 3.6 Responsive behavior
- No breakpoint-specific layout at all — the same single-column centered card
  renders at every width. On desktop this is under-composed (no brand panel per
  §4.1.2); on tablet/mobile it is functionally correct (centered card, 16px
  gutters) though it lacks the mobile logo lockup the Register page provides.
- Inputs render at default `md` height (`h-10` = 40px) on all breakpoints —
  below the 44px touch target (AUTH-01B adopted `h-11`).
- No horizontal overflow risk; no tablet-specific reflow needed since there is
  nothing to reflow.

### 3.7 Balance
- Desktop: empty, unbalanced — one small card floating in a large dark canvas.
- Mobile: reasonable, card nearly fills the viewport width.

---

## SECTION 4 — COMPONENT INVENTORY

All UI is inline in `apps/web/src/app/login/page.tsx` (116 lines). There are no
page-local components.

| # | Element | Source | Role / Notes |
|---|---|---|---|
| 1 | `GlassPanel` | `@techfusion/ui` (Card.tsx) | Card surface — `rounded-xl border backdrop-blur-xl shadow-glass`, `bg-surface-subtle`. Glassmorphism: forbidden aesthetic (see §6). |
| 2 | `Input` | `@techfusion/ui` | Email + password + MFA code fields. `label` prop unused; page renders its own unassociated `<label>`. |
| 3 | `Button` | `@techfusion/ui` | Submit (`w-full gap-2`, `disabled={loading}`). `loading` prop unused. |
| 4 | `LogIn` | lucide-react | Decorative submit icon (aria-hidden by default in lucide-react). |
| 5 | h1 "Welcome back" | inline | `text-2xl font-bold text-white tracking-tight`. |
| 6 | Subtitle | inline | `text-sm text-white/40` — "Sign in to TechFusion AI". |
| 7 | Email label + field | inline + Input | `text-xs font-medium text-white/50` label; `type=email`, `placeholder="you@company.com"`, `required`. **No `htmlFor`, no `id`, no `name`, no `autoComplete`.** |
| 8 | Password label + field | inline + Input | Same label pattern; `type=password`, `required`. **No toggle, no autocomplete.** |
| 9 | Error banner | inline | `rounded-lg bg-red-600/10 border border-red-500/20 px-4 py-2.5` + `text-red-400`. **No `role="alert"`, no `aria-live`.** |
| 10 | MFA Code field | inline + Input | Shown when `mfaRequired`; `maxLength={6}`, `autoFocus`. **No `inputMode="numeric"`, no `autoComplete="one-time-code"`, no label association.** |
| 11 | Sign-up cross-link | `Link` | `text-primary-400 hover:text-primary-300` → `/signup`. |
| 12 | `setTokens`, `getApiUrl` | `@/lib/auth-client` | Shared auth primitives (correct reuse). |

**Absent components:** logo lockup, brand panel, password reveal toggle,
Remember Me checkbox, Forgot Password link, divider, social/SSO entry, cap-lock
hint, inline field errors, loading spinner state, success state, required
legend, back-to-site link.

**Duplication/underuse:** the page re-implements labeling, error presentation,
and loading wiring that the shared package already provides and that AUTH-01B
standardized: `Card`, `Alert` (`role="alert"`), `PasswordInput` (44px toggle,
focus-retention), `Label`, `FormField`, `FieldMessage`, `Button loading`. The
page uses `GlassPanel` (the aesthetic AUTH-01B removed) instead of `Card` (what
AUTH-01B adopted).

---

## SECTION 5 — UX REVIEW

### 5.1 Ease of use
Low-friction at the surface: two fields, one button, one clear path. The MFA
sub-step is well executed — a single focused field, `autoFocus`, and the submit
button relabels to "Verify MFA" (TG-2X §4.1.3 "2FA is a step, not a maze").
The lack of a password reveal toggle and any recovery path, however, leaves two
of the three most common help-searches on the login screen unanswered.

### 5.2 Cognitive load
Very low — this is a strength. There is no feature advertising, no decoration,
no competing content (compliant with TG-2X §4.1.4 "don't use: feature
advertisement on the auth screen").

### 5.3 Visual flow
Linear and predictable (headline → fields → button → link). The error banner
sits between the header and the fields, which is acceptable placement.

### 5.4 Readability
- Headline: strong (white on near-black).
- Subtitle `white/40`: ~3.0:1 — **fails WCAG AA** for normal text.
- Labels `white/50`: ~3.8:1 — **fails AA**.
- Footer `white/30`: ~2.5:1 — **fails AA**.
- Placeholders (`input-placeholder` token via shared Input): acceptable.

### 5.5 CTA visibility
The primary button is the strongest element on the page (default primary
variant). It does not use the `loading` spinner state, so during a slow request
the button simply greys out (opacity-50) with static content — a weak "working"
signal.

### 5.6 Navigation & trust
- No dead ends on the happy path.
- The "Invalid email or password" server message is **correctly generic** —
  it does not reveal which field failed (TG-2X §4.1.3: "without revealing which
  field was wrong (security)"). This is a deliberate security copy choice to
  preserve.
- Missing: a "Forgot password" escape hatch and an already-signed-in guard.

### 5.7 Professionalism / brand consistency
The page is minimal but **under-branded**: no logo, no product identity mark,
generic headline, floating glass card on a bare canvas. The Register page
(AUTH-01B) establishes the brand panel + calm promise + logo lockup as the
auth-surface standard; Login does not meet it.

---

## SECTION 6 — VISUAL REVIEW (vs TG-1A / TG-2A / TG-2X)

### 6.1 Colors — NON-COMPLIANT
| Current usage | TG standard |
|---|---|
| Surface `bg-background` token | Correct (only tokenized value on the page) |
| Headline `text-white` | `text-primary` semantic token; never raw white for text |
| Subtitle `text-white/40`, labels `text-white/50`, footer `text-white/30` | `text-secondary`/`text-muted`; **never opacity-derived text** (TG-2X §1.9.4) |
| Error banner `bg-red-600/10`, `border-red-500/20`, `text-red-400` | `danger`/`status-critical` tokens; status = icon + label + color, never color alone |
| Link `text-primary-400` (hard-coded `#60a5fa`, legacy blue scale) | `action-primary`/signal tokens (`signal-500 #2B62F0` dark) |
| No light-theme handling on any hard-coded value | TG-2A requires light as first-class; `text-white/*` would break on a light surface |

### 6.2 Typography — NON-COMPLIANT
- Headline `text-2xl` (24px) bold — spec for the login action headline is the
  H1 scale (`text-h2`/display token, 600 max weight). `tracking-tight` is fine.
- Labels `text-xs` (12px) — `text-label` is **13px** (TG-2X §1.3.4: never below
  13px body on mobile).
- Subtitle/footer `text-sm` (14px) — size ok, color fails (§6.1).
- Font: app-wide Inter fallback stack (`layout.tsx` body rule); TG-1A/TG-2A
  specify IBM Plex Sans — inherited platform gap, recorded in AUTH-01 §6.2.

### 6.3 Cards / surface — NON-COMPLIANT
`GlassPanel` = `backdrop-blur-xl` + `shadow-glass` + translucent
`bg-surface-subtle`.
- TG-2X §6.6.9 lists **"glass" as a forbidden aesthetic**.
- TG-2A core metaphor: matte layered panels, crisp 1px edges, minimum blur;
  backdrop blur is **overlay-only** (TG-2X §1.8.2, §3.16.2).
- AUTH-01B removed exactly this surface from the Register page in favor of the
  solid `Card`. Login still ships it.
- Functionally, the blur is also a no-op: `backdrop-blur-xl` over a solid
  `bg-background` has nothing meaningful to blur — it only adds compositing
  cost (§9).

### 6.4 Buttons — PARTIALLY COMPLIANT
- Default `md` height `h-10` (40px) — spec `lg` submit is 44px; AUTH-01B used
  `size="lg"` + `h-11 rounded-sm`.
- Radius `rounded-lg` (8px) — spec for buttons is `radius-sm` **6px**.
- Colored-glow shadow absent here (good — the `Button` primary variant ships
  `shadow-primary-600/20`; the page does not override it, so the glow is still
  present on the CTA).
- `gap-2` + child icon: should use the `leftIcon` prop so the icon is
  spacing-consistent and the label stays a single text node.
- Verb "Sign In" is correct.

### 6.5 Inputs — PARTIALLY COMPLIANT
- Radius `rounded-lg` (8px) — spec **6px** (`radius-sm`).
- Height `h-10` (40px) — spec 36/44 token scale; below the 44px touch target.
- Background/border/focus ring from shared `Input` tokens — **correct**
  (`input-background`, `input-border`, `focus-visible:ring-2 ring-ring`).
- No left icons, no `name`/`autocomplete`, and the labels are unassociated (§8).

### 6.6 Radius — NON-COMPLIANT
Panel `rounded-xl` (12px) + inputs/button `rounded-lg` (8px) + error banner
`rounded-lg`. TG-2A §10: inputs/buttons **6px**, panels **12px**, one radius
per surface. (AUTH-01B's register card + inputs both landed on `rounded-sm`/
`rounded-lg` for panel — Login mixes 8px and 12px.)

### 6.7 Shadow — NON-COMPLIANT
`shadow-glass` (`0 8px 32px rgba(0,0,0,0.3)`) on the panel + the primary button
glow. Spec: two-layer neutral `shadow-sm` ceiling on panels, no colored/glowing
shadows (TG-2A §11.3, TG-2X §1.7.2). AUTH-01B removed all glass shadows from
Register.

### 6.8 Motion — COMPLIANT (by absence)
There is **no animation** on the Login page — no entrance, no idle loop, no
decorative motion. This satisfies TG-2X §3 reduced-motion and TG-1A §456
(quiet) trivially. It is the one visual category the page gets fully right.

### 6.9 Icons — COMPLIANT
`LogIn` is the correct sign-in affordance, `h-4 w-4` (16px = `size-icon-sm`),
aria-hidden by lucide-react default.

### 6.10 Brand identity — NON-COMPLIANT
- No logo, no brand panel, no promise line. TG-2X §4.1.2 anatomy calls for a
  brand panel (left, desktop) with an instrument-surface composition.
- Copy "Sign in to TechFusion AI" — TG-1A §629 prefers the brand vocabulary
  **"TechFusion-AI"** / "TechFusion Platform" (hyphenated). Same defect flagged
  on the old Register page (AUTH-01 §6.10).
- The floating glass card reads as "generic SaaS demo", not the
  calm/precise/honest instrument surface TG-1A §13 defines.

---

## SECTION 7 — FORM ANALYSIS

### 7.1 Fields
| Field | Type | autocomplete | name | Client validation |
|---|---|---|---|---|
| Email | email | **absent** | absent | native `required` + `type=email` only |
| Password | password | **absent** (should be `current-password`) | absent | native `required` only |
| MFA Code | text (`maxLength 6`) | **absent** (should be `one-time-code`) | absent | `maxLength` only |

TG-2X §4.1.3 mandates `autocomplete` correctness (§18.4); AUTH-01B wired
`email`/`name`/`new-password` on every Register field. Login has **zero**
autocomplete attributes — the browser cannot offer saved credentials, and
screen-reader/autofill semantics are degraded. This is the single highest-value
form-hygiene fix available (pure markup, no logic change).

### 7.2 Validation
- **Client:** native browser validation only (required, email format). No
  inline per-field errors, no blur/submit checks, no `noValidate` + compensating
  checks (as AUTH-01 recommends), no custom messaging.
- **Server:** `LoginDto` (`@IsEmail`, `@IsNotEmpty` on both fields) →
  `prisma.findUnique(email)` → `bcrypt.compare`. Errors are `401
  UnauthorizedException('Invalid email or password')` — deliberately
  non-revealing (keep).
- **Failure UX gap:** server validation errors (e.g., class-validator
  "email should not be empty") surface as a single raw banner in the red-tint
  div, not inline per-field (TG-2A §25.4).

### 7.3 Error messages
- Copy is passed straight from `data.message` (raw `err.message`). For the
  generic 401 the copy is already calm and security-correct; for DTO/network
  failures it is raw and unmapped.
- Banner styling uses hard-coded red translucency rather than `danger` tokens
  and the `Alert` component, and lacks `role="alert"` (§8).
- No retry/next-step guidance beyond the message itself (TG-2A §33 pattern
  `[What happened] — [why it matters]. [Next step].`).

### 7.4 Loading state — NON-COMPLIANT
- Button uses `disabled={loading}` instead of the shared `Button` `loading`
  prop: no spinner, no `aria-busy`, no `loadingText` ("Signing in…").
- **Inputs are not disabled during submission** — the user can edit credentials
  mid-flight, and a second submit is only blocked by the disabled button.
- AUTH-01B's register flow (spinner + "Creating account…" + `aria-busy` +
  all inputs locked) is the parity target; Login is well behind it.
- The `finally { setLoading(false) }` correctly resets state on both MFA and
  login paths — good.

### 7.5 Disabled state
No persistent disabled field present (no case needs it). The submit disabled
state uses opacity-50 via the shared Button — acceptable visually, incomplete
functionally (see 7.4).

### 7.6 Password toggle — ABSENT
No show/hide affordance. TG-2X §4.1.3 lists "password reveal toggle" under
**Security UX**; AUTH-01B ships a 44×44 toggle that retains focus and cursor
position. Login must match it. (Shared `PasswordInput` exists and is not used.)

### 7.7 Remember Me — ABSENT
No "remember me" control. The session model is token-based in `localStorage`
with a sliding refresh; a persistent-session choice is a **product decision**,
but the current absence of any control means the option silently doesn't exist.
Recorded as product input needed, not a UI-only fix.

### 7.8 Forgot Password — ABSENT
No recovery affordance and **no backend endpoint exists anywhere**
(`/auth/forgot-password` / `/auth/reset-password` were not found). This cannot
be fixed in UI alone; it is an API + product dependency. Per TG-2X §4.1.2,
"Forgot password (link)" is a standard anatomy element — flag for the AUTH-02
spec to scope with the backend.

### 7.9 MFA step
Conceptually strong (single field, `autoFocus`, relabeled CTA). Gaps: no
`inputMode="numeric"`, no `autoComplete="one-time-code"` (browsers can offer
SMS OTP autofill), no "resend/back" recovery affordance, no explanation line
("Enter the 6-digit code from your authenticator app"), and the same
unassociated-label + no-`role` issues as the main form.

### 7.10 Autofill/autocomplete
Covered in §7.1 — the defining defect of this form.

---

## SECTION 8 — ACCESSIBILITY

### 8.1 Structure (good)
- One `h1` per page (auth pages are exempt from strict landmark requirements,
  but the h1 exists and is descriptive).
- All controls are native elements (`form`, `input`, `button`, `a`).
- Focus ring: shared `Input` provides `focus-visible:ring-2 ring-ring`; the
  global `*:focus-visible` rule in `globals.css` covers the link. Visible focus
  exists on all interactive controls.
- Icon is aria-hidden (lucide default).

### 8.2 Failures
| # | Defect | Severity | Standard |
|---|---|---|---|
| 1 | **Label association broken** — `<label>` has no `htmlFor` and inputs are rendered with an internally generated `useId` that the label never references. No programmatic label↔input association; clicking a label does not focus the field; screen readers get unassociated text. | Critical | WCAG 1.3.1 / TG-2A §25 |
| 2 | **Error banner lacks `role="alert"`** — dynamic errors are not announced to screen readers. AUTH-01B uses the shared `Alert` (role=alert). | High | WCAG 4.1.3 / TG-2A §33 |
| 3 | **Contrast failures** — `white/40` subtitle (~3.0:1), `white/50` labels (~3.8:1), `white/30` footer (~2.5:1). All fail AA 4.5:1 for normal text. | High | WCAG 1.4.3 |
| 4 | **Touch targets 40px** — inputs (`h-10`) and submit (`md` size) below 44px. AUTH-01B standard is 44px (`h-11`). | High | WCAG 2.5.5 / TG-2A §46 |
| 5 | **No name/autocomplete attributes** — breaks browser password-manager and autofill support (§7.1). | High | TG-2A §18.4 |
| 6 | **No password reveal** — visually-impaired users on shared devices lose the standard workaround for typo-checking. | Medium | TG-2X §4.1.3 |
| 7 | **No reduced-motion concern** — page is static; no motion to gate. Non-issue here (contrast: Register had to fix this). | — | — |
| 8 | No skip link / minimal landmarks | Low | TG-2A §41 (auth pages exempted) |

### 8.3 Keyboard flow
Tab order = visual order: email → password → submit → sign-up link. All native.
No focus trap needed (not a modal). The MFA `autoFocus` correctly moves focus to
the code field on step switch.

### 8.4 Screen-reader summary
Readable structure but degraded by the unassociated labels, unannounced
errors, and absence of autofill semantics. Below the AUTH-01B standard.

---

## SECTION 9 — PERFORMANCE

### 9.1 Rendering cost
Very low. One controlled-input form, tiny state, no data fetching on render,
no lists, no images, no fonts beyond the shared stack, no third-party motion
library on this route. Re-renders are trivial.

### 9.2 Animations
None. Zero animation cost, zero reduced-motion risk — the strongest perf
posture of any auth surface in the app.

### 9.3 CSS complexity
Low, with one waste: **`backdrop-blur-xl` on `GlassPanel`** computes a blur over
an opaque `bg-background` that has nothing behind it — pure compositing cost
with zero visual payoff. Replacing the glass surface with the solid `Card` (as
AUTH-01B did) removes it for free.

### 9.4 Bundle impact
Minimal: `@techfusion/ui` (already app-wide), `lucide-react` `LogIn`
(tree-shaken), `next/navigation`. No `framer-motion`, no canvas, no charts. The
route's client bundle is near-flat.

### 9.5 Interaction delay
Single network round-trips per step (`/auth/login`, then `/auth/verify-login`).
No debouncing, no optimistic UI, no premature work. The only perceived-delay
issue is the weak loading affordance (§7.4).

### 9.6 Potential bottlenecks
None of note. The page is a best-case perf surface. Any modernization should
preserve this property (no decorative animation, no canvas, no bulk blur).

---

## SECTION 10 — ARCHITECTURE IMPACT

### 10.1 Files involved
- `apps/web/src/app/login/page.tsx` — the entire page (state + logic + markup).
- `apps/web/src/lib/auth-client.ts` — shared auth primitives (`setTokens`,
  `getApiUrl`); reused correctly.
- `packages/ui/src/components/{Input,Button,Card,GlassPanel}.tsx` — consumed
  components. `GlassPanel` is the only one outside current design governance.
- `apps/web/src/app/globals.css` + `tailwind.config.js` — token definitions the
  page partially bypasses (hard-coded white/red/primary-400 values).
- Backend (read-only reference): `apps/api-gateway/src/auth/{auth.controller,
  auth.service}.ts`, `dto/{login,verify-login}.dto.ts` — contracts locked.

### 10.2 Shared components used vs available
Used: `Button`, `Input`, `GlassPanel`, `setTokens`/`getApiUrl`.
Available but unused: `Card`, `Alert`, `PasswordInput`, `Label`, `FormField`,
`FieldMessage`, `Button loading`, `useReducedMotion`.

### 10.3 Shared design tokens
Tokenized: outer `bg-background`, and everything inside shared `Input`/`Button`.
Hard-coded (bypassing tokens): `text-white`, `text-white/40`, `text-white/50`,
`text-white/30`, `text-primary-400`/`300`, `bg-red-600/10`, `border-red-500/20`,
`text-red-400`.

### 10.4 Dependencies
Frontend: `@techfusion/ui`, `lucide-react`, `next/link`, `next/navigation`,
`react`. No new/third-party surface dependencies. Backend auth is unchanged.

### 10.5 Architecture risk
- **Low risk to change:** the page is a self-contained monolith with no shared
  modules to regress; everything it does is already done better by shared
  components used on `/signup`.
- **Medium risk:** the MFA orchestration (challenge → verify) is the only real
  logic; it must be preserved byte-for-byte in any refactor.
- **Medium risk:** the unassociated-label markup means naive "drop in shared
  `Input` with `label` prop" is a *fix*, not a risk — but only if the shared
  `Input` is adopted with `id`/`name`/`autoComplete` props populated.
- **Contract risk (zero UI blame):** "Forgot password" and "Remember me"
  require backend/product decisions; the UI spec for AUTH-02 must not
  over-promise them.

---

## SECTION 11 — FILE IMPACT

### 11.1 Files allowed to change
- `apps/web/src/app/login/page.tsx` (or a new `apps/web/src/components/login/`
  decomposition mirroring the signup pattern).
- New test file under `apps/web/src/__tests__/` (none exists today).

### 11.2 Files recommended to change
- `apps/web/src/components/login/` (new, optional decomposition to match the
  signup structure AUTH-01B established).
- Nothing in `packages/ui` is required — the shared `Card`, `Alert`,
  `PasswordInput`, `Button loading` already cover the needs (AUTH-01B noted no
  UI package changes were needed for Register; same expectation here).

### 11.3 Files that must never change
- `apps/api-gateway/src/auth/**` — controllers, service, DTOs (login contract,
  MFA challenge, rate limits, generic error copy).
- `apps/web/src/lib/auth-client.ts` — `setTokens`/`getApiUrl`/`apiFetch`
  (shared; dashboard depends on it).
- `apps/web/src/app/dashboard/layout.tsx` — session guard (reads `/login` only
  as a redirect target string).
- Routes: `/login` path and `/signup` cross-link relationship.

### 11.4 Shared components regression risk
Low — the page consumes shared primitives and shares nothing outward. The only
shared surface touched indirectly is `GlassPanel` (if the panel is replaced by
`Card`; `GlassPanel` is also used by `HealthCard`/`StatCard`/`MetricCard`/
`DeviceCard`, so it must remain exported and unchanged even if the Login page
stops using it).

### 11.5 Regression risk summary
The change surface is one page + tests. Contract lock: login/verify-login
payloads, token storage, redirect behavior, generic 401 copy, rate limiting.

---

## SECTION 12 — DEPENDENCY GRAPH

```
/login (LoginPage — page.tsx)
   │
   ├── @techfusion/ui ──────────────────────────┐
   │    ├── Button (variant primary, md)         │
   │    ├── Input (type email / password / text) │
   │    └── GlassPanel (glass surface)           │
   ├── lucide-react → LogIn                      │
   ├── next/link → /signup                       │
   ├── next/navigation → router.push             │
   └── @/lib/auth-client ────────────────────────┤
        ├── getApiUrl()  → API base              │
        └── setTokens()  → localStorage          │
                                                 │
   AUTHENTICATION API (read-only contract)       │
   ├── POST /auth/login        (rate 5/60s)      │
   │     LoginDto{email,password}                │
   │     → auth.service.login → prisma → bcrypt  │
   │     → {user, accessToken, refreshToken}     │
   │     or {mfaRequired:true, userId}           │
   ├── POST /auth/verify-login (rate 10/60s)     │
   │     {userId, token} → speakeasy.totp.verify │
   │     → {user, accessToken, refreshToken}     │
   └── (absent) /auth/forgot-password            │
         /auth/reset-password — DOES NOT EXIST   │
                                                 │
   DOWNSTREAM (after success)                    │
   └── /dashboard → dashboard/layout.tsx guard   │
         getCurrentUser()/isAuthenticated()      │
         → unauthorized ⇒ router.push('/login')  │
```

**Critical dependencies highlighted:**
1. `auth-client.setTokens/getApiUrl` — shared, must not change.
2. `/auth/login` + `/auth/verify-login` response shapes — the MFA two-step
   contract the page's logic depends on.
3. Generic 401 copy "Invalid email or password" — security posture, keep.
4. `/dashboard` guard — the redirect target and the re-auth entry back into
   `/login`.
5. Absent recovery endpoints — a hard blocker for any "Forgot password" UI.

---

## SECTION 13 — TESTING SCOPE (future)

Prepared for the AUTH-02 verification phase (none exists for Login today):

| Area | Scope |
|---|---|
| **Functional QA** | Happy-path login → tokens + `/dashboard` redirect; MFA challenge → verify → redirect; invalid credentials error preserved; double-submit blocked; form state preserved on error. |
| **Visual QA** | Compare against AUTH-01B parity checklist (surface, radius, focus, spacing, shadow). |
| **Responsive QA** | 320 / 375 / 640 / 768 / 1024 / 1440: centered card, no overflow, 44px targets. |
| **Accessibility QA** | Label↔input association (axe), `role="alert"` announcement, contrast ≥4.5:1, keyboard order, password-toggle focus retention, screen-reader run-through. |
| **Performance QA** | Bundle size guard; no backdrop-blur; no idle animation; interaction latency. |
| **Regression QA** | Signup→Login cross-links; landing Navbar entry; dashboard 401 re-entry to `/login`; existing 617-test suite stays green. |
| **Security QA** | Generic error copy preserved (no user-existence oracle); rate limiting honored; no token leakage in state/logs; autofill behavior correct. |

---

## SECTION 14 — WHAT MUST BE KEPT

**Behavioral / data contract (non-negotiable):**
1. Route `/login` and file location `apps/web/src/app/login/page.tsx`.
2. Payload + response contract for `POST /auth/login`
   `{ email, password }` → `{ user, accessToken, refreshToken }` **or**
   `{ mfaRequired: true, userId }`.
3. Payload + response for `POST /auth/verify-login`
   `{ userId, token }` → tokens.
4. The **two-step MFA flow** — challenge, then verify. One focused code step.
5. Success behavior: `setTokens(...)` → `router.push('/dashboard')`.
6. Generic, non-revealing 401 copy — "Invalid email or password"; never reveal
   which field was wrong.
7. Rate limiting (login 5/min, verify-login 10/min) — backend-owned, untouched.
8. "Don't have an account? Sign up → /signup" cross-link.
9. Form-state preservation on any error path (no data loss).
10. Error banner as the single server-error surface (calm, not celebratory).
11. The `setTokens`/`getApiUrl` reuse from `@/lib/auth-client`.
12. Minimal-motion posture — Login is the only auth page with zero animation;
    preserve that (no decorative motion, no canvas, no aurora).

---

## SECTION 15 — WHAT SHOULD BE IMPROVED

Problems only — no implementation.

### Critical
- **Glass panel surface** — `GlassPanel` + `backdrop-blur-xl` + `shadow-glass`
  is the forbidden glassmorphism aesthetic (TG-2A §1.4, TG-2X §6.6.9). AUTH-01B
  replaced it with the solid `Card`; Login must follow. The blur is also a
  no-op cost over an opaque background.
- **Broken label→input association** — labels carry no `htmlFor`; inputs use an
  internally generated id the labels never reference. Screen readers and label
  clicks do not associate (§8.2). No `name` attributes.
- **Zero autocomplete attributes** — no `email` / `current-password` /
  `one-time-code`; password managers and autofill are defeated. TG-2X §4.1.3
  requires correctness here; AUTH-01B wired it on every field.
- **WCAG AA contrast failures** — `white/40`, `white/50`, `white/30` on
  12–14px text. Never opacity-derived text (TG-2X §1.9.4).
- **No password reveal toggle** — listed under Security UX in TG-2X §4.1.3;
  AUTH-01B ships a 44px toggle. Login is the only auth surface without one.

### High
- **Incomplete loading state** — `disabled` instead of the shared `Button
  loading` (no spinner, no `aria-busy`, no loadingText); inputs stay enabled
  mid-submit.
- **Error surface** — plain div without `role="alert"`, hard-coded red
  translucency instead of `Alert`/`danger` tokens, raw unmapped copy.
- **No brand presence / no split layout** — TG-2X §4.1.2 anatomy (brand panel
  left, form right ≤ 480px, mobile logo top) is unmet; no logo lockup anywhere.
- **Touch targets 40px** (`h-10` inputs + `md` button) below the 44px spec.
- **Typography** — label 12px (spec 13px); headline scale/semantic token.
- **No decomposition** — 116-line monolith vs the signup pattern; parity with
  AUTH-01B argues for a `components/login/` structure with shared primitives.

### Medium
- **"Forgot password" absent** — no affordance and no backend endpoint; requires
  API + product scope before UI.
- **"Remember me" absent** — persistent-session choice is a product decision.
- **MFA field ergonomics** — `inputMode="numeric"`, `autoComplete="one-time-code"`,
  helper copy, recovery/back affordance.
- **Inline per-field validation** — blur/submit checks with mapped calm copy
  (TG-2A §25.4) instead of a single raw banner.
- **No route guard for already-authenticated users** visiting `/login`.
- **Login page has no automated tests** (signup has 8; login has 0).
- **Copy** — "Sign in to TechFusion AI" vs brand vocabulary "TechFusion-AI".
- **Session-expiry UX** — `auth-client` silently redirects to `/login` on 401
  with no warning (TG-2X §4.1.2). Inherited architecture, out of page scope,
  but the login surface is where the user lands — flag for product.
- **Light theme** — hard-coded `text-white/*` breaks on a light surface; tokens
  would fix it.

### Low
- CTA `gap-2` + child icon → use `leftIcon` prop for consistent spacing.
- Cap-lock hint on the password field (TG-2X §4.1.3).
- SSO entry — **backend endpoint exists** (`POST /auth/sso/login`, saml/oidc)
  but there is no frontend affordance; product decision on whether Login should
  surface it (TG-2X §4.1.3 "SSO is first-class").
- Error-banner placement/`Alert` variant consistency.

---

## SECTION 16 — DESIGN COMPLIANCE

Category-by-category vs TG-1A + TG-2A + TG-2X, with AUTH-01B as the parity
reference. Weighted by impact on this page.

| Category | Score | Basis |
|---|---|---|
| Layout structure (single column, centering, width) | 40% | Form width ≤480px correct; **no brand panel / no split** (TG-2X §4.1.2); no logo on any breakpoint |
| Form anatomy & behavior (labels, autocomplete, toggle, MFA, states) | 35% | MFA step strong; but no autocomplete, no toggle, no remember-me/forgot, no per-field errors, weak loading |
| Accessibility semantics (ARIA, contrast, focus, touch) | 30% | h1 + focus rings ok; **broken label association**, unannounced errors, AA contrast failures, 40px targets |
| Visual / token compliance | 30% | Outer surface tokenized; nearly every authored value hard-coded (white/xx, red/xx, primary-400); glass forbidden |
| Motion compliance | 100% | No animation — fully compliant by absence (preserve) |
| Brand voice & identity (TG-1A) | 35% | Calm generic 401 copy good; no logo/brand panel; un-hyphenated product copy; floating-card "demo" feel |
| Performance posture | 90% | Minimal everything; only waste is backdrop-blur over opaque bg |
| **Weighted overall** | **≈ 42%** | |

**Bottom line:** the page's *behavior* (correct API contracts, secure generic
error, clean MFA step, no dead ends) is sound, and its *performance/motion*
posture is ideal. But its *surface* is a forbidden glass card with broken
label semantics, zero autofill support, and AA contrast failures — structurally
and visually **below** the AUTH-01B Register page it must match. It reuses the
exact patterns AUTH-01B was built to eliminate.

---

## SECTION 17 — FINAL DECISION

### NOT READY

The analysis is complete: flow, components, form behavior, accessibility,
performance, contracts, and risk are fully documented and evaluated against
TG-1A, TG-2A, TG-2X, and the AUTH-01B parity bar. No code was modified.

The Login page does **not** meet the quality level established by AUTH-01
(AUTH-01B), which is the stated requirement. The gap is not cosmetic:

1. **Design-governance debt:** forbidden glassmorphism surface, hard-coded
   non-token colors, no brand panel/logo, no split layout (TG-2X §4.1.2).
2. **Accessibility debt:** broken label↔input association, unannounced error
   surface, multiple WCAG AA contrast failures, sub-44px touch targets.
3. **Form-hygiene debt:** zero autocomplete attributes, no password toggle, no
   client-side validation, incomplete loading state.
4. **Product/API dependencies:** "Forgot password" and "Remember me" require
   backend + product sign-off before they can be specified in the UI.

Two caveats, stated explicitly:

- **This verdict is about compliance, not function.** The page works; its
  contracts and security posture must be preserved as-is during AUTH-02.
- **AUTH-02's spec must not silently add product surface** (SSO entry,
  Remember Me, recovery flow, session-expiry warning) without product
  approval — those are decisions this analysis cannot make alone.

With those constraints on record, AUTH-02 may proceed to specification and UI
development using this document as its official baseline — targeting parity
with AUTH-01/AUTH-01B.

---

*End of AUTH-02 Login Page Analysis — documentation only. No files were
modified other than this report.*
