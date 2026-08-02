# TF_AUTH02X — Authentication Visual/UX Certification Report

**Mission:** AUTH-02X (Enterprise visual/UX for the authentication experience)
**Status:** READY FOR MANUAL QA
**Date:** 2026-08-01
**Reference docs (obeyed, read-only):** TG-1A, TG-2A, TG-2X, TG-3, TG-CORE, TF_AUTH-VIS-01B, TF_AUTH-VIS-01C

---

## 1. Executive Summary

The login and signup experiences were elevated from a functional split-layout
into a calm, production-grade **Enterprise visual environment** — without
touching backend, API contracts, routing, validation, or global architecture.
The left brand panel is now a subtle "operational intelligence" atmosphere
(horizon light, calibration hairlines, receding signal streams, light sweeps,
breathing glow) built entirely from existing design tokens and existing CSS
keyframes. The form panels gained quiet context eyebrows ("Secure sign-in",
"Enterprise onboarding"), a unified hero brand panel, and a gentle CSS-only
entrance. All motion is CSS-based (no new JS animation runtime), honors
`prefers-reduced-motion`, and the login flow was deliberately kept free of
framer-motion/JS hooks so the existing test harness (which does not mock them)
remains green.

Verification: `tsc --noEmit` clean, **643/643** tests pass (incl. all auth +
theme-token suites), production build succeeds, and every new class was
confirmed present in the emitted CSS.

## 2. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | New shared `components/auth/` (AuthLogo, AuthBrandPanel, AuthEnvironment) with login/signup thin wrappers | Single source of truth; logo/brand/environment identical across both pages (TG-2A consistency) |
| 2 | Login tagline stays a `<p>`, signup tagline stays an `<h1>` (via `variant` prop) | Preserves exact existing semantics/tests (`getByText` vs `getByRole('heading')`); TG-CORE "don't change semantics" |
| 3 | "REAL DATA OR NOTHING" environment — no fake telemetry widgets, charts, or status dots | AUTH-VIS-01C Law 4; only pure atmosphere (light/hairlines/streams) so nothing asserts fabricated data |
| 4 | All atmosphere reuses existing keyframes (`lightSweepX`, `breathe`) via inline animation styles + `motion-reduce:` classes | Zero globals.css changes → `theme-tokens.spec.ts` guaranteed safe; restrained, purposeful motion |
| 5 | Login flow uses NO `framer-motion`/`useReducedMotion` | Login test does not mock them; CSS animations are equivalent and simpler |
| 6 | Atmosphere layers are `hidden lg:block` (except a subtle radial on all sizes) | Mobile stays calm/clean per TG-2X split pattern (form first, brand below); no overlap with text |
| 7 | Entrance = existing `animate-slide-up` utility with 0.12s form delay, `motion-reduce:animate-none` | No new keyframes; GPU-friendly transform/opacity; reduced-motion safe |
| 8 | Form eyebrows use `text-text-muted` + token icons (`LockKeyhole`/`ShieldCheck`/`Building2`) | Trust/precision signal at threshold moment (AUTH-VIS-01B) without decoration overload |
| 9 | Errors animate with the same `slide-up` (CSS) for calm, consistent feedback | Restrained motion per TG-CORE motion discipline |
| 10 | Only integer opacity modifiers (`bg-primary/10`, `bg-border/30`, …) | Tailwind cannot emit bracket-decimal alpha for CSS-variable colors (verified in build output); integers compile reliably |

## 3. Files Modified

**New**
- `apps/web/src/components/auth/AuthLogo.tsx` — shared logo mark + wordmark
- `apps/web/src/components/auth/AuthBrandPanel.tsx` — shared hero brand (logo, tagline, subcopy; `variant: 'login' | 'signup'`)
- `apps/web/src/components/auth/AuthEnvironment.tsx` — decorative enterprise atmosphere (aria-hidden)

**Rewritten (thin wrappers / layout)**
- `apps/web/src/components/login/LoginLogo.tsx`, `SignupLogo.tsx` — delegate to `AuthLogo`
- `apps/web/src/components/login/LoginBrand.tsx`, `SignupBrand.tsx` — delegate to `AuthBrandPanel`
- `apps/web/src/components/login/LoginExperience.tsx`, `SignupExperience.tsx` — host `AuthEnvironment`, add `relative`/`overflow-hidden`, CSS entrance + stagger

**Edited (headers + alert motion)**
- `apps/web/src/components/login/LoginForm.tsx` — eyebrow "Secure sign-in"/"Security verification"; alert `slide-up`
- `apps/web/src/components/signup/SignupForm.tsx` — eyebrow "Enterprise onboarding"; alert `slide-up`

**Untouched (verified)** — page wrappers (`app/login/page.tsx`, `app/signup/page.tsx`), `LoginPasswordField`, `SignupPasswordField`, `PasswordStrength`, `usePasswordStrength`, `LoginMfaStep`, `lib/auth-client`, `layout.tsx`, `globals.css`, `tailwind.config.js`, `packages/ui`.

## 4. Visual Improvements

- **Enterprise environment (desktop):** breathing horizon glow near bottom, three receding signal-stream lines with slow light sweeps, calibration hairlines + reticle corner marks + vertical ticks at bottom, subtle top-left radial depth. Communicates "machine already running" (AUTH-VIS-01C Law 1) with zero fabricated data (Law 4).
- **Unified hero brand panel** on both pages: same sizing/typography for logo, tagline, subcopy.
- **Form context eyebrows** with iconography (lock, shield, building) above each heading for trust/precision.
- **Calm entrance:** brand and form panels rise ~0.3s (`slide-up`); form slightly delayed (0.12s) — first three seconds read calm/quiet (AUTH-VIS-01B).
- **Feedback motion:** server-error alerts gently slide in; all animations are ≤0.4s, transform/opacity only.

