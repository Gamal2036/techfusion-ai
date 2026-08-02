# AUTH-01D · Design Token System Recovery Report

| | |
|---|---|
| **Deliverable** | Semantic Design Token pipeline recovery (application-wide) |
| **Mission** | AUTH-01D · Production Recovery · Design Token System Recovery |
| **Priority** | P0 CRITICAL |
| **Status** | **HOTFIX — COMPLETE** |
| **Validation References** | TG-1A Brand Identity · TG-2A Design System · TG-2X Design Extensions · AUTH-01 · AUTH-01B · AUTH-01C Manual QA Report (authoritative) |
| **Date** | 2026-08-01 |
| **Scope** | Shared token infrastructure only. No page, route, backend, auth, or feature changes. |

---

## 1. Root Cause

Verified against the QA findings (AUTH-01C, T-1) and confirmed by inspecting both the
source pipeline and the compiled production CSS. Two compounding failures:

1. **Invalid CSS authoring (affects dev AND prod).**
   `apps/web/src/app/globals.css` stored *complete* colors inside each token
   (`--background: hsl(222 47% 6%)`) while `apps/web/tailwind.config.js` wraps every
   token in a second `hsl(...)` call
   (`background: 'hsl(var(--background))'`). Substitution produces
   `hsl(hsl(222 47% 6%))` — invalid in every spec-compliant browser, so the whole
   declaration is dropped. This is the standard anti-pattern; the canonical shadcn
   pattern stores bare H/S/L triplets in the variable.

2. **Production-only re-break (minification).**
   Next.js's production CSS minifier serializes `hsl(...)` values inside custom
   properties to their shortest form (hex). Verified in the built CSS:
   `--background:#fff`, `--background:#080c16`, `--ring:#0b64f4`,
   `--hero-glass-surface:rgba(21,27,40,.6)`. The `hsl(var(--background))` consumer then
   becomes `hsl(#080c16)` — invalid again → dropped. The same mangling hit every
   alpha/opacity consumer (`hsl(var(--primary)/0.2)` → `hsl(#.../0.2)` → invalid).

**Effect:** every semantic color declaration was invalid at runtime → transparent
surfaces, invisible white-on-white text, missing borders/shadows/focus rings/broken
semantic colors. Not specific to `/signup`; application-wide.

## 2. Files Modified

| File | Change |
|---|---|
| `apps/web/src/app/globals.css` | Token values in `:root`, `.dark`, and hero-scene blocks converted from `hsl(H S% L%)` to bare `H S% L%` triplets; alpha tokens to `H S% L% / a`; direct `var()` consumers (autofill, `select`) wrapped in `hsl(...)`. |

This is the **only** file modified. `tailwind.config.js` already used the correct
`hsl(var(--...))` wrappers and was left untouched. No page, component, backend, route,
or test file was changed.

## 3. Why Each Modification Was Necessary

- **`:root` / `.dark` token values → bare triplets** — the single fix that makes
  `hsl(var(--token))` resolve in the browser (`hsl(222 47% 6%)`) and makes the values
  un-mangleable by the minifier (a bare triplet is not a color and cannot be shortened
  to hex). Resolves both halves of the QA root cause.
- **Hero 3D scene tokens → bare triplets** — same class of token in the same file;
  `--hero-glass-surface: hsl(222 30% 12% / 0.6)` was being mangled to
  `rgba(21,27,40,.6)` in prod. Converted for consistency and future-safe consumption.
- **Autofill / `select` rules: `var(--x)` → `hsl(var(--x))`** — these were the only
  places that consumed tokens *without* the `hsl()` wrapper. With bare-triplet token
  values they would resolve to raw numbers (`222 30% 12%`), which is not a valid color.
  Wrapping restores a valid color value.

## 4. Regression Analysis

- **Appearance** — every converted value maps 1:1 to the identical color
  (`hsl(222 47% 6%)` ⇔ `222 47% 6%`). No color, spacing, radius, typography, layout,
  shadow, animation, or design-language value changed. The recovery *enables* the
  previously-declared design; it does not redesign it.
