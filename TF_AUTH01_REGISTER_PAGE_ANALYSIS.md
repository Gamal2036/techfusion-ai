# TechFusion-AI — AUTH-01
# Register Page Engineering & UX Analysis

| | |
|---|---|
| **Phase** | Analysis |
| **Priority** | CRITICAL |
| **Status** | Documentation Only |
| **Scope** | `/signup` route — current implementation analysis |
| **References** | TG-1A Brand Identity Foundation · TG-2A Design System Foundation · TG-2X Design System Extensions |
| **Date** | 2026-08-01 |

---

> This document is the official analysis reference for AUTH-01. It describes the
> current Register page implementation only. It proposes **no** redesign, code,
> or implementation changes. Every observation is evaluated against TG-1A,
> TG-2A, and TG-2X.

---

## SECTION 1 — PAGE PURPOSE

### 1.1 Primary purpose
The Register page (route `/signup`) exists to create a new **organization
workspace** and an **Owner user account** in a single step. It is the
acquisition + activation entry point of the platform: a visitor arriving from
the marketing site becomes a tenant with one submission.

Implementation: `apps/web/src/app/signup/page.tsx` renders a single client
component, `SignupExperience`, composed of ten page-local modules under
`apps/web/src/components/signup/`.

### 1.2 User goal
A prospective administrator completes five fields (Organization, Full Name,
Email, Password, Confirm Password) and enters the product dashboard immediately
after successful signup.

### 1.3 Business goal
Convert marketing visitors into trial/active tenants. The page front-loads the
product promise (AI, cybersecurity, automation) on the brand panel to justify
the friction of creating an entire organization account rather than a simple
personal account.

### 1.4 Success criteria
- Valid submission → `POST /auth/signup` (200) → tokens stored → redirect to `/dashboard`.
- Duplicate email → visible, calm, actionable error; form state preserved.
- Existing-account user can pivot to `/login` from the cross-link.
- The signup experience delivers the brand promise within the first session
  (TG-1A §286 "onboarding delivers trustworthy, unified, intelligent").
- No data-loss on any error path (TG-2A §25 form-state rule).

---

## SECTION 2 — CURRENT USER FLOW

```
Marketing site (Landing page)
   │  Navbar / HeroCTA / DemoModal "Get started" → /signup
   ▼
/signup  (SignupExperience — full-screen split layout)
   │  Left: brand panel (logo, headline, gradient-text, 3 feature cards, particle field)
   │  Right: form card
   ▼
READING — user scans headline + feature cards (desktop); on mobile these render ABOVE the form
   ▼
FORM — 5 fields, order: Organization → Full Name → Email → Password → Confirm Password
   │  autocomplete: organization, name, email, new-password (x2)
   ▼
VALIDATION
   │  live: password strength meter (5 rules) on keystroke
   │  live: confirm-mismatch inline error once confirm has content
   │  submit gate: password === confirmPassword, else block + banner "Passwords do not match."
   │  (no client email/required per-field checks — form is noValidate)
   ▼
SUBMISSION
   │  Button → loading spinner + "Creating account…", aria-busy, all inputs disabled
   │  POST {API_URL}/auth/signup {email, password, displayName, orgName}
   │  Server: DTO validation → email-uniqueness check → bcrypt(10) →
   │          tx(org create + user create role=Owner) with slug-retry (≤10) → tokens
   ▼
SUCCESS  → setTokens(access, refresh) → router.push('/dashboard')
   │        dashboard layout re-checks isAuthenticated() (client-side, localStorage)
   ▼
FAILURE  → catch → setError(err.message) → inline rose banner above form
   │        inputs preserved; no navigation
   ▼
EXIT     → "Already have an account? Sign in" → /login
```