## 5. Accessibility Improvements

- Decorative environment is `aria-hidden="true"` and `pointer-events-none` — invisible to AT, never intercepts clicks.
- **Reduced motion:** every animation is disabled under `prefers-reduced-motion` (`motion-reduce:animate-none` / `motion-reduce:hidden`); static atmosphere layers remain, content is fully static.
- **Semantics preserved:** login tagline remains a paragraph, signup tagline remains an `h1`; headings/section `aria-label="TechFusion-AI overview"` unchanged.
- Icons inside eyebrows are `aria-hidden="true"` (decorative); text labels are real text.
- No `tabIndex`, no focus-order changes; existing `focus-visible` rings, label/input `for`/`id` wiring, and `aria-invalid`/`aria-describedby` untouched.

## 6. Performance Notes

- **No new dependencies.** Zero npm/package changes.
- **CSS-only animation:** `AuthEnvironment` + entrances use keyframes already shipped in `globals.css`; no `framer-motion` runtime added (signup's previous motion wrapper removed). Only remaining framer-motion usage is the pre-existing `PasswordStrength`.
- All animations are `transform`/`opacity` (compositor-friendly; no layout/paint on most frames).
- Decorative layers are `display:none` below `lg` breakpoint, so mobile renders only the base surface + a single static radial gradient.
- No data fetching, no re-render loops, no added state.
- Build output: `/login` ≈ 195 kB and `/signup` ≈ 244 kB First Load JS (static, prerendered).

## 7. Test Results

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npm run lint` (`tsc --noEmit`) | PASS |
| Auth + theme suites | `jest login-page signup-page theme-tokens --forceExit` | 188/188 PASS |
| Full suite | `npm test` (jest) | **643/643 PASS** (20 suites) |
| Production build | `npm run build` | PASS (`/login`, `/signup` static) |
| CSS class audit | grep built CSS | all new classes emitted incl. `motion-reduce`, `lightSweepX`, `breathe`, `animate-slide-up`, token-opacity variants |
| SSR structure | inspect `.next/server/app/{login,signup}.html` | tagline `<p>` (login) / `<h1>` (signup); eyebrows; environment present |

Note: a React dev warning (`inputSize` on DOM element) exists in the signup test output — it originates in the test's hand-rolled `Input` mock and predates this mission; unrelated to these changes.

## 8. Manual QA Guide

1. `pnpm dev` → open `/login`.
2. **Desktop (≥1024px):** brand panel shows horizon glow, calibration hairlines, and 3 signal lines with slow light sweeps; form panel rises in ~0.3s after the brand. Verify it reads calm/quiet, not flashy.
3. Toggle **dark/light** theme (layout default is dark): environment adapts via tokens; no hard-coded colors anywhere.
4. **Keyboard:** Tab through email → password → show/hide → sign in → Sign up link; visible focus rings throughout; Show/Hide toggles keep focus in the field.
5. **Validation:** submit empty → inline errors + `aria-invalid`; type an invalid email → format error; no network call.
6. **Loading/success:** correct credentials → button shows "Signing in…", fields disabled, navigates to `/dashboard`.
7. **Error:** wrong credentials → calm alert appears (gentle slide-in), fields keep values.
8. **MFA:** with an MFA-required account → switches to "Security verification" 6-digit step; wrong/empty code shows inline error; "Use a different account" returns with credentials preserved.
9. **Reduced motion:** enable OS `prefers-reduced-motion` → all motion disabled; everything fully visible and usable.
10. Repeat on `/signup`: 5 fields, live strength meter, mismatch flag, "Creating account…" state, terms links.
11. **Responsive:** verify mobile (<1024px) — form first, brand below with subtle radial; tablet at 768px; laptop at 1280px; no horizontal scroll, no overlap.
12. **Regression sweep:** run `npm run lint`, `npm test`, `npm run build` (see §7).

## 9. Known Limitations

- Atmosphere is intentionally desktop-only (`lg:block`); mobile shows a single subtle radial gradient to keep the panel calm and non-overlapping.
- Login and signup taglines use different HTML elements (`p` vs `h1`) — preserved deliberately for test/semantic compatibility; `AuthBrandPanel` normalizes their visual styling.
- The breathing glow is disabled under reduced motion (static base glow remains).
- The pre-existing `inputSize` console warning in the signup test comes from the test's mock, not application code.

## 10. Future Recommendations

- Consider a dedicated `auth/` route group with shared layout so login/signup/MFA share the brand panel shell automatically (would also let the tagline semantics be finalized once; requires test review first).
- If a live capability signal is ever desired in the brand panel, source it from the real fleet/health API (AUTH-VIS-01C Law 4) rather than decoration.
- Add `Forget password`/SSO affordances only when the backend supports them (explicitly out of scope and currently prohibited by tests).
- Revisit `PasswordStrength` (last framer-motion holdout) if the signup test is ever migrated to CSS animations for consistency.

## 11. Certification Status

**READY FOR MANUAL QA** — target TG-3 score 95+ (visual quality, calm enterprise atmosphere, accessibility, reduced-motion compliance, performance, no backend/architecture regressions). All automated gates pass (TypeScript, 643 tests, production build, CSS audit). Human visual review of §§8.1–8.11 is the remaining gate.