- **Tests** — `tsc --noEmit` clean; Jest 19 suites / **617/617 pass** (QA baseline).
  The `theme-tokens.spec.ts` suite (154 assertions) passes, including the
  `var(--input-background)` / `var(--foreground)` substring checks (the wrapped
  `hsl(var(--...))` still contains the expected substrings).
- **Build** — `next build` completes cleanly with zero warnings/errors.
- **Change scope** — `git status` confirms no file outside `globals.css` was modified
  by this recovery.

## 5. Compatibility Verification

| Surface | Result |
|---|---|
| Development (unminified) CSS | `--background: 222 47% 6%` + `background-color: hsl(var(--background))` → resolves identically to prod |
| Production (minified) CSS | Tokens survive intact (`--background:222 47% 6%`, `--ring:217 91% 50%`); **0** invalid `hsl(hsl(`, `hsl(#`, `hsl(rgb(` patterns |
| All semantic references in built CSS | **34 referenced tokens, 0 failures** (programmatic substitution check), incl. opacity modifiers (`hsl(var(--background) / .8)`, `hsl(var(--primary)/.3)`) |
| Browser computed styles — Dark (headless Chromium, prod build) | body `rgb(8,12,22)`/`rgb(248,250,252)`; card `rgb(11,17,30)` + border `rgb(29,40,58)` + `shadow-card` visible; input `rgb(21,27,40)`/border `rgb(34,43,57)`; heading legible; `:focus-visible` ring `rgb(11,100,244)` rendered with offset; primary button `#2563eb`/white; muted `rgb(163,176,194)`; danger `rgb(239,67,67)` |
| Browser computed styles — Light (`.dark` removed) | body `rgb(255,255,255)` / text `rgb(8,12,22)` |
| SSR / Static Generation | All 22 routes prerendered in the build; `/signup`, `/login`, `/` serve 200 |

## 6. Remaining Risks

- **LOW — Font (T-3, pre-existing, out of scope):** `font-family: Inter` is declared but
  no webfont is loaded; browsers use the system sans fallback. Not a token issue; is a
  separate follow-up per the QA report.
- **INFO — Favicon (T-2, pre-existing, out of scope):** `/favicon.ico` 404, one benign
  console error.
- **INFO — Dev-server hygiene (T-4, environmental):** a stale QA `next-server` was
  observed holding port 3100 with the old build; it was stopped. Dev/prod artifacts
  should be kept separate (already noted in AUTH-01C).
- **NONE** in the token pipeline itself: no transparent surfaces, no invisible text, no
  invalid CSS values, no token resolution failures remain.

## 7. Recovery Status

**COMPLETE.** The `hsl(var(--token))` pipeline resolves correctly in development,
production, SSR, static generation, minified CSS, dark theme, and light theme.

## 8. Manual QA Readiness

Ready. The AUTH-01C QA gate order is satisfied:
1. ✅ Token authoring fixed (bare H/S/L triplets) — `globals.css` aligned with `tailwind.config.js`.
2. ✅ Visual/contrast/focus checks — verified live in headless Chromium on the prod build (dark + light): surfaces, text, borders, shadows, focus ring, semantic colors all compute to valid colors.
3. ✅ Prod minification no longer hex-mangles tokens.
4. Ready to re-baseline AUTH-01C §10 and re-submit for final approval.

## 9. Production Readiness

**READY.** Release freeze can be lifted for the token defect. Build is clean, tests pass,
and the recovery is confined to the shared token infrastructure. T-2/T-3 remain
non-blocking follow-ups; T-4 remains environmental hygiene. AUTH-01 Register is cleared
to re-test.

---

### Appendix A — Verification Artifacts
- Built CSS: `.next/static/css/ade4d31f453e78ce.css` (tokens survive as bare triplets; 174 `hsl(var(--…))` consumers; 0 invalid patterns)
- Isolation proof (per QA): bare-triplet storage is the only form that both resolves and survives minification
- Browser harness: headless Chromium computed-style checks (dark + light, real `:focus-visible` keyboard focus)