Entry points confirmed: `apps/web/src/components/landing/Navbar.tsx:82,91`,
`HeroCTA.tsx:20`, `DemoModal.tsx:133`. The landing **hero primary CTA routes
to `/signup`** (not `/login`) — relevant to TG-2X §4.1.3 ("sign-in is the
default, sign-up is a clear alternative, never the hero").

Notable flow gaps:
- **No redirect for already-authenticated users** visiting `/signup`.
- **No email verification step** — signup immediately issues session tokens.
  This is an existing product decision, not a UI bug; it shapes the "success"
  definition (instant in-session activation, per TG-2X §4.18.2 "calm completion
  → default dashboard", which the current flow matches).

---

## SECTION 3 — LAYOUT ANALYSIS

### 3.1 Overall structure
Full-screen (`min-h-screen`) dark split-screen. One outer shell:
`SignupExperience.tsx` → `AmbientBackground` (fixed) + grid container
(max-width 1440px) → left brand `section` + right `main` (form).

### 3.2 Columns
- **Desktop (≥1024px, `lg:`)**: two columns — brand `lg:w-[55%]`, form
  `lg:w-[45%]`. Form is vertically centered (`items-center`).
- **Below 1024px**: single column stack; brand section collapses to
  `min-h-[340px]` and sits **above** the form.

### 3.3 Sections (top→bottom)
1. Ambient background layer (aurora blobs, grid, vignette gradient).
2. Left/brand: particle canvas → logo → headline block → 3 feature cards.
3. Right/form: glass card → title + subtitle → error banner (conditional) →
   5 fields → submit → sign-in link → terms line.

### 3.4 Visual hierarchy
- Desktop: strong L→R narrative (promise → action). Brand headline is the only
  `h1`; form title is an `h2`. Hierarchy is clear.
- Form card internal hierarchy: title (white, 22px) → subtitle (white/40) →
  labeled fields → primary button → secondary link → tertiary terms.

### 3.5 Spacing
- Form fields: `space-y-4` (16px between controls) — compliant with TG-2A §9
  (control→control ≥ 16px).
- Label→input: `mb-1.5` (6px) — **below** the 8px `space-2` spec.
- Card padding: `p-6`/`p-8` (24/32px) — panel padding spec is 24px standard.
- Brand panel `py-12`/`lg:py-8`; max-widths `max-w-md`/`max-w-sm`.
- Most spacing values are 4px/8px multiples (Token-compatible in magnitude)
  but expressed as ad-hoc Tailwind values, not design tokens.

### 3.6 Alignment
- Form card centers horizontally; inner content left-aligned.
- Feature cards use `flex items-start gap-3.5`; icon tiles `h-9 w-9`.
- Grid overlay on background uses a **56px grid** (decorative; not the 8pt
  layout grid — see §6).

### 3.7 Responsive behavior
- Breakpoint used: `lg` (1024px) only. Tablet (640–1023px) and mobile share the
  stacked layout; brand panel `min-h-[340px]` always renders.
- Mobile priority: brand content (logo, headline, 3 feature cards) appears
  **before** the form — the actual conversion action is below the fold.
- Form remains `max-w-[440px]`, `w-full`, with 16px gutters — acceptable.
- No tablet-specific reflow (TG-2A expects 8-col at 640–1023px).

### 3.8 Empty space / density / balance
- Desktop: balanced 55/45 split with generous whitespace. Good calm surface.
- Mobile: brand block dominates viewport (≥340px + features) before the form —
  dense stacking, form feels secondary.

---

## SECTION 4 — COMPONENT INVENTORY

Page-local modules (`apps/web/src/components/signup/`, ~1,000 LOC):

| # | Component | File | Role | Notes |
|---|---|---|---|---|
| 1 | `AmbientBackground` | `SignupExperience.tsx:7` | Inline background | 2 aurora radial blobs (CSS `auroraDrift1/2`), 56px grid overlay w/ mask, bottom gradient |
| 2 | `SignupLogo` | `SignupLogo.tsx` | Logo lockup | Gradient `blue-500→cyan-400` tile + "TF" + wordmark + "AI" chip |
| 3 | `SignupBrand` | `SignupBrand.tsx` | Left panel content | `motion.h1` headline, gradient text span, `motion.p` description |
| 4 | `SignupFeatures` | `SignupFeatures.tsx` | Feature cards ×3 | Icon tile + title + `Check` + description; staggered motion |
| 5 | `SignupParticleField` | `SignupParticleField.tsx` | Canvas particle system | rAF loop, O(n²) links, pointer lines, node glows, visibility pause, DPR cap, reduced-motion fallback |
| 6 | `SignupForm` | `SignupForm.tsx` | Form + submission | State (5 fields + error + loading), fetch, token store, redirect |
| 7 | `SignupField` | `SignupField.tsx` | Labeled input wrapper | Icon, rightElement, error/hint/success, `aria-invalid`/`aria-describedby` |
| 8 | `SignupPasswordField` | `SignupPasswordField.tsx` | Password + toggle | Show/hide button, `Lock` icon default, feeds strength |
| 9 | `PasswordStrength` | `PasswordStrength.tsx` | Strength meter | 3-segment bar + label + `score/5` + 5-requirement checklist; `AnimatePresence` |
| 10 | `usePasswordStrength` | `usePasswordStrength.ts` | Scoring logic | 5 rules (8+, upper, lower, number, special) → weak/medium/strong |

Shared / third-party:

| # | Component | Source | Role |
|---|---|---|---|
| 11 | `Button` | `@techfusion/ui` | Primary submit (lg, fullWidth, loading) |
| 12 | `motion` / `AnimatePresence` | framer-motion | All entrances + meter |
| 13 | Icons | lucide-react | Building2, UserRound, Mail, KeyRound, Lock, Eye/EyeOff, CircleAlert, ArrowRight, BrainCircuit, ShieldCheck, Workflow, Check |

**Absent components:** divider, social login, SSO, checkbox/terms consent,
"forgot password", "required" legend, success screen/toast, cap-lock hint,
password confirmation success indicator, back-to-site link.

**Component duplication:** `SignupField` and `SignupPasswordField` re-implement
behavior already provided by `@techfusion/ui` `Input`/`PasswordInput`/
`FormField`/`FieldMessage` (packages/ui/src/components). The page-local copies
carry their own styling and do not consume design tokens. TG-2A §16 / TG-2X
§1.1.3 mandate components live in the UI package and consume semantic tokens
only — "no page-local re-implementations."

---

## SECTION 5 — UX ANALYSIS

### 5.1 Navigation
- Single clear forward path (submit) + one exit path (Sign in). No dead ends.
- Links: `Sign in → /login` (visible, cyan). No "back to home" affordance.

### 5.2 Readability
- Headlines: strong contrast (white on near-black).
- Supporting text fails contrast (see §7.2/§8). Terms are 11px at ~2.2:1.
- Feature descriptions 12px at ~3.2:1 — fail AA for normal text.

### 5.3 Visual hierarchy
Clear on desktop; the ambient background competes with the form card
(card is `bg-white/[0.03]` over animated blobs + grid), slightly reducing the
card's focal dominance.

### 5.4 Accessibility
**Structure (good):** real `<label htmlFor>`; `aria-invalid`, `aria-describedby`
wired; strength meter `role="status"` + `aria-live="polite"`; error banner
`role="alert"`; submit `aria-busy`; one `h1`; form `section aria-label`.
**Failures:**
- Contrast below WCAG AA on multiple text tokens (§8).
- No **skip link**; minimal landmark structure (`nav`/`footer` absent; not
  required on auth but inconsistent with TG-2A §41).
- `prefers-reduced-motion` honored **only** by the particle field — aurora CSS
  keyframes and all framer-motion entrances still animate (§11.3).
- Password eye toggle: 32×32px hit target (spec ≥44px touch) and focus is not
  returned to the input after toggle (unlike shared `PasswordInput`).
- `form` is `noValidate` with no compensating client checks — required/email
  errors surface only as a raw server banner.

### 5.5 Discoverability
Required markers (`*`, cyan) visible on all labels; show/hide affordance has
`aria-label`; strength meter self-explains rules. Good.

### 5.6 Focus order & keyboard flow
Tab order = visual order (org → name → email → password → confirm → toggle →
submit → sign-in → terms). All controls are native elements. No focus trap
(not needed — not a modal). Custom focus-visible rings present on inputs,
toggle, and link. Button focus ring comes from shared UI (signal ring token).

### 5.7 Mobile usability
- **Critical:** conversion action below the fold (brand block first).
- Inputs 48px (`h-12`) and submit 48px — meet 44px touch spec.
- Eye toggle 32px — below 44px; link targets small.
- Sticky primary action not present (not strictly required for a single-screen
  form, but would mitigate below-fold risk).

### 5.8 Desktop usability
Strong. Centered 440px form, comfortable rhythm, pointer affordances.
Password visibility + strength aid good UX.

---

## SECTION 6 — VISUAL ANALYSIS (vs TG-1A / TG-2A / TG-2X)

### 6.1 Colors — NON-COMPLIANT
| Current usage | TG standard |
|---|---|
| Page bg `#05070d` (hard-coded, not a token) | `surface-canvas` = `graphite-950 #0A0F1A` |
| Text via white-opacity opacities (`white/25…white/90`) | `text-primary/secondary/muted` graphite tokens; **never opacity for text** (TG-2X §1.9.4) |
| Blue `#2563eb`/`#3b82f6` (legacy palette) | `action-primary` `signal-500 #2B62F0` / `signal-600 #1F4FD0` |
| Cyan `#22d3ee` everywhere (links, focus, icons, features, gradient) | `optic` cyan is **AI-only**, used sparingly (TG-2A §5.4); never generic accent |
| Rose/emerald/amber/cyan decorative glows | status colors **never decorative**; signal/optic never swapped (TG-2X §1.2.4) |
| `text-rose-300` errors, `emerald-300/80` success checks | `critical-500/600`, `go-500/600` — status = icon + label + color, never color alone (checks OK, but tokens wrong) |

The entire color surface is hard-coded hex/opacity — a governance violation of
TG-2X §1.14.5 ("a hard-coded design value anywhere in UI is a governance
violation"). No light theme is implemented (TG-2A requires light as first-class).

### 6.2 Typography — NON-COMPLIANT
| Current | TG standard |
|---|---|
| System default font (no IBM Plex Sans loaded) | IBM Plex Sans (self-hosted) |
| Headline `text-4xl/5xl` + `text-[3.4rem]` (custom) | `text-display` 44px/1.1 @600 |
| Form title `text-[22px]` (custom size) | `text-h2` 24px/1.3 @600 |
| Labels `text-xs` (12px) | `text-label` **13px**/1.45 @500 |
| Feature desc 12px; terms 11px | never below 13px body on mobile (TG-2X §1.3.4) |
| `tracking-tight` (fine for display) | letter-spacing tokens −0.02/−0.01/0/+0.08em |
| Weight ceiling respected (600 max visible) | 600 max in UI — compliant |
| Gradient text "with AI" (`bg-clip-text`) | **gradient/glow text forbidden** — text from tokens only (TG-2X §1.9.4) |

### 6.3 Cards — NON-COMPLIANT
The form card uses **glassmorphism**: `bg-white/[0.03]` + `backdrop-blur-2xl` +
`rounded-2xl` + a large colored shadow + a gradient top-edge light line.
- TG-2X §6.6.9 lists **"glass" as a forbidden aesthetic**.
- TG-2A core metaphor: "Layered, not floating — no floating glassmorphism
  cards; matte layered panels with crisp 1px edges and minimum blur."
- Backdrop blur is **overlay-only** (TG-2X §1.8.2, §3.16.2) — bulk blur forbidden.
- Sanctioned surface: `surface-panel/raised` + `border-default` + `radius-lg`
  12px + `shadow-sm`, matte.
- Top-edge gradient light-line: decorative gradient border — forbidden
  (TG-2X §1.6.3/§1.6.6).

### 6.4 Buttons — PARTIALLY NON-COMPLIANT
- Radius `rounded-xl` (12px) → spec `radius-sm` **6px** for buttons.
- Height `h-12` (48px) → `lg` = **44px**.
- Colored glow shadow `rgba(37,99,235,…)` → **no colored/glowing shadows**
  (TG-2A §11.3, TG-2X §1.7.2); shadow-md is the interactive ceiling.
- `active:scale-[0.99]` → scale-on-press/press transform: TG-2X §3.5.3 forbids
  scale-on-hover (press = darker bg, 80ms, no scale/shadow).
- Left arrow icon + 15px font weight 600 — label/verb "Create account" is
  appropriate ("Sign up"/verb rule OK).

### 6.5 Inputs — PARTIALLY NON-COMPLIANT
- Radius `rounded-xl` 12px → **6px** (`radius-sm`).
- Height 48px vs token 36/44px; horizontal padding `pl-11` (44px for icon) vs
  12px spec + icon 16px (here 18px).
- Background `bg-white/[0.02]` → `surface-inset`; border `white/10` →
  `border-default`; focus cyan border+box-shadow glow → 1.5px `signal` border +
  2px `signal` ring (offset 2px).
- Labels above field (correct), but 12px vs 13px and 6px gap vs 8px.

### 6.6 Radius — NON-COMPLIANT
Card 16px (`2xl`), inputs/buttons 12px (`xl`), icon tiles 8px (`lg`), logo tile
8px. Spec: inputs/buttons **6px**, cards/panels **12px**, one radius per
surface. The "one panel = one radius" rule is violated (16px card + 12px
inputs + 12px button).

### 6.7 Shadow — NON-COMPLIANT
`shadow-[0_24px_80px_rgba(0,0,0,0.5)]` (modal-grade, one-layer) on a base
surface; plus multiple colored glow shadows (button, features, aurora).
Spec: two-layer neutral shadows, `shadow-sm` on panels, no colored glow, no
glow on hover.

### 6.8 Motion — NON-COMPLIANT
- Entrances: 500–600ms with delays to ~950ms total → **exceeds 400ms max**
  (TG-2A §43.1, TG-2X §3.3.1).
- Easing `[0.23,1,0.32,1]` (custom easeOutQuint) → token eases
  `ease-standard/signal/exit`.
- Stagger 100ms × 3 → token stagger 40–60ms, ≤6 items, total ≤300ms.
- Aurora keyframes 26s/32s **idle looping** → idle looping forbidden
  (TG-2X §3.13.4); motion is decoration, never information (TG-1A §307/§456).
- Particle field is a continuous animation by nature (see §9).

### 6.9 Icons — NON-COMPLIANT (sizing/color)
18px icons in inputs (spec 16px `size-icon-sm`); 18px feature icons (spec
20px `size-icon-md`); icon color `text-white/30`→cyan-on-focus (spec
`text-muted`, signal on focus via border not color change). Check `3.5`/`4`
inside feature cards is decorative green → status color as decoration
(forbidden).

### 6.10 Brand consistency — NON-COMPLIANT
- Logo tile gradient blue→cyan + glow blur → mark must be "restrained"; no glow
  treatment of identity (TG-1A §314).
- Feature cards + marketing copy on an auth screen = **feature advertisement on
  the auth screen**, explicitly forbidden (TG-2X §4.1.4).
- Headline "Build the Future with AI" is marketing-register; TG-1A tone for
  first visit is "warm, guiding, encouraging" — acceptable in direction but the
  gradient/glow presentation is off-brand.
- Product name copy "TechFusion AI" — brand vocabulary preferred
  "TechFusion-AI" / "TechFusion Platform" (TG-1A §629).

**Overall visual verdict:** the page's *system* (labels, real inputs, verbs,
semantic status pairing, reduced-motion hook, autocomplete) is sound, but its
*visual surface* implements exactly the aesthetics the TG documents forbid
(glass, glow, gradient text, animated backgrounds, particles, decorative grid,
neon-adjacent cyan).

---

## SECTION 7 — FORM ANALYSIS

### 7.1 Fields
| Field | Type | autocomplete | Validation present |
|---|---|---|---|
| Organization | text | `organization` | server only (1–100, required) |
| Full Name | text | `name` | server only (1–100, required) |
| Email | email | `email` | server only (`@IsEmail`, required) |
| Password | password (toggle) | `new-password` | live strength meter; server MinLength(8)/Max(128) |
| Confirm Password | password (toggle) | `new-password` | live match check + submit gate |

### 7.2 Validation
- **Client:** confirm-match (inline + banner gate); password strength (live,
  5-rule, with met/unmet checklist). No per-field checks for empty/email-format
  on the client; form is `noValidate`, so required fields rely entirely on the
  server round-trip.
- **Server:** `SignupDto` (email/required/MinLength/MaxLength); duplicate-email
  → 409 "Email already in use"; slug retry logic internal.
- **Failure UX gap:** a blank form submitted produces a single banner with a raw
  class-validator message (e.g. "email should not be empty") instead of inline
  per-field errors — violates TG-2A §25 (inline per-field errors; error = what's
  wrong + how to fix, in one line, calm tone).

### 7.3 Error messages
- Copy passed straight from server (`data.message`). Not mapped to the
  TG-2A §33 pattern `[What happened] — [why it matters]. [Next step].`
- Banner styling is calm-ish (rose tint, icon) but uses non-token colors and is
  the sole error surface for server failures.
- No field-level error wiring for server validation failures.

### 7.4 Success messages
None — success is immediate redirect to `/dashboard`. This matches TG-2X
§4.18.2 "calm completion → default dashboard" (no celebration). Compliant in
absence; no toast/confirmation is required.

### 7.5 Password strength
Good implementation: 5 rules, `score/5`, segmented bar, checklist, live
`aria-live`. Spec-aligned in concept (meter for account creation). Deviations:
12px+low-contrast labels, meter segments use status colors decoratively
(emerald/amber/rose), and it appears below both password fields — the confirm
field correctly disables it.

### 7.6 Loading state
Correct: `Button loading` → spinner + "Creating account…" + `aria-busy`;
all inputs `disabled` with `opacity-50`. Button width effectively locked
(fullWidth). Compliant with TG-2A §17.4.

### 7.7 Disabled state
Inputs and toggle get `disabled` + `opacity-50` during submit; toggle gets
`pointer-events-none`. Acceptable; no persistent disabled field present (no
"explain why" case needed).

### 7.8 Focus state
Custom focus styles exist (cyan border + glow box-shadow on inputs; ring on
toggle/link). Color is non-token; the input "focus ring" is a box-shadow
(soft glow) rather than the spec 1.5px border + 2px ring offset 2px.

### 7.9 Autocomplete
Correct across all fields (organization/name/email/new-password). One note:
the confirm field uses `new-password` (acceptable; many browsers treat
duplicate fine).

---

## SECTION 8 — PERFORMANCE ANALYSIS

### 8.1 Animations
- **Particle field** (`SignupParticleField.tsx`): `requestAnimationFrame`
  continuous loop; per frame O(n²) link checks (up to 70 particles →
  ~2,415 pairs/frame), `createRadialGradient` per node per frame (expensive
  canvas API), pointer-line pass. Mitigations present: DPR cap ≤2, visibility
  pause, ResizeObserver rebuild, reduced-motion static draw. Runs on mobile too
  (`opacity-70`). Moderate, bounded, but wasteful on the brand panel which is
  non-interactive chrome.
- **Aurora blobs**: two 26s/32s CSS transform loops — compositor-friendly but
  perpetual idle animation (forbidden + battery cost on mobile).
- **framer-motion entrances**: one-time; cheap; but durations exceed 400ms.
- **`backdrop-blur-2xl`** on the card: forces continuous compositing of the
  blurred region over an animated background — the most expensive single style
  here; bulk backdrop blur is forbidden (TG-2X §3.16.2).

### 8.2 Render complexity
Low — a single screen, no server data, no images, no fonts loaded, no lists of
dynamic data. Re-renders are small (5 controlled inputs). `useMemo` used for
strength + mismatch. No render pathology.

### 8.3 Bundle impact
Page imports framer-motion (already app-wide), lucide-react (tree-shaken),
`@techfusion/ui` Button. Particle field is dependency-free (raw canvas).
No three/recharts/react-three on this route. Net impact modest and shared.
`SignupExperience` is a single client bundle including all ~1,000 LOC of signup
modules — acceptable for one route, but the ~220-line canvas effect is the
largest single cost center.

### 8.4 Expensive effects
`createRadialGradient` per-frame allocation; per-frame O(n²) pair loop; bulk
backdrop blur. All three are the primary perf levers.

### 8.5 Accessibility impact of performance choices
Continuous particle motion + aurora drift can trigger vestibular sensitivity;
only the particle field is reduced-motion-gated. No 3Hz+ strobing present (safe
on seizure threshold) but the idle motion violates reduced-motion/quiet
principles (TG-1A §456, TG-2X §3.15.2).

---

## SECTION 9 — RISK ANALYSIS

| # | Risk | Severity | Impact | Recommendation (analysis note) |
|---|---|---|---|---|
| 1 | **Brand governance violation** — glass, glow, gradient text, animated background, particles, feature ads all forbidden by TG-1A §24 / TG-2A §1.4 / TG-2X §6.6.9 | High | Product drifts from the documented brand; trust positioning ("calm surfaces") contradicted; design-system authority undermined | Re-validate the entire visual surface against §6 of this report before any redesign work |
| 2 | **WCAG AA contrast failures** — white/25 (2.2:1) through white/40 (3.8:1) on 11–14px text (terms, subtitle, sign-in, feature desc, placeholders) | High | Accessibility non-compliance; risks in procurement/enterprise deals; hurts readability for a core conversion screen | Adopt semantic text tokens; enforce ≥4.5:1 for all normal text; never opacity-derived text |
| 3 | **No client-side per-field validation** (`noValidate` + no checks) — raw class-validator banners | High | Confusing error UX on empty/invalid submissions; contradicts TG-2A §25 inline-error requirement | Add blur/submit per-field validation with calm mapped copy |
| 4 | **Mobile conversion below the fold** — brand block before form | Medium-High | Direct signup-rate impact on the primary traffic source (mobile) | Reorder for mobile: logo + form first; feature content secondary |
| 5 | **Reduced-motion preference ignored** by aurora + framer-motion entrances | Medium | Vestibular discomfort; violates TG-1A/TG-2X accessibility contract | Gate all motion through the existing `useReducedMotion` hook |
| 6 | **Token/component discipline** — page-local re-implementation of Input/PasswordInput; ~40 hard-coded design values | Medium | Drift from `@techfusion/ui`; double maintenance; governance violation | Consolidate on shared components + semantic tokens |
| 7 | **Overlong entrance choreography** (≤950ms total, custom ease) | Medium | Feels slow; violates 400ms motion cap | Map to token durations/eases |
| 8 | **Particle + blur + idle-loop cost** on mid/low devices | Low-Medium | Frame drops / battery drain on the entry page | Reduce scope or gate to desktop/reduced-motion; replace bulk blur |
| 9 | **Glass + glow styling degrades trust** per TG-1A §298 ("loud design makes the product feel insecure") | Medium | Brand-perception risk for an enterprise security product | Prefer matte layered panels (TG-2A core metaphor) |
| 10 | **Authenticated users not redirected** from `/signup` | Low | Users may re-create orgs accidentally; minor confusion | Add route guard parity with dashboard |
| 11 | **Tokens in localStorage** (setTokens) — existing auth architecture, not introduced by this page | Low (inherited) | XSS exposure of session tokens | Out of UI scope; track under security backlog |
| 12 | **Cyan used as generic accent** (optic reserved for AI) | Medium | Semantic-color misuse erodes the intelligence-status language | Restrict cyan to AI contexts per TG-2A §5.4 |

---

## SECTION 10 — WHAT MUST BE KEPT

**Behavioral / data contract (non-negotiable):**
1. Route `/signup` and its file structure under `apps/web/src/app/signup/`.
2. Field set + payload to `POST /auth/signup`:
   `{ email, password, displayName, orgName }` — payload shape and response
   `{ user, accessToken, refreshToken }`.
3. Auto-login on success: `setTokens(...)` → `router.push('/dashboard')`.
4. Server-side uniqueness + slug-retry logic (do not touch backend).
5. Password match gate and confirm-field inline mismatch.
6. Password strength rules (8+, upper, lower, number, special) — they mirror
   the server `MinLength(8)` contract.
7. `autocomplete` mapping (organization/name/email/new-password).
8. Loading state: spinner + `aria-busy`, inputs locked, button width locked.
9. Form-level error banner that preserves all entered values on failure.
10. "Already have an account? Sign in → /login" cross-link and terms line.
11. Labels above fields with `htmlFor`; `aria-invalid`/`aria-describedby`;
    `aria-live` strength meter; one `h1`; `role="alert"` errors.
12. The split-screen concept (brand panel + form) — structurally matches
    TG-2X §4.1.2 split-auth pattern (content/treatment needs alignment, not
    removal).
13. The `useReducedMotion` hook pattern (extend its coverage).
14. No-verification immediate-activation product flow (unless product decides
    otherwise).

---

## SECTION 11 — WHAT SHOULD BE IMPROVED

### Critical
- Text contrast on white/25–white/40 surfaces (terms, subtitle, sign-in line,
  feature descriptions, placeholders) — replace with token text ≥4.5:1.
- Forbidden aesthetics: glassmorphism card + `backdrop-blur-2xl`, aurora
  animated background, particle field, gradient text, colored/glowing shadows,
  decorative grid, top-edge light line, glow on logo/button/features — align
  with TG-1A §24 / TG-2A §1.4 / TG-2X §6.6.9 (matte layered panels, no glow,
  no idle motion, text from tokens).
- Token discipline: replace hard-coded hex/opacity (bg `#05070d`, white/xx,
  `#2563eb`, `#22d3ee`, `rgba(37,99,235,…)`) with semantic tokens
  (surface-canvas, text-primary/secondary/muted, action-primary,
  intelligence-accent, border-default, focus ring).
- Radius/height audit: inputs+buttons 6px, panel 12px, button 44px lg, input
  token scale — one radius per surface.
- Client-side per-field validation with mapped, calm error copy
  (`[What happened] — [why it matters]. [Next step].`), inline per-field errors,
  server-error mapping.
- Motion contract: ≤400ms, token eases, token stagger, and honor
  `prefers-reduced-motion` for every animation (not just particles).

### High
- Mobile layout: form-first (logo + form above brand content); keep ≥44px
  touch targets; reconsider feature-block placement per TG-2X §4.1.4.
- Feature advertisement on the auth screen — align with TG-2X §4.1.2
  (one-line promise) / §4.1.4 (no feature ads) or seek explicit governance
  approval.
- Reuse `@techfusion/ui` `Input`/`PasswordInput`/`FormField`/`FieldMessage` +
  `GlassPanel→Card` instead of page-local copies.
- Focus indicators: signal-color ring, 2px offset; remove glow box-shadows.
- Password strength meter: token colors, ≥13px labels, contrast-safe.

### Medium
- "Required" legend at top of form (TG-2A §25) rather than per-field markers only.
- Icon sizing/color tokens (16px input icons, muted; no decorative green checks).
- Landing hero CTA parity (sign-in as default vs sign-up as hero — TG-2X §4.1.3).
- Skip link + landmark consistency; autofocus strategy for the first field.
- Eye-toggle: 44px target, return focus to input (port `PasswordInput` behavior).
- Cap-lock hint on password fields (TG-2X §4.1.3).
- Typography: load IBM Plex Sans per token; label 13px; no text below 13px.
- Light theme support (TG-2A mandates light as first-class).

### Low
- Redirect authenticated users away from `/signup`.
- `score/5` display redundancy on small screens.
- Consider SSO as a first-class option (TG-2X §4.1.3) — product decision.
- Bundle: isolate the particle/canvas module (code-split or remove) to trim the
  entry chunk.

---

## SECTION 12 — DESIGN COMPLIANCE

Compliance is evaluated category-by-category against TG-1A + TG-2A + TG-2X,
weighted by impact on this page.

| Category | Score | Basis |
|---|---|---|
| Layout structure (split auth, single column, centering) | 75% | Matches TG-2X §4.1.2 structurally; brand block wrong on mobile |
| Form anatomy & behavior (labels above, autocomplete, states, verbs) | 65% | Strong fundamentals; noValidate gap, error mapping, legend |
| Accessibility semantics (ARIA, focus, reduced-motion) | 55% | Excellent ARIA; contrast failures + partial reduced-motion + 32px toggle |
| Visual / token compliance | 15% | Nearly all values hard-coded; forbidden aesthetics present |
| Motion compliance | 25% | Right components, wrong durations/eases/stagger; idle loops |
| Brand voice & identity (TG-1A) | 35% | Calm error pairing good; marketing headline + feature ads + neon-adjacent |
| Performance posture | 50% | No data costs; particle O(n²) + bulk blur are the main costs |
| **Weighted overall** | **≈ 40%** | |

**Bottom line:** structural and interaction quality is solid; visual surface
and token/motion discipline are substantially non-compliant. The page is a
"precision-instrument" structure dressed in the exact aesthetics the TG
documents prohibit.

---

## SECTION 13 — READY FOR REDESIGN

### READY

The analysis is complete. The current Register page is fully documented: flow,
components, form behavior, performance, and risk are all understood and
evaluated against TG-1A, TG-2A, and TG-2X. No implementation detail remains
undocumented, and no code was modified.

Two caveats that must be stated explicitly so they do not become surprises:

1. **This verdict is about analysis readiness, not spec compliance.** The page
   as built carries **Critical** design-governance debt (forbidden aesthetics:
   glass, glow, gradient text, animated background, particles, feature ads;
   plus WCAG AA contrast failures). These are precisely what AUTH-01 must
   resolve — they are captured, not hidden.
2. **Content decisions require product sign-off before redesign:** SSO
   presence, email verification, "sign-in as default" navigation on the landing
   hero, and whether the brand panel/feature content stays on the auth screen
   at all (TG-2X §4.1.4) are product choices this document cannot make alone.

With those constraints on record, AUTH-01 may proceed to specification and UI
development using this document as its official baseline.

---

*End of AUTH-01 Register Page Analysis — documentation only. No files were
modified other than this report.*
