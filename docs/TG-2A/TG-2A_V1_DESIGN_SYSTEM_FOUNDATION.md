# TechFusion-AI — Design System Foundation

> **Document ID:** TG-2A
> **Phase:** Documentation
> **Priority:** CRITICAL
> **Status:** Draft — Ready for Approval
> **Owner:** Design Systems
> **Version:** 1.0

---

## Table of Contents

1. Design Philosophy
2. Design Principles
3. Visual Identity Rules
4. Color Philosophy
5. Color System
6. Typography System
7. Grid System
8. Layout Rules
9. Spacing System
10. Border Radius System
11. Shadow System
12. Elevation System
13. Iconography
14. Illustration Rules
15. Image Rules
16. Component Philosophy
17. Buttons
18. Inputs
19. Cards
20. Tables
21. Navigation
22. Sidebar
23. Header
24. Footer
25. Forms
26. Modals
27. Dropdowns
28. Tooltips
29. Notifications
30. Toasts
31. Dialogs
32. Empty States
33. Error States
34. Success States
35. Loading States
36. Skeleton Loading
37. Charts
38. Dashboard Rules
39. Data Visualization
40. AI Components
41. Accessibility Standards
42. Motion Philosophy
43. Animation Rules
44. Transition Rules
45. Responsive Philosophy
46. Mobile Rules
47. Tablet Rules
48. Desktop Rules
49. Large Screen Rules
50. Performance Rules
51. UX Principles
52. Interaction Principles
53. Micro Interaction Rules
54. Design Tokens Philosophy
55. Future Expansion Rules
56. Component Naming Convention
57. Design Checklist
58. Approval Checklist

---

## Preamble — Why This Document Exists

This document is the **single source of truth** for every UI, UX, component, animation, layout, and interaction decision across the TechFusion-AI platform.

It is derived from **TG-1A (Brand Identity Foundation)** and **may not contradict it**. Where TG-1A defines *who we are* (the brand), this document defines *how we look and behave* (the design). Where this document is silent, TG-1A governs. Where this document is explicit, it governs — and any future component, screen, or interaction that conflicts with either document must be changed or formally amended.

The system described here is called the **TechFusion Design Language**.

### The one-sentence definition

> **The TechFusion Design Language is a precision-instrument aesthetic: calm, matte, layered surfaces on which luminous, exact, verifiable data reads like a calibrated instrument face — and on which nothing moves or shines unless it carries information.**

### Scope of validity

This document holds across every stage of maturity defined in TG-1A (Small SaaS → Professional Platform → Enterprise Platform → AI Ecosystem). Scaling changes *capability*, never *character*: the same calm, precise surface serves a solo technician and a 100,000-device fleet.

### Reference standard

| Attribute | Standard |
|-----------|----------|
| Document | TG-2A — Design System Foundation |
| Derived from | TG-1A — Brand Identity Foundation |
| Design language | TechFusion Design Language |
| Core metaphor | The precision instrument face |
| Accessible baseline | WCAG 2.2 AA (minimum), AAA targets where practical |
| Governance | Any deviation requires a signed amendment to this document |

---

# PART A — FOUNDATIONS

---

## 1. Design Philosophy

### 1.1 The philosophy in one line

> **Signal is the design. The interface is the glass over the machine — calm, matte, and optically precise — and the data is the light that passes through it.**

### 1.2 What this means

The TechFusion Design Language treats every screen as a **precision instrument face**. A flight instrument is not decorated; it is engineered. Its surface is quiet and matte so that the luminous readings command attention. Its ticks are calibrated. Its one red warning is saved for the one condition that truly warrants it. Its numerals are exact.

This is our design model, and it produces a look and feel that is deliberately **distinct from the aesthetic families popular in modern SaaS**:

| Common modern aesthetic | Our deliberate contrast | Why |
|--------------------------|--------------------------|-----|
| Floating glassmorphism cards on bright gradient backgrounds | Matte, layered, border-dominant panels on calm surfaces | Glass + glow reads as consumer novelty; layered matte reads as engineered equipment |
| Neon gradient brand accents and glow effects | One deep trustworthy blue; a restrained cyan reserved for AI; desaturated status colors | TG-1A forbids neon; color noise erodes the calm our users need under incident pressure |
| Entertainment motion (springy, bouncy, celebratory) | Fast, damped, informational motion (80–300 ms) | Motion must explain state, never perform |
| Hype copy and celebratory UI | Calm, precise, sourceable copy | TG-1A: trust before spectacle |
| "Terminal hacker" styling | Monospace restricted to technical data values only | Monospace-as-motif reads hacker; TG-1A forbids it |

### 1.3 The three structural pillars

| Pillar | Definition | Design expression |
|--------|-----------|-------------------|
| **Calm Surfaces** | The substrate is quiet, matte, layered, and consistent | Neutral graphite surfaces, crisp 1px edges, restraint in decoration |
| **Precise Signals** | Data is luminous, exact, and instantly readable | Tabular numerals, calibrated status color, five-second comprehension |
| **Honest Systems** | Everything the user sees can be verified | Every AI claim cites its source; every status explains itself; every number is real |

### 1.4 What this philosophy forbids

- **Never** decorative gradients, glows, particle effects, or animated backgrounds.
- **Never** neon, cyberpunk, gamer, or hacker aesthetics (TG-1A §24).
- **Never** urgency theater: flashing, pulsing, or over-red UI.
- **Never** fake progress, placeholder data, or fabricated status.
- **Never** celebratory motion (confetti, bounce, pop) — including onboarding and success screens.
- **Never** a "showcase" style that draws attention to itself instead of the data.

### 1.5 Why this philosophy

Our users are measured on uptime, resolution speed, and security posture — often while a production system is failing. A loud interface consumes the very attention they need for judgment. A calm, precise, instrument-like interface makes the data feel *authoritative* and makes the professional feel *in control*. This is the design translation of the brand promise: complete, trustworthy command.

---

## 2. Design Principles

The six operating principles translate the philosophy into decisions any team member can apply without memorizing every rule. Every design decision — color, spacing, component, animation — must be traceable to at least one principle.

| # | Principle | Definition | Why it exists | Violation example |
|---|-----------|-----------|---------------|-------------------|
| 1 | **Five-second comprehension** | The primary signal of any screen is readable within five seconds | TG-1A: comprehension speed is a safety property in incident response | A dashboard where the health of the fleet is buried behind three clicks |
| 2 | **Signal over chrome** | Decoration is subtracted until only information and action remain | Attention is the scarce resource; our brand generosity is restraint | A card with a gradient border that adds no information |
| 3 | **Layered, not floating** | Depth is expressed by matte layered surfaces and crisp edges, not by drop-shadow cards hovering on glass | Layering reads as engineered structure; floating reads as novelty | Eleven floating cards with heavy shadows on a bright gradient |
| 4 | **Calibrated status** | Color communicates status exactly, desaturated, sparingly, and never alone | Status color is the instrument's language; overuse teaches users to ignore it | Green "healthy" styling used on decorative elements |
| 5 | **Grounded by default** | Anything the user can read, they can verify; AI and data always show their source | Honesty is our only defensible moat (TG-1A §7) | An AI answer without a source chip |
| 6 | **Motion explains** | Every animation communicates a state change; nothing animates to impress | Motion is the system breathing, not a fireworks show | A logo that bounces on page load |

### 2.1 Tension resolution

Principles can conflict. The resolution order is fixed:

1. **Trust** (grounded, real, honest) — never traded away.
2. **Clarity** (comprehension, legibility, consistency).
3. **Craft** (polish, precision, finish).
4. **Novelty** (surprise, delight) — lowest priority, never at the expense of the first three.

Example: a delightful 3D onboarding animation is dropped because it delays comprehension and implies playfulness about production systems.

---

## 3. Visual Identity Rules

### 3.1 The visual identity in six words

**Precise. Calm. Unified. Restrained. Honest. Professional.** (TG-1A, Appendix A)

### 3.2 Signature moves — the identity elements that make the system recognizable

A design language needs a few repeatable, recognizable gestures — its "signature." Six signatures define the TechFusion look:

| # | Signature | Description | Where it appears |
|---|-----------|-------------|------------------|
| 1 | **Instrument Surface** | Matte, layered panels with crisp 1px edges and *minimum* blur; depth from layering, not glow | Every panel, sidebar, table, card |
| 2 | **Luminous Data** | Numeric data in tabular figures, medium weight, on calm dark surfaces; numbers feel like instrument readouts | Health scores, counters, charts, monitor tiles |
| 3 | **Signal Color Code** | One exact desaturated language: Graphite + Signal Blue + Optic Cyan (AI) + Go/Caution/Critical — used sparingly, never decoratively | Status chips, alerts, charts, AI markers |
| 4 | **Grounded AI Motif** | Every AI output carries source chips, a confidence indicator, and a human-confirm affordance | AI assistant, AI suggestions, explanations |
| 5 | **Calibrated Motion** | Fast, damped, directional motion (80–300 ms); nothing animates without a reason | Menus, panels, toasts, chart updates |
| 6 | **The Verifiable Interface** | Any claim or number can be tapped to reveal its source/evidence | Device details, AI answers, report figures |

### 3.3 Non-negotiable visual rules

| Rule | Detail |
|------|--------|
| One surface language | Every area of the product uses the same panels, edges, radii, and type system. No per-module visual styles. |
| Dark is the console default | Device-operations surfaces default to dark mode (the instrument metaphor); light mode is a fully supported, equally polished alternative. Never a "second-class" theme. |
| No decorative color | Color carries meaning or it is removed. No colored borders on neutral cards, no gradient text, no "brand vibes" fills. |
| Edges over blur | Layered surfaces use borders and shadows for separation; backdrop blur is a secondary tool (overlays only), never a primary surface treatment. |
| Status is earned | Red/Critical appears only when a condition is genuinely critical, per the Signal Color Code (§5). No "brand red" elsewhere. |
| One accent per surface | A screen carries at most one dominant accent beyond neutral and status colors. |
| No text on image | Marketing imagery never sits under body copy without a scrim of ≥ 60% opacity and AA-verified contrast. |
| Logo & mark | Governed by TG-1B (visual identity extension); the design system never invents its own logo treatments. |

### 3.4 What the identity is never

- **Never** "futuristic" — no glowing server rooms, holograms, or sci-fi chrome.
- **Never** "friendly consumer" — no candy gradients, rounded blobs, or mascots.
- **Never** "legacy enterprise" — no bevels, skeuomorphism, busy toolbars, or dense text walls.
- **Never** "AI hype" — no sparkle explosions, robotic motifs, or pseudo-magical styling around AI.

---

## 4. Color Philosophy

### 4.1 The philosophy

> **Color is the instrument's language: neutral graphite carries the surface, Signal Blue commands action, Optic Cyan marks intelligence, and Go/Caution/Critical report status — each desaturated, each sparing, each verifiable on its own and redundant with an icon or label.**

### 4.2 Why this color philosophy

Color is the fastest channel of communication on a screen and the easiest to corrupt. In a monitoring and security product, color corruption has a specific cost: **if "red" appears anywhere that is not genuinely critical, users stop trusting red, and a real critical alert is missed.** TG-1A (§7, §13) mandates restraint in color and forbids color-alone meaning. The philosophy therefore imposes three disciplines:

1. **Desaturation** — colors are engineered, muted, "calibrated" tones, never saturated carnival colors.
2. **Semantic discipline** — each hue owns one meaning and does not migrate (blue is action, not decoration; green is health, not "success animation").
3. **Redundancy** — color never carries meaning alone; an icon, label, or pattern always accompanies it (§41).

### 4.3 The color roles

| Role | Color | Job |
|------|-------|-----|
| **Surface / Ink** | Graphite neutrals | The substrate: backgrounds, panels, borders, text. Carries ~90% of the interface. |
| **Action** | Signal Blue | Primary interactive identity: primary buttons, active nav, links, focus rings, selection. |
| **Intelligence** | Optic Cyan | Reserved for AI: assistant markers, AI suggestions, grounding/source indicators, AI status. Never used for generic actions. |
| **Status** | Go / Caution / Critical | Health, warnings, and critical conditions. Desaturated, used sparingly, always redundant with icon + text. |
| **Data** | Signal Blue + Graphite | Charts and data visualization. Categorical palettes are data-only and colorblind-safe (§37). |

### 4.4 Why these hues (and not others)

| Hue | Why chosen | What we deliberately avoided |
|-----|-----------|------------------------------|
| Graphite (cool, blue-tinted) | Reads as engineered metal rather than warm paper; pairs with the instrument metaphor; easier AA contrast than warm grays | Warm/sepia grays (read as "legacy document"), pure black (#000 is too harsh for large surfaces) |
| Signal Blue | The historical language of professional systems (TG-1A §13); calm authority | Purple/indigo (Linear's territory, and it reads "creative tool" not "operations"), neon blue |
| Optic Cyan | Cool, technical, "live signal" association; visually distinct from status green and action blue so AI is instantly scannable | Magenta/violet (creative), orange (caution semantics), bright teal (crypto/gaming territory) |
| Go green | A calm, desaturated "healthy" tone; no neon green | "Toxic" bright greens that suggest gaming health bars |
| Caution amber | Universal caution semantics; amber is the least alarming warning hue | Orange (already used by some alert vendors, visually louder) |
| Critical red | The universal language of critical; desaturated so it stays authoritative without panic | Bright alarm reds (urgency theater), pink |

### 4.5 When to use color

- To identify **state** (health, risk, live/offline, active/inactive).
- To identify **action priority** (primary action on a surface).
- To identify **intelligence** (AI-generated content and provenance).
- To encode **data categories** in charts (colorblind-safe, labeled).
- To guide **attention** to one changed thing per surface.

### 4.6 When NOT to use color

- **Never** decoratively: no colored borders, colored headings, or colored backgrounds without semantic meaning.
- **Never** to brand "personality" (blue buttons everywhere, brand-colored panels).
- **Never** more than one status color per state (a chip is Go *or* Caution *or* Critical, never blended).
- **Never** color-alone to communicate (always icon + text, §41).
- **Never** in gradients, glows, or patterns except the single approved data-viz gradient exception (§37.6).

---

## 5. Color System

### 5.1 Token architecture

Colors exist at two layers, following §54:

- **Primitive tokens** — the raw, unopinionated palette (`graphite-500`, `signal-600`, `go-500`).
- **Semantic tokens** — the named roles the UI actually consumes (`surface-canvas`, `text-primary`, `border-default`, `action-primary`, `status-critical`).

**Rule:** UI code references semantic tokens. Primitives are only touched when new semantic tokens are minted (through the token governance process, §54). This is what makes themes (dark/light) a mapping exercise instead of a code edit.

### 5.2 Graphite — neutral scale (cool, blue-tinted)

| Token | Hex | Use |
|-------|-----|-----|
| `graphite-950` | `#0A0F1A` | Dark canvas (app background, dark theme) |
| `graphite-900` | `#0F1626` | Dark elevated surface (panels, sidebar, header) |
| `graphite-850` | `#141C2E` | Dark raised surface (cards on panels, table headers) |
| `graphite-800` | `#1A2438` | Dark hover states, active rows, insets |
| `graphite-700` | `#232F47` | Dark borders (strong), pressed states |
| `graphite-600` | `#33405C` | Dark borders (default), disabled fills |
| `graphite-500` | `#4A5874` | Muted text on dark (large text / icons only) |
| `graphite-400` | `#6B7A96` | Secondary text on dark (AA for large text); disabled text |
| `graphite-300` | `#94A1B8` | Body text on dark (AA) |
| `graphite-200` | `#C3CBDA` | Primary text on dark (AA) |
| `graphite-100` | `#E2E7EF` | High-emphasis text on dark (AA) |
| `graphite-50` | `#F4F6F9` | Light canvas (light theme) |
| `white` | `#FFFFFF` | Light elevated surfaces, text on colored fills |

### 5.3 Signal Blue — action and primary identity

| Token | Hex | Use |
|-------|-----|-----|
| `signal-50` | `#EEF3FE` | Light-theme tinted backgrounds (selected rows, focus rings) |
| `signal-100` | `#DCE5FD` | Light-theme tinted hover fills |
| `signal-200` | `#BFCEFC` | Light-theme tinted active fills |
| `signal-300` | `#8FA9F9` | Dark-theme focus rings, selected-row tint |
| `signal-400` | `#5C83F5` | Dark-theme interactive hover, selected text |
| `signal-500` | `#2B62F0` | Dark-theme primary action, links, active nav |
| `signal-600` | `#1F4FD0` | Light-theme primary action, links (AA on white) |
| `signal-700` | `#1A3FA8` | Pressed states, hover on dark action |
| `signal-800` | `#123085` | Action text on light tinted fills |
| `signal-900` | `#0E2566` | Deep text accents |
| `signal-950` | `#0A1A4D` | Dark action-button top edge tint (instrument highlight) |

### 5.4 Optic Cyan — intelligence (AI)

| Token | Hex | Use |
|-------|-----|-----|
| `optic-50` | `#EDFAFC` | Light-theme AI tint backgrounds |
| `optic-100` | `#D9F4F7` | Light-theme AI hover fills |
| `optic-300` | `#7FD9E2` | Dark-theme AI focus rings |
| `optic-400` | `#46C6D3` | Dark-theme AI hover, source-chip icons |
| `optic-500` | `#16AFBF` | AI accents: assistant avatar, AI suggestion chips, grounding badges |
| `optic-600` | `#0F97A6` | Light-theme AI accents (AA on white) |
| `optic-700` | `#0E7A86` | AI accent pressed states |

### 5.5 Status — Signal Color Code

The status family is the instrument's warning language: **desaturated, precise, redundant.**

| Token | Hex (dark-safe) | Hex (light-safe) | Meaning | Always paired with |
|-------|------------------|-------------------|---------|---------------------|
| `go-500` / `go-600` | `#1FA96A` | `#157A4B` | Healthy, operational, resolved | ✓ icon (check) + label |
| `caution-500` / `caution-600` | `#D99A1F` | `#B07A14` | Warning, degraded, needs attention | ✓ icon (triangle) + label |
| `critical-500` / `critical-600` | `#DE4A3F` | `#B3342B` | Critical, failure, risk | ✓ icon (octagon) + label |
| `info` | Signal Blue | Signal Blue | Informational (never used for "healthy") | ✓ icon (circle-i) + label |

Supporting tints (fills and backgrounds):

| Token | Hex | Use |
|-------|-----|-----|
| `go-100` / `go-50` | `#D9F2E6` / `#F0FAF4` | Light-theme success fills |
| `caution-100` / `caution-50` | `#F9EDD4` / `#FDF8EE` | Light-theme warning fills |
| `critical-100` / `critical-50` | `#FBDDDA` / `#FEF4F3` | Light-theme error fills |
| `go-400` | `#3FBE85` | Dark-theme Go icon on dark fills |
| `caution-400` | `#E8B545` | Dark-theme Caution icon on dark fills |
| `critical-400` | `#E87068` | Dark-theme Critical icon on dark fills |

### 5.6 Status usage rules

| Rule | Detail |
|------|--------|
| **Sparingly** | Critical styling appears only for genuinely critical conditions. If a screen has more than ~5% critical-colored pixels, it is violating the system. |
| **No blends** | A single condition has exactly one status color. A "degraded but recovering" state is Caution, not Caution-plus-Go. |
| **Redundancy** | Status color + icon + short label, everywhere, always (§41.4). |
| **Calm critical** | Critical states use a flat, desaturated fill and an icon — never pulsing, flashing, or blinking (except the one accessibility exemption in §43.7). |
| **No status on neutral** | Healthy-neutral states ("informational") are plain Graphite, not blue or green. Reserve color for *change* and *risk*. |
| **Charts** | Status colors in charts follow §37.4 and are never the only encoding. |

### 5.7 Dark theme mapping (default console)

| Semantic role | Token |
|---------------|-------|
| `surface-canvas` | `graphite-950` |
| `surface-panel` | `graphite-900` |
| `surface-raised` | `graphite-850` |
| `surface-inset` | `graphite-800` |
| `border-default` | `graphite-600` (on dark) |
| `border-strong` | `graphite-700` |
| `text-primary` | `graphite-100` |
| `text-secondary` | `graphite-300` |
| `text-muted` | `graphite-400` |
| `text-inverse` | `white` |
| `action-primary` | `signal-500`, hover `signal-400`, pressed `signal-700` |
| `intelligence-accent` | `optic-500` |

### 5.8 Light theme mapping

| Semantic role | Token |
|---------------|-------|
| `surface-canvas` | `graphite-50` |
| `surface-panel` | `white` |
| `surface-raised` | `white` (+ `shadow-sm`) |
| `surface-inset` | `graphite-100` |
| `border-default` | `graphite-200` |
| `border-strong` | `graphite-300` |
| `text-primary` | `graphite-900` |
| `text-secondary` | `graphite-600` |
| `text-muted` | `graphite-500` |
| `action-primary` | `signal-600`, hover `signal-500`, pressed `signal-800` |
| `intelligence-accent` | `optic-600` |

### 5.9 When to use / when not to use — color tokens

| Decision | Use | Don't use |
|----------|-----|-----------|
| Action | `signal-500/600` | `optic-500` for generic actions; status colors for buttons |
| AI | `optic-500/600` | Signal Blue for AI identity; green checkmarks on AI success |
| Health | `go-500/600` | Blue for health; green for "successfully saved" system toasts (§30) |
| Warning | `caution-500/600` | Orange; yellow text on white (fails contrast) |
| Critical | `critical-500/600` | Bright red everywhere; pulsing red |
| Text on color | `white`/`graphite-100` | Low-contrast tints |
| Decoration | none | Any primitive color used "because it looks nice" |

---

## 6. Typography System

### 6.1 The philosophy

> **Text is data. Type is set for scanning, precision, and legibility first — personality second. In a monitoring product, a misread number is a safety failure, so typography is engineered before it is styled.**

### 6.2 Typeface selection

| Role | Typeface | Rationale | Fallback stack |
|------|----------|-----------|----------------|
| UI & content | **IBM Plex Sans** | Distinctive, engineered, technical-adjacent humanist sans with excellent screen legibility, precise numerals, and a calm character that differs from the ubiquitous Inter/Geist look. Self-hosted for performance. | `'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` |
| Technical data | **IBM Plex Mono** | Pairs with Plex Sans; used for *values*, not as a motif (TG-1A forbids terminal styling). | `'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace` |

**Rules:**

- **Numbers are tabular** everywhere. All numeric data (scores, percentages, times, IPs) uses tabular figures (`font-variant-numeric: tabular-nums`) so columns and live-updating digits do not jitter.
- **Monospace is a value type, not a theme.** Reserved for device names, IPs, hashes, log excerpts, commands, and code. Never used for headings, labels, or decorative text.
- **Self-hosted fonts only.** No third-party font CDNs (performance §50). Subset to Latin-extended; use `font-display: swap`; preload the UI weights actually used (400, 500, 600).
- **No brand-serif experiments.** The brand is sans-serif (TG-1A §13); serif display type is off-identity.

### 6.3 Type scale (desktop)

Base unit is 1px on a 14px UI default. Scale is tuned for density *and* legibility.

| Token | Size / line-height | Weight | Use |
|-------|--------------------|--------|-----|
| `text-display` | 44px / 1.1 | 600 | Landing surfaces, report covers, empty-state hero titles |
| `text-h1` | 32px / 1.2 | 600 | Page titles, dashboard hero numbers' labels |
| `text-h2` | 24px / 1.3 | 600 | Section titles, report headings |
| `text-h3` | 20px / 1.35 | 600 | Panel titles, modal titles |
| `text-h4` | 16px / 1.4 | 600 | Card titles, table section headers |
| `text-body-lg` | 16px / 1.6 | 400 | Reading content, AI explanations, descriptions |
| `text-body` | 14px / 1.5 | 400 | Default UI text, table cells, forms |
| `text-label` | 13px / 1.45 | 500 | Field labels, list item text, menu items |
| `text-meta` | 13px / 1.4 | 400 | Secondary metadata, timestamps, helper text |
| `text-caption` | 12px / 1.4 | 400 | Dense data captions, axis labels, tabular context |
| `text-eyebrow` | 11px / 1.3 | 600, +0.08em caps | Section eyebrows, status-chip labels, report footers |

### 6.4 Type scale (responsive)

| Breakpoint | Display | H1 | H2 |
|------------|---------|-----|-----|
| < 640px | 32px | 24px | 20px |
| 640–1023px | 36px | 28px | 22px |
| ≥ 1024px | 44px | 32px | 24px |

Body sizes never shrink below 14px (or 13px for dense tables on large screens only; never below 13px on mobile).

### 6.5 Letter-spacing and weights

| Rule | Detail |
|------|--------|
| Display & H1 | `-0.02em` |
| H2, H3 | `-0.01em` |
| Body & labels | `0em` |
| Eyebrow / all-caps labels | `+0.08em` |
| Weight ceiling | 600 in UI. 400 body, 500 emphasis/labels, 600 headings/actions. 700+ only at display scale, sparingly. |

### 6.6 Writing on the surface

- **Maximum line length:** 72 characters for prose (AI explanations, docs, reports). Data and UI never need wrapping guidance beyond 9–11 words per label.
- **Alignment:** left for all reading text; right only for numbers in tables/columns (align numeric columns to the decimal point or right edge); centered only in empty-state hero, cards with a single metric, and modal titles. Never justified.
- **Contrast floors:** body `text-secondary` minimum AA (§41.3); never place 12px text in `text-muted`.
- **Truncation:** single-line truncation with ellipsis is preferred over wrapping in dense tables; always `title`/`aria-label` the full value.
- **Units and precision:** units always shown (`1.2 GHz`, `94%`, `32 °C`); significant figures per §39.3.

### 6.7 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Plex Sans 400/500/600 in the token scale | Novel display fonts, decorative type, Google Fonts CDN at runtime |
| Tabular numerals for all live data | Default proportional numerals in counters, scores, or table columns |
| Plex Mono for values (IPs, hashes, logs, device ids) | Plex Mono for headings, nav, labels, or marketing |
| 11–13px for metadata, 14–16px for content | Any body copy below 13px; justified text; underline-on-hover-only links |

---

## 7. Grid System

### 7.1 The philosophy

> **The grid is the instrument's faceplate: alignment is a trust signal. The system uses a fixed 8pt base grid with optical corrections at large scales, a 4pt half-step reserved for tight data surfaces only.**

### 7.2 The base unit

| Unit | Value | Use |
|------|-------|-----|
| `--space-unit` | 4px | Half-step, for dense data tables, dense lists, chart padding only |
| `--grid-unit` | 8px | Standard spacing, sizing, and alignment unit for everything else |

**Why 8pt:** 8 divides evenly across nearly all screen sizes, produces integers at every major breakpoint (even when halved or doubled), and keeps alignment mathematically predictable — which a precision product needs. The 4pt half-step exists because dense monitoring tables legitimately need tighter rhythm; it is a controlled exception, never a default.

### 7.3 Column grids by breakpoint

| Breakpoint | Columns | Gutters | Outer margins |
|------------|---------|---------|---------------|
| < 640px (mobile) | 4 | 16px | 16px |
| 640–1023px (tablet) | 8 | 16px | 24px |
| 1024–1279px (laptop) | 12 | 24px | 32px |
| 1280–1535px (desktop) | 12 | 24px | 32px |
| ≥ 1536px (large) | 12 | 24px | centered max-width |

### 7.4 Content containers

| Container | Max width | Applies to |
|-----------|-----------|------------|
| `container-wide` | 1600px | Device fleets, network maps, command surfaces |
| `container-content` | 1200px | Standard dashboards, module pages |
| `container-reading` | 720px | Reports, AI explanations, docs, marketing content |
| Full-bleed | viewport | Never for reading content; reserved for data-visualization canvases |

### 7.5 Grid rules

| Rule | Detail |
|------|--------|
| **Elements snap to 8pt** | Component widths, heights, margins, and paddings use 8pt multiples unless a token says otherwise. |
| **Ragged right is fine** | Content must not stretch columns to fill width; whitespace is structure, not waste (§8.3). |
| **Alignment beats decoration** | Shared left edges across a panel's children; align labels with input baselines, numbers to the right. |
| **Optical correction at display scale** | Large display type (44px+) is optically nudged (±2px) to look centered; never globally scaled by 0.5px. |
| **No 1px misalignment** | Hairline misalignments are visible to professionals; rule lines and table separators snap to the pixel grid. |

### 7.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| 8pt multiples for all layout | 4pt as the default rhythm (dense data only) |
| 12-column layout on desktop surfaces | Column counts that don't divide the gutter (e.g., 7 columns) |
| 4-column mobile, 8-column tablet | Desktop layouts squeezed onto mobile |
| Centered max-width containers on large screens | Full-bleed marketing-style rows inside the console |

---

## 8. Layout Rules

### 8.1 The philosophy

> **Layout is the instrument panel: a stable skeleton, layered surfaces, and whitespace that reads as confidence. Navigation chrome is fixed and quiet; the data region is the stage.**

### 8.2 The application shell

```
┌────────────────────────────────────────────────────────┐
│ Header (56px)  — global commands, tenant, user, search │
├──────────────┬─────────────────────────────────────────┤
│ Sidebar      │  Content region                          │
│ (240px,      │  • Page header (title + actions)         │
│  collapsible │  • Panels / tables / forms / canvas      │
│  to 64px)    │                                          │
│              │                                          │
└──────────────┴─────────────────────────────────────────┘
```

| Region | Default size | Behavior |
|--------|--------------|----------|
| Header | 56px | Fixed. Global search, tenant switch, alerts, user. Never scrolls away. |
| Sidebar | 240px expanded / 64px collapsed | Collapsible at < 1280px and by user preference; collapses to icon rail on tablet. |
| Content | Remaining width | Scrolls independently. Max width per §7.4. |
| Command palette | Overlay | `Ctrl/Cmd+K`; global search and navigation (§21.5). |

### 8.3 Layout laws

| Law | Detail |
|-----|--------|
| **Stable skeleton** | Primary navigation and header do not move, re-sort, or animate across page changes. Motion happens *inside* regions, not to the frame. |
| **Whitespace is structure** | Generous spacing (≥ 24px between panels, ≥ 48px between sections) separates meaning; crowded surfaces imply chaotic systems. |
| **Progressive disclosure** | Novices see a calm summary; experts expand detail on demand (drill-downs, filters, "show technical details"). Never hide the *primary* signal. |
| **Left = navigation, right = action** | Navigation and identity on the left; global actions (new, export, connect) on the right. |
| **One primary action per region** | Each panel/screen leads with one primary action (visually strongest, Signal Blue); secondary actions are neutral; tertiary actions live in overflow menus. |
| **Data density is a user setting** | A "density" toggle (Comfortable / Compact) is a supported global preference — never a per-screen hack (§48.3). |
| **Panels layer, they don't stack** | Depth comes from the elevation system (§12), not from nested card borders. |
| **Page header pattern** | Title (H1) + description (≤ 2 lines) + primary action right-aligned; breadcrumbs only when depth exceeds 2 levels (§21.4). |

### 8.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Fixed 56px header + collapsible sidebar on console surfaces | Moving nav during scroll; headers that reflow on hover |
| One primary action per screen | Four equally strong buttons competing for attention |
| Whitespace to separate sections | Whitespace to fill a screen; oversized empty regions |
| Progressive disclosure for expert data | Hiding the fleet health summary behind drill-downs |

---

## 9. Spacing System

### 9.1 The philosophy

> **Spacing is the rhythm of the instrument. A consistent scale prevents both clutter and gaps — both of which read as carelessness to a professional eye.**

### 9.2 The scale

All spacing is derived from the 4px base. Tokens name the unit, so intent is explicit.

| Token | Value | Typical use |
|-------|-------|-------------|
| `space-1` | 4px | Icon-to-label gap, dense table cell padding, gap between inline elements |
| `space-2` | 8px | Small gaps: button icon+label, chip internal, input padding (vertical) |
| `space-3` | 12px | Compact list spacing, input padding (horizontal), tooltip padding |
| `space-4` | 16px | Standard component padding (buttons, chips, table cells), gap between controls in a row |
| `space-5` | 20px | Form field vertical rhythm (between label and input), card internal padding (compact) |
| `space-6` | 24px | Card padding (standard), gap between sibling panels, list section spacing |
| `space-8` | 32px | Panel padding, gap between a page header and first panel |
| `space-10` | 40px | Section spacing inside a page |
| `space-12` | 48px | Between major page sections |
| `space-16` | 64px | Empty-state spacing, report section spacing |
| `space-20` | 80px | Landing/marketing rhythm |
| `space-24` | 96px | Large canvases, network-map padding |

### 9.3 Spacing rules

| Rule | Detail |
|------|--------|
| **Scale-only** | No ad-hoc values (e.g., "27px"). If a design needs it, a token decision is required (§54). |
| **8pt default, 4pt exception** | Layout uses 8pt multiples; 4pt only inside dense data surfaces (tables, charts, chips). |
| **Related = closer** | Label→control ≤ 20px; control→control ≥ 16px (8px inside a toolbar); panel→panel ≥ 24px. |
| **Grouping by gap** | Grouping is expressed by *distance* (and surface), not by visible boxes around everything. |
| **Don't center-align mixed controls** | Vertically center icons with adjacent text; never baseline-misalign inline actions. |

### 9.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| `space-1`…`space-24` tokens only | Pixel values outside the scale |
| 24px panel padding for comfortable reading | 48px padding in dense monitoring tables |
| Gap-based grouping (16–24px) | Rule lines/borders to separate every item |
| 4pt rhythm inside tables and charts | 4pt rhythm on page layout |

---

## 10. Border Radius System

### 10.1 The philosophy

> **Radius is calibrated to surface size — small precision parts get small radius, large instruments get gentle radius, and nothing is arbitrarily rounded. The system reads as machined metal, not as candy.**

### 10.2 The scale

| Token | Value | Use |
|-------|-------|-----|
| `radius-xs` | 4px | Tags, badge corners, small status chips (height ≤ 20px), nested elements |
| `radius-sm` | 6px | Buttons, inputs, selects, segmented controls, table cells (filter chips) |
| `radius-md` | 8px | Small cards, dropdowns, popovers, tooltips, toast |
| `radius-lg` | 12px | Standard cards, panels, table containers, command palette |
| `radius-xl` | 16px | Modals, dialogs, large panels, empty states |
| `radius-full` | 999px | Pills, avatars, toggles, AI source chips, status chips (height ≤ 24px) |

### 10.3 Rules

| Rule | Detail |
|------|--------|
| **Size-proportional** | A 32px button at 8px radius looks broken; a 200px panel at 4px looks harsh. Radius grows with surface size. |
| **No radius soup** | One panel = one radius. Do not mix `lg` and `sm` radii inside a single surface. |
| **Internal rounding** | Nested elements use `parent radius − padding` (roughly one step smaller); inset elements may be `radius-sm` inside `radius-lg` panels. |
| **Full only for true pills** | `radius-full` is reserved for height ≤ 24px elements (chips, toggles, avatars, tabs). Full-round buttons are off-identity (reads consumer). |
| **Never zero on interactive** | Interactive elements have ≥ `radius-sm`. Zero radius only for fully inset, non-interactive elements (image crops, chart canvases). |

### 10.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| 6px buttons and inputs, 12px cards, 16px modals | Pill-shaped buttons; 24px "bubbly" cards |
| Radius proportional to surface | Arbitrary radii per designer whim |
| Inset sub-surfaces with one-step-smaller radius | Mixed radii inside one panel |

---

## 11. Shadow System

### 11.1 The philosophy

> **Shadows are the instrument's depth cue: subtle, directional, and always subordinate to the crisp 1px edge. Depth comes from layering; shadows confirm it.**

### 11.2 The scale

Shadows are tuned per theme. Dark theme shadows are deeper (near-black) because elevation in dark mode is primarily carried by border brightness + surface lift; light theme shadows carry more of the work.

| Token | Light theme | Dark theme |
|-------|-------------|------------|
| `shadow-xs` | `0 1px 2px rgb(10 15 26 / 6%)` | `0 1px 2px rgb(0 0 0 / 40%)` |
| `shadow-sm` | `0 1px 2px rgb(10 15 26 / 6%), 0 2px 6px rgb(10 15 26 / 5%)` | `0 1px 2px rgb(0 0 0 / 45%), 0 2px 8px rgb(0 0 0 / 35%)` |
| `shadow-md` | `0 2px 4px rgb(10 15 26 / 5%), 0 8px 20px rgb(10 15 26 / 10%)` | `0 2px 4px rgb(0 0 0 / 50%), 0 8px 24px rgb(0 0 0 / 45%)` |
| `shadow-lg` | `0 4px 8px rgb(10 15 26 / 6%), 0 16px 40px rgb(10 15 26 / 16%)` | `0 4px 8px rgb(0 0 0 / 55%), 0 16px 48px rgb(0 0 0 / 55%)` |
| `shadow-xl` | `0 8px 16px rgb(10 15 26 / 8%), 0 32px 64px rgb(10 15 26 / 24%)` | `0 8px 16px rgb(0 0 0 / 60%), 0 32px 80px rgb(0 0 0 / 65%)` |

### 11.3 Rules

| Rule | Detail |
|------|--------|
| **Border-first** | Every elevated surface also has a 1px border (`border-default` or stronger). A shadow without an edge reads as a floating ghost. |
| **Two-layer shadows** | The scale uses a near "contact" shadow + a larger "ambient" shadow — this reads natural and calm. |
| **No colored shadows** | No blue or cyan glows. Shadow color is always neutral graphite/black. |
| **Scale discipline** | `shadow-md` is the ceiling for interactive elements; `shadow-lg/xl` are overlay/modals only. |
| **Hover lift is one step** | Hovering an interactive card lifts it exactly one shadow step (`xs→sm`), never two. |
| **No shadows on flat content** | Text, icons, and chart elements never cast shadows. No glow-on-text. |

### 11.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| `shadow-sm` on raised cards, `shadow-md` on dropdowns/popovers, `shadow-xl` on modals | Colored/glowing shadows; deep shadows on every card |
| Border + shadow together for elevation | Shadow-only elevation |
| One-step hover lift | Scale or spin on hover (see §44) |

---

## 12. Elevation System

### 12.1 The philosophy

> **Elevation is a strict ladder: each level means "this surface is now above the instrument, temporarily or persistently." Users should be able to read the state of the interface by the elevation they see.**

### 12.2 The levels

| Level | Name | Treatment | Carried by |
|-------|------|-----------|-----------|
| `elev-0` | Base | Flat, no shadow, `border-default` optional | Canvas background, large flat regions |
| `elev-1` | Raised | Panel background + `border-default` + `shadow-xs/sm` | Cards, panels, table containers, header, sidebar |
| `elev-2` | Overlay | Elevated background + `border-strong` + `shadow-md` + optional `backdrop-blur-sm` | Dropdowns, popovers, tooltips, menus, command palette |
| `elev-3` | Modal | Elevated background + `border-strong` + `shadow-xl` + `backdrop-blur` (4–8px) over a 60% scrim | Modals, dialogs, full form panels |
| `elev-4` | Stage | Full-screen or near-full-screen overlay + `shadow-xl` + scrim | Focused workflows, remote-support session view |

### 12.3 Rules

| Rule | Detail |
|------|--------|
| **No skipping** | Overlays never appear directly over modal-level content without scrim logic; interactive elements jump exactly one elevation level on open. |
| **Scrims** | Overlay scrim = 60% `graphite-950` (dark) or 40% `graphite-950` (light). Modal scrims are non-interactive and dismiss on click (with confirmed-content rules, §26.6). |
| **Backdrop blur is overlay-only** | Blur appears at `elev-2`+ and is *never* a base surface treatment (anti-glassmorphism rule, §3.3). |
| **Elevation is thematic** | Dark theme lifts via brighter surface + border; light theme lifts via surface + shadow. Never invert. |
| **Focus never floats** | Focus states belong to the element, not the elevation: focus rings are drawn on the element's own level (§41.5). |

### 12.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| One elevation per visual hierarchy step | Elevation for decoration ("make this card pop") |
| `elev-2` for any floating menu/tooltip | Floating `elev-1` elements (no shadow + no scrim = ambiguous) |
| Scrim + `elev-3` for anything blocking the screen | Multiple simultaneous modal levels |

---

## 13. Iconography

### 13.1 The philosophy

> **Icons are the instrument's glyphs: geometric, stroke-based, consistent, and always subordinate to text. An icon must be understood in under half a second or it has failed.**

### 13.2 Icon set and style

| Attribute | Standard |
|-----------|----------|
| Set | **Lucide** (as the base library) with a curated approved subset |
| Stroke | 1.5px (`strokeWidth: 1.5`) at 16/20px; 2px only for 24px hero icons |
| Style | Geometric, rounded-square caps, no filled faces, no duotones, no color by default |
| Sizes | `xs` 14px, `sm` 16px, `md` 20px, `lg` 24px. Never scaled by percentage; use the size tokens. |
| Color | Inherits current text color; tinted only by semantic meaning (status, AI) |
| Accessibility | Every icon has an accessible label. Decorative icons are `aria-hidden` and never carry meaning alone (§41.4). |

### 13.3 Icon rules

| Rule | Detail |
|------|--------|
| **One concept, one icon** | An approved icon dictionary is maintained; do not invent a new icon for an existing concept (e.g., "health" is always the shield/heartbeat mark). |
| **Icon + text** | Icons in navigation, buttons, and status are always accompanied by text (or the icon is a recognized, labeled standard like a search magnifier). |
| **No custom illustration-as-icon** | No hand-drawn, filled, or multi-color "cute" icons. Custom icons must be approved by Design Systems and drawn on the 24px grid with 1.5px stroke. |
| **Status icons are fixed** | Go = check-circle, Caution = triangle-alert, Critical = octagon-alert, Info = info-circle. Never swap them. |
| **Motion in icons** | Icons animate only to convey state (spinner = loading, arrow = progress direction). No idle bounce, wiggle, or flash. |
| **Performance** | Icons are inlined (SVG components) — never icon fonts, never image files per icon. |

### 13.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| 16px in buttons/table cells, 20px in nav/empty states, 24px hero | Icons scaled to odd sizes; icons in tooltips without text |
| Lucide subset from the approved dictionary | Unvetted new icons; emoji as UI icons; icon fonts |
| Stroke 1.5 at ≤ 20px | Filled/duotone icons; colored decorative icons |

---

## 14. Illustration Rules

### 14.1 The philosophy

> **Illustration is a calm diagram, not decoration. In a product for engineers, the best illustration is the one that explains the system — a clean schematic over a cartoon, every time.**

### 14.2 The illustration language

| Attribute | Standard |
|-----------|----------|
| Role | Explain concepts, orient users in empty states, support onboarding. Never decorative filler. |
| Style | Flat, geometric, 2D schematic — device shapes, topology lines, panel glyphs on a simple stage |
| Palette | Graphite scale + Signal Blue + one Optic accent. No gradients, no glow, no photo-real textures. |
| Line | 1.5–2px consistent stroke; objects drawn on a 32px grid |
| Atmosphere | A single soft `surface-raised` panel as "stage"; generous negative space |
| Motion | Diagrams may animate *sequentially* to explain flows (§42.5); never bounce or pop |

### 14.3 Rules

| Rule | Detail |
|------|--------|
| **Explains or it exits** | Every illustration must teach: how a device connects, what a health score means, what "degraded" looks like. If it does not explain, remove it. |
| **Schematic over cartoon** | No mascots, no faces, no personality-driven characters. The professional is the hero; the product never needs a sidekick. |
| **Consistent anatomy** | Same device forms and topology icons across all illustrations; drawn from the approved component set. |
| **Empty-state standard** | Empty states use the 32×32px glyph-in-panel pattern (§32.3), not full illustrations. Full illustrations are for onboarding, help center, and marketing only. |
| **Accessibility** | Illustrations carry `alt` text describing the concept; never render meaning in the image alone. |

### 14.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Onboarding flows, help-center explainers, empty-state glyphs | Dashboard chrome, marketing hero backgrounds, loading screens |
| Schematic diagrams of network topology | Photorealistic or 3D renders; clip-art; stock illustration |
| Sequential diagram motion for explanations | Idle animation; illustrations that "celebrate" |

---

## 15. Image Rules

### 15.1 The philosophy

> **Imagery is evidence: real environments, real hardware, real people. Authenticity is the premium signal (TG-1A §13); any image that looks produced rather than real is off-brand.**

### 15.2 Allowed and forbidden imagery

| Allowed | Forbidden |
|---------|-----------|
| Real workstations, server rooms, network closets — photographed plainly | "Futuristic glowing server rooms," holograms, sci-fi renders |
| Real professionals at work (hands on hardware, in a NOC, at a whiteboard) | Stock "business handshake" clichés; models staring at glowing screens |
| Device macro shots (PCB detail, drives, thermal imaging) | Neon/crypto/gaming aesthetics; lens-flare excess |
| Onboarding images of the product itself (real UI screenshots) | Mockup shots with fabricated data |
| Abstract macro photography used as calm texture | Busy, high-contrast backgrounds behind text |

### 15.3 Rules

| Rule | Detail |
|------|--------|
| **Contrast safety** | Never place body text over an image without a ≥ 60% scrim; all text over imagery meets AA (§41.3). |
| **Performance** | Images are compressed, served via the image optimization pipeline, have intrinsic dimensions, and never block render (§50). |
| **Consistency** | A unified grade: cool-neutral tonality, moderate contrast, no heavy filters, no HDR punch. |
| **Data truth** | Screenshots shown in marketing/onboarding must reflect the real product and real-shaped data (TG-1A §14: numbers are sacred). |
| **Redundancy** | Images are illustrative; meaning is never carried by the image alone (always paired with text). |

### 15.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Product screenshots (real), hardware macro, NOC/on-site photography | Sci-fi stock, neon server rooms, people staring at glowing phones |
| Image in onboarding and marketing, one hero max per page | Image as section background behind UI; images inside data panels |

---

# PART B — COMPONENTS

---

## 16. Component Philosophy

### 16.1 The philosophy

> **Components are machined parts: precise, interchangeable, and identical wherever they appear. One component, one behavior, one anatomy — anywhere in the platform.**

### 16.2 Component definition

A component is any reusable UI part owned by the design system: buttons, inputs, cards, tables, dialogs, charts, AI chips, and every state they have. Components are:

- **Singular** — one definition, one implementation, used everywhere. No per-page forks.
- **Atomic** — composed of primitives (typography, spacing, color tokens) and never inline custom values.
- **State-complete** — every state is designed and tested: default, hover, focus, active, disabled, loading, error, empty.
- **Accessible by default** — semantic roles, keyboard, focus, and screen-reader behavior ship in the component (§41).

### 16.3 The component hierarchy

| Layer | Contents | Governed by |
|-------|----------|-------------|
| **Tokens** | Color, type, spacing, radius, shadow, motion | §5–§12, §44 |
| **Primitives** | Icon, button, input, label, chip, tooltip, spinner, skeleton | This document |
| **Composites** | Card, table, form, modal, dropdown, toast, empty/error state | This document |
| **Patterns** | Page header, dashboard layout, AI answer block, report header | §38–§40 |
| **Templates** | Full screens (device detail, fleet view, AI chat, reports) | Derived from patterns |

### 16.4 Component rules

| Rule | Detail |
|------|--------|
| **One source of truth** | Components live in `@techfusion/ui`; screens consume, they never redefine. |
| **Composition over option explosion** | Prefer composing primitives over adding boolean props. If a component needs its 5th variant, it is likely two components. |
| **Variants are named, not styled** | Visual variants are semantic (`variant="destructive"`, not `variant="red"`). |
| **States are properties** | Loading, disabled, error, empty are designed states, not CSS afterthoughts. |
| **Data components are honest** | Any component that displays data must have explicit empty/error/stale states (§32–§35). No silent blanks. |
| **Motion ships with the component** | Component transitions use the motion tokens (§44); teams do not invent per-component animation. |

### 16.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| The shared component for every occurrence of the pattern | Page-local re-implementations "for this special case" |
| Named semantic variants | Ad-hoc visual tweaks via inline styles |
| Composition of primitives for new patterns | New components for minor spacing differences |

---

## 17. Buttons

### 17.1 Definition

The atomic action element. Everything the user *does* starts from a button.

### 17.2 Anatomy

```
┌───────────────┐
│ [icon] Label  │  ← padding: 8px 16px, radius-sm, height 36px
└───────────────┘
```

| Part | Standard |
|------|----------|
| Height | `sm` 32px, `md` 36px, `lg` 44px |
| Padding | 8px 16px (md); icon buttons are square (32/36/44) |
| Radius | `radius-sm` (6px) — never `radius-full` |
| Icon | 16px, 8px from label; leading for actions, trailing for "open/next" |
| Type | `text-body` (14px, 500 weight) |

### 17.3 Variants

| Variant | Use | Visual |
|---------|-----|--------|
| `primary` | The one action on the surface | `action-primary` fill, white text, `signal-700` pressed, `signal-400` dark hover |
| `secondary` | Alternative actions, less important | `surface-raised` + `border-default`, text-primary |
| `ghost` | Tertiary, toolbars, dense tables | Transparent, text-primary, `graphite-800/100` hover |
| `destructive` | Irreversible or dangerous (delete, revoke, disconnect) | `critical-600` fill (light) / `critical-500` (dark), white text |
| `outline-critical` | "Confirm destructive" secondary position | Transparent, `critical-600` text + border |
| `ai` | Action that invokes the AI (analyze, summarize, generate) | `optic-600` accent, 1.5px border, subtle optic tint; AI-specific actions only |
| `link` | Inline navigation-as-action | Text only, `signal-600/500`, underline on hover |

### 17.4 States

| State | Rules |
|-------|-------|
| Default | Per variant |
| Hover | One step brighter (or `surface-inset` for ghost/secondary); no scale, no lift beyond `shadow-xs` on primary |
| Focus | Visible 2px `signal-300/600` ring at 2px offset (§41.5) |
| Active/Pressed | One step darker, offset 0 |
| Disabled | `graphite-600` text on `graphite-800` (dark) / `graphite-200` text on `graphite-100` (light); **never** use disabled as a primary state; explain why a control is disabled (§33) |
| Loading | Label replaced by 16px spinner + `aria-busy`; width locked to avoid layout jump; disabled to input while in flight |

### 17.5 Rules

| Rule | Detail |
|------|--------|
| **One primary per surface** | §8.3. If two actions compete, one becomes secondary. |
| **Verbs, not nouns** | "Connect device," "Export report," "Restore backup." |
| **Safe destructive** | Destructive actions require confirm (dialog §31); never place `destructive` next to a primary "save" without a gap. |
| **Touch targets** | ≥ 44px on touch devices; icon-only buttons keep a 36px hit area with ≥ 36px gap on desktop. |
| **Full width** | Only in mobile cards/forms or empty-state CTAs; never in toolbars. |
| **No stacked equal weights** | A row of 3+ `primary` buttons is a design error. |

### 17.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| `primary` for the one key action, `secondary`/`ghost` for the rest | Two `primary` buttons beside each other |
| `ai` variant only for AI-invoking actions | Optic styling for regular buttons |
| `destructive` + confirm dialog for destructive flows | A destructive action without confirmation in forms that auto-save |
| `link` for navigation inside content | Link-styled buttons where a real link/nav is available |

---

## 18. Inputs

### 18.1 Definition

Text entry: text field, textarea, search, select, combobox, stepper. The instrument's data-entry points.

### 18.2 Anatomy

```
 Label (13px, 500)                    [required *]
┌──────────────────────────────────────────────┐
│ value                       [icon] [clear x] │  height 36px, radius-sm,
└──────────────────────────────────────────────┘   border-default, surface-inset
 helper text (13px, secondary)
```

| Part | Standard |
|------|----------|
| Height | `sm` 32px, `md` 36px, `lg` 44px (matches buttons) |
| Padding | 8px 12px (vertical 8px / horizontal 12px) |
| Radius | `radius-sm` (6px) |
| Background | `surface-inset` (fields are *inset*, the one place the surface recedes) |
| Border | `border-default`; focus: `signal-600/400` 1.5px + ring (§41.5) |
| Placeholder | `text-muted`, never all-caps, never Latin-only |
| Label | Above field (13px, 500), `space-2` gap; never inside the field (disappearing labels break scanability) |

### 18.3 Variants and states

| Variant / state | Rules |
|-----------------|-------|
| Default | Inset field, `border-default` |
| Hover | `border-strong` |
| Focus | 1.5px `signal` border + 2px ring offset 2px (§41.5); content never shifts |
| Error | `critical-600` border + error message (icon + text, §33); never red alone |
| Disabled | `surface-inset` at 50% text, no pointer; explain why if blocking (§33) |
| Read-only | Same as default, no interaction affordances, value selectable |
| `invalid` | Only after user interaction or submit attempt — never pre-validate an untouched field |

### 18.4 Rules

| Rule | Detail |
|------|--------|
| **Labels always visible** | No placeholder-as-label. Placeholder is an example ("e.g., WKS-014"), never the only hint. |
| **Right-aligned suffix space** | Fields carrying units/time keep the unit in a fixed suffix ("30 min", "1.2 GHz") so numbers align. |
| **Consistent height** | Inputs pair 1:1 with button heights in the same row. |
| **Live validation, calm feedback** | Validate on blur or submit, not per keystroke (except length limits and passwords with a meter, §25.6). |
| **Autofill & autocomplete** | Set correct `autocomplete` attributes (this is a UX property, not a browser nicety). |
| **Mobile keyboards** | Correct `inputmode` (numeric, email, tel) per field type. |
| **Monospace for values** | Technical fields (IP, MAC, hash, serial) set in Plex Mono with tabular figures (§6.2). |

### 18.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Inset `radius-sm` fields with visible labels | Floating-label fields; placeholder-only forms |
| Matching input/button heights in rows | 44px inputs next to 32px buttons |
| Explicit error messages with icon + text | Red border only; error text hidden in tooltips |
| Mono for technical values, proportional for prose | Mono everywhere; scripted/uppercase placeholders |

---

## 19. Cards

### 19.1 Definition

A self-contained unit of information and/or action on `elev-1`. Cards are the dashboard's primary data container.

### 19.2 Anatomy

```
┌───────────────────────────────────────────┐
│ Title (h4)          [count]     [menu ⋯] │  header: 16px padding, border-bottom
├───────────────────────────────────────────┤
│                                             │
│   content / chart / data / action           │  body: 24px padding (16px compact)
│                                             │
└───────────────────────────────────────────┘
```

| Part | Standard |
|------|----------|
| Surface | `surface-raised` (elev-1), 1px `border-default`, `radius-lg` (12px) |
| Padding | 24px standard / 16px compact / 32px large |
| Header | Title (h4) left, meta count, overflow `⋯` menu right |
| Footer (optional) | Actions right-aligned, `border-top` hairline |

### 19.3 Card types

| Type | Use |
|------|-----|
| **Stat/metric card** | One primary number + label + optional trend + sparkline; the number is the hero (§38.4) |
| **Content card** | Lists, details, settings groups; may contain nested controls |
| **Action card** | A tile that launches a workflow (connect device, create report); icon + title + description |
| **Chart card** | A chart with title, unit, and range controls (§37) |
| **Interactive card** | Selectable/hoverable in grids; one-step hover lift only (§11.3) |

### 19.4 Rules

| Rule | Detail |
|------|--------|
| **One story per card** | One primary question answered or one primary action. Mixed agendas get split. |
| **Consistent radii per size** | 12px standard; never vary by content. |
| **No card-soup** | Panels in a table-less layout are cards; rows in a table are *not* cards. Do not card-ify tables (§20). |
| **Hover is earned** | Interactive cards show hover; non-interactive cards do not fake it with hover styles. |
| **Empty/error inside cards** | A card always defines its empty, loading, and error content (§32–§36). |
| **Clickable-card affordance** | Entirely clickable cards expose a visible affordance (chevron, "View" link) for accessibility, and the clickable region is one link/button element. |

### 19.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Summary metrics, standalone content units, workflow tiles | Wrapping every table in a card; cards inside cards; floating cards over gradient |
| 24px padding for standard content | Cards with no header, no footer, and no action (likely it's just a panel) |

---

## 20. Tables

### 20.1 Definition

The instrument's data grid — the highest-density, highest-precision component in the platform. Device inventories, alerts, logs, and report data live here.

### 20.2 Anatomy

```
┌──────────────────────────────────────────────────────┐
│ [filter chip] [filter chip]    [Search] [Export] [⋯] │  toolbar (optional)
├──────────────────────────────────────────────────────┤
│ #  Device      Status   CPU    Temp  Health  ⋯      │  header row, 40px
├──────────────────────────────────────────────────────┤
│   WKS-014      ● Go    12%    47°C    94    ⋯       │  row, 44px (comfortable)
│   SRV-021      ● Warn   88%   78°C    61    ⋯       │  / 36px (compact)
└──────────────────────────────────────────────────────┘
```

| Attribute | Standard |
|-----------|----------|
| Container | `surface-panel`, 1px `border-default`, `radius-lg`, header and rows share the panel surface |
| Header row | 13px, 600, `text-secondary`, background `surface-raised`, sticky within scroll |
| Row height | 44px comfortable / 36px compact (global density setting, §48.3) |
| Row hover | `surface-inset`; selectable rows add a `signal` left-edge indicator when selected |
| Cell padding | 12px horizontal, 8px vertical |
| Type | 14px body; numbers right-aligned, tabular figures, `text-primary` |
| Zebra striping | Never. Separators are 1px hairlines (`border-default`), full-width. |

### 20.3 Column rules

| Rule | Detail |
|------|--------|
| **Right-align numbers** | Numeric columns align right (or to the decimal). Text left. Never center mixed types. |
| **Status column pattern** | Icon + short label, e.g., `● Healthy` / `▲ Warning` / `◼ Critical` — color never alone (§41.4). |
| **Fixed behavior columns** | Action columns are right-aligned and sticky when horizontal scroll exists. |
| **Column width intent** | Name/ID columns wider; numeric columns as narrow as their data allows; no equal-width tyranny. |
| **Sorting** | Sortable columns show an affordance (arrow on hover / active state); default sort is documented per table. |
| **Density** | Dense mode is a global setting, not per-table (§48.3). |

### 20.4 Row and bulk rules

| Rule | Detail |
|------|--------|
| **Selection** | Checkbox column on the left; header checkbox = select all on page (with "all N devices" affordance for true select-all). |
| **Bulk actions** | Appear in a floating action bar or toolbar once selection > 0; destructive bulk actions require confirm (§31). |
| **Row actions** | Right-aligned `⋯` overflow; never hidden-on-hover-only primary content. |
| **Long content** | Single-line truncate with ellipsis + `title`; expandable row for detail (cheveron). |
| **Row identity** | Row click selects or navigates — pick one per table and state it in the header; never both silently. |

### 20.5 Table states

| State | Rules |
|-------|-------|
| Loading | Skeleton rows (§36), not a spinner. |
| Empty | In-panel empty state (§32) — icon, title, CTA. |
| Error | In-panel error state (§33) with retry. |
| Pagination | "Load more" for ≤ 1000 rows; numbered pager for larger; always show result count and current position. |
| Live data | Live-updating tables mark recent changes briefly (§44.6) and never shift row position silently. |

### 20.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Tabular data with shared columns (inventories, alerts, logs, reports) | Card grids for comparison data — tables sort, cards don't |
| Sticky headers for scrollable tables | Zebra stripes; borders around every cell |
| Right-aligned numeric columns | Centered numbers; mixed alignment in a column |

---

## 21. Navigation

### 21.1 Definition

The wayfinding layer: sidebar, header, tabs, breadcrumbs, command palette, and in-content links. Navigation is quiet and stable — it is the instrument's frame, not its readout.

### 21.2 Rules

| Rule | Detail |
|------|--------|
| **Stable & predictable** | Primary nav never reorders on state change; active state is persistent and obvious. |
| **Depth discipline** | ≤ 2 levels of sidebar hierarchy (module → section). Deeper paths use page-level tabs or breadcrumbs. |
| **Active state** | Active nav item: `signal-500/600` left indicator + tinted fill + primary text; inactive: neutral. |
| **Current module echo** | The active module's name appears in the page header breadcrumb so users always know where they are. |
| **Keyboard-first** | Full arrow-key nav, `/` focuses command palette, `Esc` always returns (§41.5). |
| **One vocabulary** | Nav labels match module names, doc names, and AI vocabulary exactly (§56.3, TG-1A §16). |

### 21.3 Navigation types

| Type | Use | Rules |
|------|-----|-------|
| Sidebar | Primary module navigation (§22) | The single source of top-level structure |
| Tabs | Sub-navigation within a module's page | `secondary` style; active tab = `signal` text + 2px underline indicator |
| Breadcrumbs | Depth > 2 | Text links + chevron separators; current page = primary text, non-link |
| Command palette | Cross-module search + actions | `Ctrl/Cmd+K`; keyboard-first; grouped results (§26.4) |
| In-content links | Cross-reference within prose | `signal-600/500`, underline on hover; never fake-button styling |

### 21.4 Breadcrumb rules

- Appear only when the user is ≥ 3 levels deep (e.g., Devices → Fleet → WKS-014 → Settings).
- The last item is the current page and is not a link.
- Chevron `›` separators, 16px, muted.

### 21.5 Command palette (Ctrl/Cmd+K)

| Attribute | Standard |
|-----------|----------|
| Trigger | `Ctrl/Cmd+K` anywhere; search icon in header |
| Content | Modules, devices, actions ("Run diagnostics"), settings, reports |
| Grouping | Actions, Devices, Modules — grouped with labels, never one undifferentiated list |
| Behavior | Keyboard-only is fully supported; results update on every keystroke; `Esc` closes; `↑↓` navigates |
| Empty | "No matches for 'xyz'." with suggestions — never a dead end (§32) |

### 21.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Sidebar for modules, tabs for sub-views, breadcrumbs for depth | Sidebar nesting beyond 2 levels; icon-only nav without tooltips at ≥ 1280px |
| Command palette for global navigation | Search-instead-of-nav; burying module nav in hamburger on desktop |

---

## 22. Sidebar

### 22.1 Definition

The persistent left navigation rail. It is the product's structural spine.

### 22.2 Anatomy and behavior

| Attribute | Standard |
|-----------|----------|
| Width | 240px expanded / 64px icon-rail collapsed |
| Surface | `surface-panel`, right `border-default`, full height under header |
| Header area | Product/workspace name + environment badge (Prod/Staging) at top |
| Groups | Module groups with 11px eyebrow labels; items 36px height, `radius-sm` |
| Active | `signal` 3px left indicator + tinted fill + primary text |
| Collapse | Toggle persists; auto-collapses to rail below 1280px; rail shows tooltips (§28) |
| Footer | Collapse toggle, help, and user/logout may live here |

### 22.3 Rules

| Rule | Detail |
|------|--------|
| **Counts inside nav** | Live counts (e.g., 3 alerts) are permitted in a small muted chip — red only if truly critical. |
| **Badges** | New-feature badges are temporary, neutral, and removed after one release cycle. |
| **Scroll** | Nav scrolls independently; groups collapse into scrollable sections rather than endless vertical list. |
| **Custom order** | Modules have a fixed canonical order; users cannot reorder (stable frame). |
| **Accessibility** | Rail-mode items expose `aria-label` + tooltip; all items keyboard-focusable with arrow-key navigation. |

### 22.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Sidebar for the 6–10 canonical modules (Devices, Alerts, AI, Reports, Settings, etc.) | Sidebar for in-page sub-navigation (use tabs) |
| Icon-rail at < 1280px | Removing sidebar entirely at tablet (use drawer + rail) |

---

## 23. Header

### 23.1 Definition

The global 56px bar: identity, tenant, search, alerts, and user. It is the one element always on screen.

### 23.2 Anatomy

```
┌───────────────────────────────────────────────────────────┐
│ [≡]  TechFusion      ⌕  Search…   [alerts] [tenant] [user]│
└───────────────────────────────────────────────────────────┘
```

| Region | Content |
|--------|---------|
| Left | Sidebar toggle, logo mark, product name, environment badge |
| Center-left | Global search (also triggers command palette) |
| Right | Alerts bell (with count), tenant/org switcher, help, user menu |

### 23.3 Rules

| Rule | Detail |
|------|--------|
| **Fixed & quiet** | Never animates, never shrinks/hides on scroll. |
| **No product navigation in header** | Module nav lives in the sidebar; header holds global state (who/where/which org). |
| **Alert bell discipline** | Bell shows a count chip (Go/Caution/Critical reflect severity); clicking opens the notification center (§29), not a firehose. |
| **Tenant switcher** | Shows current tenant with a chevron; MSP users switch tenants here. |
| **User menu** | Profile, preferences (theme + density), API keys, sign out. |
| **Focus order** | `Tab` enters header first from page load; logo is a link to the default dashboard. |

### 23.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Global state, search, tenant, user in a fixed 56px bar | Module actions in the header (they belong in page headers) |
| Alert bell with severity-aware count | Toast/newsletter-style popups from the bell |

---

## 24. Footer

### 24.1 Definition

The bottom region of product pages: status, version, legal. In the console it is minimal and consistent with the surface; on marketing/landing pages it is the standard site footer.

### 24.2 Console footer

| Content | Standard |
|---------|----------|
| Left | Agent connectivity status (Live / Connected / Offline) — real status, honest state |
| Center | Version (e.g., `v1.4.2`) with link to changelog |
| Right | Legal links, support, privacy |

- Height ≤ 40px, `border-top` hairline, `text-meta` type.
- Never a marketing mega-footer inside the product.
- Footer disappears on focused workflows (remote session, report editor) where the user is single-tasking.

### 24.3 Marketing footer

Outside scope of this document's component system but governed by TG-1A: calm, typographic, product-focused, with the same graphite/signal palette.

### 24.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Status + version + legal in the console | Dense link farms, newsletter signups, or social icons inside the product |
| Full footer on marketing pages | Footer that duplicates sidebar navigation |

---

## 25. Forms

### 25.1 Definition

The structured data-entry surface: one or more fields plus actions, built from the input components (§18). Forms are the most failure-prone surface in professional software, so they get the strictest copy and feedback rules.

### 25.2 Form structure

| Element | Standard |
|---------|----------|
| Title | H2 (32px→24px mobile) or H3 in modals |
| Description | ≤ 2 lines, `text-secondary` |
| Field grouping | Related fields grouped in a panel; unrelated groups separated by `space-8` with group titles |
| Field order | Readability order (identity → state → configuration), matching the mental model |
| Actions | Primary on the right; cancel (ghost) beside it; "Save" verbs over "Submit" |
| Column rhythm | 12-col grid: single-column ≤ 600px fields, two-column 600–1000px, three only in advanced settings |

### 25.3 Labeling rules

| Rule | Detail |
|------|--------|
| Labels above fields, always visible (§18.4) | |
| Required marked `*` + a single legend "required" note at top | |
| Labels are nouns or noun phrases ("Device name") | |
| Optional fields are marked "Optional" inline, not by omission | |

### 25.4 Validation and feedback

| Rule | Detail |
|------|--------|
| Validate on blur / submit, not per keystroke (§18.4) | |
| Error messages: what's wrong + how to fix, in one line (§33) | e.g., "Use a name longer than 3 characters." |
| Inline per-field errors above/right of the field, never only in a toast | |
| Form-level error banner if multiple fields failed or a server error occurred | |
| Success feedback is calm: a subtle inline confirmation or toast (§30), never celebratory | |
| Disabled fields explain why ("Locked — update the plan to change retention") | |

### 25.5 Form states

| State | Rules |
|-------|-------|
| Idle | Clean, all labels visible, no validation noise |
| Focused | Single field focused; the rest recede |
| Invalid | Error on the invalid field(s) + banner if systemic |
| Saving | Primary button spinner + `aria-busy`; inputs locked; "Saving…" label |
| Saved | 150ms inline check or toast; no page reload, no jump |
| Error (server) | Non-destructive banner at top + preserve all entered values |

### 25.6 Special field rules

| Field | Rule |
|-------|------|
| Password | Show/hide toggle; strength meter only for account creation; `autocomplete="new-password"` |
| Device/tenant selectors | Searchable comboboxes for lists > 6; never long scroll-selects |
| Date/time | Native-pattern picker, keyboard-friendly; timezone displayed explicitly |
| IP / network | Mono type, tabular figures, inline format hints |
| API keys | Masked by default, single "reveal" action, copy with confirm |
| Number fields | Unit suffix fixed right (§18.4); min/max visibly stated |
| Toggle switches | Boolean states only; immediately applied, labeled "On/Off", §28.5 |

### 25.7 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Labeled, grouped, single-primary-action forms | Modal-per-field wizards for simple forms; save-in-hidden-state (auto-save without indication) |
| Inline validation after interaction | Blocking validation on first focus |
| Primary "Save" + ghost "Cancel" | "Submit"/"Reset" vocabulary; destructive save-buttons |

---

## 26. Modals

### 26.1 Definition

A blocking overlay panel (`elev-3`) for a focused task: create/edit a device, configure a report, confirm a tenant change. Modals pause the surface — use them only when pausing is right.

### 26.2 Anatomy

```
        ┌────────────────────────────────────────┐
        │  Title (h3)                 [ × ]      │  header: 20px padding, border-bottom
        │────────────────────────────────────────│
        │                                        │
        │  content (scrolls internally)          │  body: 24px padding
        │                                        │
        │────────────────────────────────────────│
        │  [Cancel]  [Primary action]            │  footer: right-aligned, border-top
        └────────────────────────────────────────┘
        scrim: 60% graphite-950, backdrop-blur 4-8px
```

| Attribute | Standard |
|-----------|----------|
| Width | `sm` 440px, `md` 560px, `lg` 720px, `xl` 960px (reports/previews) |
| Radius | `radius-xl` (16px) |
| Surface | `surface-raised` + `border-strong` + `shadow-xl` |
| Scrim | 60% `graphite-950`; click-to-dismiss only for non-destructive content |
| Motion | 200–300ms enter: fade + 12px→0 translateY, `ease [0.16,1,0.3,1]` (§44) |
| Focus | Trapped inside modal on open; restored to trigger on close |

### 26.3 Rules

| Rule | Detail |
|------|--------|
| **One task per modal** | One title, one primary action. Two-step tasks become a wizard (stepped modal) or the parent form. |
| **Header echo** | The title restates the task ("Add device"); never a generic "Form". |
| **Scroll** | Content scrolls internally; the footer stays fixed and actionable. |
| **Dismiss** | `Esc` and × always available; scrim-click dismisses only when nothing is being entered or the content is non-destructive. |
| **Destructive protection** | Confirmation modals (§31) never dismiss on scrim-click; the destructive action requires an explicit click. |
| **Overflow** | Long lists inside modals use in-modal search + virtualized lists, not a scroll monster. |
| **Stacking** | One modal at a time; a second modal opens *above* only for a dependent confirmation, never two independent tasks. |
| **Width discipline** | Widths from the scale only; never 100vw-minus-margin popovers. |

### 26.4 Command palette as modal

The command palette follows modal chrome (scrim, elevation, focus trap) but is a *search overlay*: `md` width, top-anchored, no footer, keyboard-first (§21.5).

### 26.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Focused create/edit/config tasks | Navigation between pages (use routes) |
| Confirmation of consequential actions (with §31 dialog) | Simple inline actions (use inline controls) |
| Multi-field wizards when genuinely sequential | Modals over modals; full-screen forms squeezed into `sm` |

---

## 27. Dropdowns

### 27.1 Definition

A lightweight `elev-2` menu triggered by a control (select, kebab, action menu). Dropdowns reveal options; they do not block work.

### 27.2 Anatomy

```
┌─────────────────────────┐
│ Search (if > 6 items)   │
│─────────────────────────│
│ ● Selected option       │
│   Option two            │
│ ─────────────────────── │
│ Danger action           │  (separated, destructive styling)
└─────────────────────────┘
```

| Attribute | Standard |
|-----------|----------|
| Surface | `surface-raised`, `border-strong`, `shadow-md`, `radius-md` (8px) |
| Item height | 36px, `radius-sm`, padding 8px 12px |
| Motion | 150–200ms: fade + 8px→0 translateY on open; instant or 120ms fade on close (§44) |
| Position | Anchored to trigger; flips to fit; never overflows viewport |
| Dismiss | `Esc`, outside click, item selection |
| Focus | Focus moves into the menu; `↑↓` navigates; `Home/End`; restores to trigger on close |

### 27.3 Rules

| Rule | Detail |
|------|--------|
| **Open downward, flip up** | Align menu's leading edge with trigger; flip before overlapping the viewport. |
| **Selection state** | Current value shown with a check; multi-select uses checkboxes inside the menu. |
| **Grouping** | Groups with 11px eyebrow labels; dividers only between semantic groups. |
| **Danger inside menus** | Destructive items at the bottom, separated by a divider, `critical` text; they trigger confirm (§31). |
| **Scroll** | Menus > 8 items scroll internally with a visible scrollbar; searchable when > 6. |
| **No flyouts as primary nav** | Dropdowns are actions/options, not the wayfinding system (sidebar is). |
| **Disabled items** | Present but disabled with a reason via tooltip (§28); never hide the option silently. |

### 27.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Actions per row (⋯), select options, tenant switcher, bulk-action bars | Replacing radio groups or segmented controls with dropdowns |
| Short option lists | Multi-level nested flyout menus (use a page or wizard) |

---

## 28. Tooltips

### 28.1 Definition

A micro `elev-2` label that clarifies an element on hover/focus. Tooltips identify; they never carry primary instructions or data that must be acted on.

### 28.2 Anatomy

| Attribute | Standard |
|-----------|----------|
| Content | 13px, ≤ 2 lines, no interactive elements |
| Surface | `graphite-700` (dark) / `graphite-900` (light) with `white` text — inverse of surface, always readable |
| Radius | `radius-md`, `shadow-sm` |
| Position | Above trigger by default; flips as needed; offset 8px |
| Delay | 500ms open, 100ms close (desktop); hover + focus both trigger |
| Motion | 80–120ms fade, 4px→0 translateY; respects reduced motion (§44.7) |

### 28.3 Rules

| Rule | Detail |
|------|--------|
| **Identification only** | Name, define, or clarify — never primary instructions ("click here"), never a second set of actions. |
| **Not for critical content** | Never hide errors, required info, or confirmation behind a tooltip. |
| **Accessibility** | Tooltips are `role="tooltip"` linked via `aria-describedby`; focusable triggers show them on focus. |
| **Hover + focus parity** | Anything hover-revealed is focus-revealed (keyboard, §41.5). |
| **No tooltips on touch** | Touch devices substitute persistent info or inline text (hover doesn't exist). |
| **No double labels** | If an element already has a visible label, the tooltip must add new information or not exist. |

### 28.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Icon-only buttons in the nav rail/table actions; truncated values; field rationale | Teaching critical flows; replacing error messages; duplicating visible labels |

---

## 29. Notifications

### 29.1 Definition

The persistent in-product message center — the record of alerts and events for the current tenant. Distinct from toasts (§30), which are transient confirmations.

### 29.2 The notification center

| Attribute | Standard |
|-----------|----------|
| Access | Header bell (§23.3), count chip shows unread (severity-aware color) |
| Panel | `elev-2` dropdown panel, 400px, grouped by day |
| Item anatomy | Status icon + message + source (device, module) + relative time |
| Rows | 44px comfortable; latest first |
| States | Unread = `signal` left indicator + primary text; read = normal |
| Actionability | Items link to their source (device page, alert detail); "Mark all read" only for a fully seen list |
| Empty | Calm empty state: "No notifications." — no illustration, no celebration |

### 29.3 Rules

| Rule | Detail |
|------|--------|
| **Every notification is a link** | An unactionable alert is noise; each item navigates to its context. |
| **Severity honesty** | Severity follows the Signal Color Code (§5.6): Critical for actual critical, nothing else. |
| **Batching** | Bursts batch ("12 devices went offline") with one expandable item — never 12 identical rows. |
| **Delivery parity** | Push/email/webhook follow the same copy and severity language (§29.4). |
| **Retention** | Notifications persist (30/90 days per plan); they are a record, not ephemeral pings. |

### 29.4 Notification copy standard

> Pattern: **[Condition] on [subject] — [consequence]. [action].**  
> Example: "Disk failure risk on WKS-014 — 2 remaining actions. Open the repair plan."

Copy follows TG-1A §15 tone rules: composed, specific, never urgent-theater. "Critical:" prefix reserved for genuine critical.

### 29.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Persistent alerts/events with a record | Transient confirmations (use toasts, §30) |
| Severity-colored unread counts | Notifying for every minor state change (noise) |

---

## 30. Toasts

### 30.1 Definition

A transient, non-blocking confirmation of an action's outcome (success, error, info). Toasts are the *quiet* acknowledgment layer — they never demand action beyond an optional undo.

### 30.2 Anatomy

```
┌─────────────────────────────────────┐
│ ✓  Report exported   [Undo]    [×] │  success
└─────────────────────────────────────┘
```

| Attribute | Standard |
|-----------|----------|
| Placement | Bottom-right on desktop; top, full-width minus 16px margins on mobile |
| Surface | `surface-raised`, `border-default`, `shadow-md`, `radius-md` |
| Icon | Status icon (check / alert / info) + label + optional action |
| Duration | 4s default; errors persist until dismissed; hovers pause the timer |
| Motion | Enter 200ms (fade + 12px up); exit 150ms fade; stacked toasts push, never overlap |

### 30.3 Types

| Type | Icon + color | Use |
|------|--------------|-----|
| Success | check, Go | Saved / exported / connected |
| Error | octagon, Critical | Action failed — never celebration styling, includes what happened |
| Info | info-circle, Signal | Neutral completion ("Scheduled") |
| **AI** | spark/badge, Optic | AI-generated output ready ("Analysis complete") |

### 30.4 Rules

| Rule | Detail |
|------|--------|
| **Only for action outcomes** | Toasts confirm that *something the user did* finished. Never use them to advertise features or notify server events (that's §29). |
| **One toast at a time** | A new toast supersedes the same-type toast; queue with a hard cap of 3 visible. |
| **No toast for in-flow success** | If the result is visible in the page (a row appears), no toast is needed — the UI change is the feedback. |
| **Undo where reversible** | Deletions/edits expose an immediate "Undo" affordance in the toast (§52.5). |
| **Never essential** | Information critical to the task is never toast-only (§33). |
| **Screen-reader** | Success toasts announce politely; errors use `role="alert"` (§41.6). |

### 30.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| "Saved", "Exported", "Connected", "Deleted (with undo)" | Persistent alerts, onboarding prompts, marketing pings |
| Bottom-right desktop stack | Toast as the only confirmation of a destructive action (needs dialog, §31) |

---

## 31. Dialogs

### 31.1 Definition

The **confirmation dialog**: a focused `elev-3` modal whose single job is to verify a consequential action before it happens. The last line of defense between a click and an irreversible change.

### 31.2 Anatomy

```
        ┌────────────────────────────────┐
        │ ⚠  Discard report?       [ × ] │
        │────────────────────────────────│
        │  Changes made in the last 5    │
        │  minutes will be lost.         │
        │────────────────────────────────│
        │  [Cancel]  [Discard changes]   │
        └────────────────────────────────┘
```

| Attribute | Standard |
|-----------|----------|
| Width | `sm` (440px) |
| Title | Question form ("Delete device?", "Revoke access?") |
| Body | Consequence in ≤ 2 lines, plain language (§33.4) |
| Icon | One status icon (Caution for risky, Critical for destructive) |
| Actions | Ghost "Cancel" (left) + confirm (right); destructive confirm = `destructive` variant |
| Scrim | Full, non-dismissable-by-click for destructive content |
| Motion | 200ms fade; never shake, never pulse (§43) |

### 31.3 Confirmation triggers

Requires a dialog when the action is:

- Irreversible or hard to undo (delete, revoke, disconnect, restore-overwrite).
- Broadly impactful (bulk actions, tenant-wide changes).
- Expensive (starts a long job, sends emails, bills).
- Destructive to data (overwrite a backup).

Does **not** require a dialog when: the action is trivially reversible (renaming with undo, toggles, filters), or the consequence is invisible-and-fixable (dismiss a notification).

### 31.4 Rules

| Rule | Detail |
|------|--------|
| **No "Are you sure?" laziness** | The dialog states the actual consequence ("All 3 alerts for this device will be deleted."), not a generic warning. |
| **Verbs match the action** | Confirm button verb = action verb ("Delete", "Revoke"), never generic "OK". |
| **Default focus** | Focus lands on the *safe* default: Cancel (or the confirm only when the action is already double-typed, §31.5). |
| **Guard against panic-click** | For irreversibly destructive actions, the confirm is a text-verify ("type DELETE") or a hold-to-confirm — for admins and tenants only, not every delete. |
| **No third option** | Exactly two actions: cancel + confirm. A "not now" third path means it's not a confirmation. |
| **Esc behavior** | `Esc` = cancel. Never dismiss a destructive dialog with scrim-click. |

### 31.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Delete/revoke/disconnect/overwrite confirmations | Every navigation away from a form (use save-guard inline) |
| Text-verify for tenant-level destructive actions | Text-verify on routine per-row deletes (a normal dialog suffices) |

---

## 32. Empty States

### 32.1 The philosophy

> **An empty state is a moment of teaching, not a moment of absence. It must answer three questions instantly: where am I, what belongs here, and how do I fill it.**

### 32.2 The three-question pattern

| Question | Answer in the empty state |
|----------|---------------------------|
| What is this place? | Icon + title (H3) naming the surface |
| What goes here? | One sentence, `text-secondary` |
| How do I fill it? | One primary action (or a calm "Learn how" link) |

### 32.3 Anatomy (standard empty state)

```
            ┌──────────────────────────┐
            │   [icon in 32px panel]    │   glyph-in-panel: 56px container,
            │   Title (H3)              │   radius-lg, signal/optic tint, icon 24px
            │   One-line explanation    │
            │   [Primary action]  [ghost]│
            └──────────────────────────┘
```

- Centered, `space-16` vertical breathing room, `max-width: 440px`.
- Icon follows the surface's theme: `signal-500/600` for "configure me", `optic` for AI, status icon where a state is paused.

### 32.4 Rules

| Rule | Detail |
|------|--------|
| **Never empty, never dead** | A data surface always renders an empty state — never a blank panel, never a generic "No data". |
| **Teach, don't apologize** | "No devices yet. Install the agent to see live health here." beats "No devices." |
| **One CTA** | Exactly one primary action; a secondary ghost action max. |
| **Contextual grammar** | Copy distinguishes "no data yet" (before action) from "no matches" (after filtering). |
| **Filter-empty state** | "No devices match your filters" + "Clear filters" ghost button. |
| **Illustration gate** | Full illustration only in onboarding/help (≥ 3 items to teach); surface empties use the glyph-in-panel (§14.3). |
| **Accessibility** | The empty state is real content — it is read by screen readers, not hidden decoration. |

### 32.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| First-run surfaces, filtered-to-zero results, paused flows | Replacing real loading skeletons with instant empty states |
| One clear next step per empty state | Multi-step instruction walls; marketing copy in empty states |

---

## 33. Error States

### 33.1 The philosophy

> **An error is an opportunity to demonstrate accountability (TG-1A §12): say what happened, why it matters, and what to do next — calmly, precisely, without panic styling.**

### 33.2 The error message standard

> Pattern: **[What happened] — [why it matters]. [Next step].**  
> "We couldn't reach the agent on WKS-014. It may be offline. Try reconnecting it."

### 33.3 Error surfaces

| Surface | Form | Rules |
|---------|------|-------|
| Inline field | Below the field, 13px, icon + text | §18.3, §25.4 |
| In-panel | Full-width banner inside the panel | Icon + message + Retry; surface stays scannable |
| Page-level | Non-destructive banner at top | Icon + message + action; content preserved |
| Toast | Transient outcome error | §30.3; persists until dismissed |
| Empty-state error | The panel's whole content failed | "Couldn't load alerts." + Retry; never a spinner that resolves ambiguously (§35) |

### 33.4 Rules

| Rule | Detail |
|------|--------|
| **Human first, technical second** | Plain language, then a collapsible "Technical details" with IDs/timestamps for support. |
| **Never blame the user** | No "you entered" language; no exclamation points; no "Error 500" walls. |
| **One retry affordance** | A single "Try again" per surface; automatic retry only for idempotent reads with backoff. |
| **Preserve input** | Form errors never wipe entered values; navigating back restores the form (§25.5). |
| **Color + icon + text** | Errors are never red-alone (§41.4). |
| **No error styling for warnings** | Caution is Caution; Critical/error styling only for real failures (§5.6). |
| **Error ≠ alert** | An error the user caused is feedback, not a notification (§29). |

### 33.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Actionable errors with a next step | Bare "Something went wrong" without explanation |
| Retry affordance on transient failures | Retry loops that spin forever |
| Calm, composed error copy | Urgency theater: red flashing banners, exclamation stacks |

---

## 34. Success States

### 34.1 The philosophy

> **Success is confirmed, not celebrated. The user's goal was achieved; the interface acknowledges it with a calm, precise confirmation and gets out of the way.**

### 34.2 The success vocabulary

| Level | Expression | Example |
|-------|-----------|---------|
| In-flow | The UI itself changes (row appears, status flips to Go) | A device shows "Healthy" |
| Confirmation | Inline check or toast | "Saved." with Undo where applicable |
| Completion | A completion view (wizards, setup) | "Device connected" + next steps |
| Never | Celebration (confetti, bounce, badges, "Level up!") | TG-1A §24: no gamification |

### 34.3 Rules

| Rule | Detail |
|------|--------|
| **No celebration motion** | Confetti, pop, bounce, and "tada" are forbidden — including onboarding (§42.5). |
| **Result, not process** | Confirmation states state the *result*: "Report exported to PDF." — not "The export was successful." |
| **Lead to next step** | Completion states end with one calm next action ("View device" / "Done"), never a dead end. |
| **Undo where possible** | Success toasts carry Undo for reversible actions (§30.4). |
| **Quiet defaults** | If the UI visibly changed, prefer no toast over toast noise (§30.4). |
| **Numbers stay sacred** | Success copy quotes real figures ("3 of 3 devices connected"), never inflated claims. |

### 34.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Calm check + specific result + optional next step | Fireworks, "Congratulations!", gamified rewards |
| Inline success when the UI reflects it | Success toast duplicating a visible UI change |

---

## 35. Loading States

### 35.1 The philosophy

> **Loading is an honest statement of time, not an apology or a magic trick. The user always knows what is loading, why, and how long it will reasonably take — and the interface never pretends to be faster than it is.**

### 35.2 The loading hierarchy

| Scenario | Treatment |
|----------|-----------|
| First content of a page/section | Skeleton layout (§36) matching final structure |
| Sub-section refresh (live data) | Quiet: content stays, a subtle "Updating…" 13px meta appears; values update on arrival |
| A known-duration action | Button spinner + label ("Connecting…") with locked width |
| Unknown, long, or queued action | Progress with an honest state: spinner + phase label ("Indexing 1,204 log lines…") |
| Background sync | Never shown as a modal; a muted status in the footer/header |

### 35.3 Spinner rules

| Rule | Detail |
|------|--------|
| 16px default (18px in 44px buttons); 20px for section-level |
| Neutral graphite color, 1.5–2px stroke |
| Rotates at 1 rotation per 1.1s, linear — never "bouncy" |
| `aria-label="Loading…"` + `role="status"`; `aria-busy` on the container |
| Spinner is for *in-flight*, skeletons are for *first paint* (§36) — never mix in one surface |

### 35.4 Rules

| Rule | Detail |
|------|--------|
| **No ambiguous spinners** | A spinner that can run forever is a lie (§41 of TG-1A performance: fail fast, state honestly). Cap waits with timeouts → honest error/offline state. |
| **No fake progress** | Percentages must map to real progress (job stages), never a fabricated 0→100. |
| **Optimistic where safe** | Fast reads (toggle, save) may apply optimistically *with* a visible in-flight state and rollback on failure (§52.4). |
| **Never block unnecessarily** | Long jobs degrade to background with notification, not a modal the user watches. |
| **Content stability** | Loading states preserve layout dimensions to prevent jump (§50). |
| **Reduced motion** | Spinners honor reduced motion: a static ring or slow pulse (≥ 2s) replaces rotation (§41.7). |

### 35.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Skeletons for first paint, spinners for in-flight actions, phase labels for long jobs | Indeterminate spinners as page placeholders |
| Honest phase progression | Fake percentage bars; "loading" screens with no indication of what's loading |

---

## 36. Skeleton Loading

### 36.1 Definition

The first-paint placeholder that mirrors the final layout — the instrument's faceplate rendered before the readings arrive.

### 36.2 Anatomy

| Attribute | Standard |
|-----------|----------|
| Blocks | Rounded `radius-sm`–`lg` rectangles/rings matching final element shapes |
| Color | `graphite-800` (dark) / `graphite-100` (light) base, with a 40% brighter shimmer sweep |
| Shimmer | Linear sweep, 1.6s, `ease`, width 60% — subtle, never strobe (§43.6) |
| Reduced motion | Static blocks, no shimmer (§41.7) |
| aria | `aria-hidden="true"` on the skeleton; the region announces "Loading…" via `aria-busy` |

### 36.3 Rules

| Rule | Detail |
|------|--------|
| **Mirror the real layout** | Skeleton blocks must match final dimensions and order; a misaligned skeleton is worse than none. |
| **Only for real loads** | Skeletons appear when content is genuinely fetching (> 150ms); instant local content renders immediately. |
| **Never for empty** | An empty surface shows the empty state (§32), not a skeleton — no "skeleton flash then empty". |
| **Exit on data or error** | Skeleton transitions to content or the error state; it never resolves to nothing. |
| **Paragraph skeletons** | For prose (AI answers), skeleton = 3 muted bars of varied width, not a text placeholder. |
| **Performance** | Skeletons use only `background-position`/`transform` animation — never layout-triggering properties (§50.3). |

### 36.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| First paint of tables, charts, panels, dashboards | Sub-second refresh (spinner), empty surfaces, final states |
| Layout-stable placeholders | Skeleton that rearranges layout when content loads |

---

# PART C — DATA & AI

---

## 37. Charts

### 37.1 The philosophy

> **A chart is an argument. It must be readable at a glance, honest at a pixel, and accessible to every eye — because in this product, a chart is often the evidence for a decision a professional is about to make.**

### 37.2 Chart types and their job

| Chart | Job | Use | Don't use |
|-------|-----|-----|-----------|
| Line | Trend over time (temperature, utilization, latency) | Live telemetry, historical trends | Categories without a time axis |
| Area (low-contrast fill) | Volume over time (network throughput) | Bandwidth, disk used | Anything where values overlap confusingly |
| Bar (horizontal) | Ranked comparison (top processes, largest files) | Named categories, long labels | Time series with many points |
| Column | Time-bucketed totals (alerts per day) | Discrete periods | Precise high-frequency telemetry |
| Gauge / radial | One metric vs. threshold (health score, capacity) | Single KPI, dashboard hero | Comparisons, distributions |
| Donut | Part-to-whole (storage split, risk distribution) | ≤ 6 segments, no time dimension | Precise values (bars beat donuts for precision) |
| Scatter / matrix | Correlation and clustering (device fleet by load/temp) | Fleet analytics | Simple trends |
| Sparkline | Micro-trend inside a stat card (§38.4) | Metric context | Standalone storytelling |

### 37.3 Chart rules

| Rule | Detail |
|------|--------|
| **Title + unit on every chart** | "CPU utilization" with the unit (°C / % / GHz) in the header or axis. |
| **Zero matters** | Bar and area charts start at zero (honesty). Line charts may compress the y-axis *only* with an explicit truncated-axis marker (⫴) and the stated min/max. |
| **Precision discipline** | Tooltip values follow §39.3 significant figures; the chart never implies more precision than the data has. |
| **Live data marks** | Live charts show "Live" indicator; a chart paused on stale data labels it "as of 14:02" — never silent staleness (§39.4). |
| **One encoding is enough** | Avoid redundant chart junk: no gridlines beyond 3–5, no every-other tick labels, no 3D, no reflections. |
| **Hover pattern** | A single tooltip, crosshair, or nearest-point highlight; `elev-2` surface, 200ms delay. |
| **Mobile** | Charts below 480px collapse to their primary signal (trend arrow + value) with a "View chart" expand (§37.5). |

### 37.4 Chart color (colorblind-safe)

- **Single-series:** `signal-500/600` line with a soft `signal` fill ≤ 12% opacity; neutral graphite comparison lines.
- **Status in charts:** Go/Caution/Critical only for *threshold bands* or point markers, never the default series color.
- **Multi-series categorical palette (colorblind-safe, ordered by usage):**

| # | Token | Hex |
|---|-------|-----|
| 1 | `signal-500` | `#2B62F0` |
| 2 | `optic-500` | `#16AFBF` |
| 3 | `graphite-600` | `#33405C` |
| 4 | `caution-500` | `#D99A1F` |
| 5 | `signal-300` | `#8FA9F9` |
| 6 | `go-500` | `#1FA96A` |

- Every series has a legend *and* is distinguishable by line style (solid/dashed) or marker in addition to color (§41.4).
- The only permitted gradient is the single-series area fill (series color → transparent). All other gradients are forbidden.

### 37.5 Chart states

| State | Treatment |
|-------|-----------|
| Loading | Skeleton card (§36), not an empty frame |
| Empty | §32 pattern inside the chart panel |
| Error | §33 pattern + retry |
| No data in range | "No readings in this window" with the range stated — never a flat zero line |

### 37.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Line/area for time, bars for ranking, donuts for ≤ 6 parts | Pie charts (donut with direct labels preferred), 3D charts, radar charts |
| Categorical palette + line-style redundancy | Rainbow palettes; status colors as default series colors |
| Truncated axis with explicit marker | Truncated axes without disclosure |

---

## 38. Dashboard Rules

### 38.1 The philosophy

> **A dashboard is the instrument panel of the fleet: the five-second state of the world, a calm hierarchy of signal, and a clear path into detail. Dashboards answer questions; they do not display everything.**

### 38.2 The five-second test

A user must be able to answer three questions in five seconds:

1. **Is anything wrong?** — risk/health summary at top-left (reading order).
2. **What changed?** — recent alerts and deltas visible without scrolling.
3. **Where do I act?** — one clear primary action and visible drill-downs.

### 38.3 Dashboard anatomy

| Region | Content |
|--------|---------|
| Page header | H1 title + description + primary action (right) |
| Summary band | 3–5 stat cards: Health score, risk level, active alerts, devices online, pending updates — the hero numbers |
| Primary panel | The current module's main signal (fleet health chart, alert list, network map) |
| Secondary panels | Related context: recent alerts, top risks, AI summary |
| Footer strip | Data freshness, agent status, generation timestamp (§38.5) |

### 38.4 Stat card pattern

| Part | Standard |
|------|----------|
| Label | 13px, secondary, one line |
| Value | 28px, 600, tabular figures — the hero |
| Delta | 13px with arrow: Go for improvement, Caution for regression, neutral for flat |
| Sparkline | 28px high, `signal` 1.5px, optional |
| Context | Optional caption "vs. 7 days ago" |

- Deltas are never "green = good" blindly: a *decrease in risk* is Go; a *decrease in uptime* is Caution. Direction is contextual (§5.6).

### 38.5 Rules

| Rule | Detail |
|------|--------|
| **One dashboard, one focus** | Each dashboard has a single primary question ("Is the fleet healthy?"). Mixing agendas makes a control room a data dump. |
| **Order = importance** | Reading order is top-left to bottom-right by decision priority, not by module politeness. |
| **Whitespace, not widgets** | Max ~9 major panels; more means the dashboard needs subdivision, not scroll. |
| **Honest freshness** | Every live surface shows data age ("updated 14:02 · 12s ago"). A stale dashboard is a dangerous dashboard (§39.4). |
| **Configurable but bounded** | Users may rearrange panels and choose density — within the canonical layout; no free-form canvas chaos. |
| **Empty-fleet honesty** | A tenant with no devices shows the §32 onboarding empty state, not a wall of zeros. |
| **Print/report ready** | Dashboards are exportable to the report system with identical visual language (§39). |

### 38.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Five-second summary + drill-down paths | Dashboard as the only view (every panel links to its full module) |
| 3–5 hero stats with contextual deltas | 20 live widgets on one screen |
| Live indicators + data age | Silent auto-refresh that shifts values without notice |

---

## 39. Data Visualization

### 39.1 The philosophy

> **Data is shown to be read, not to be admired. Every visual decision — color, scale, labels, rounding — serves the professional's ability to extract a true, precise fact in under a second.**

### 39.2 Universal rules

| Rule | Detail |
|------|--------|
| **Label what you show** | Axes, units, and series are always labeled. Unlabeled axes are a brand violation. |
| **Direct labels over legend-guessing** | In small charts, label the final point/slice directly; legends only when space demands. |
| **Gridlines are references** | 3–5 light `graphite` gridlines max; never every-other-line heavy grids. |
| **No chartjunk** | No 3D, no drop shadows on marks, no gradient fills (except §37.4), no emoticon data points. |
| **Colorblind-safe by default** | The categorical palette (§37.4) is the only chart palette; line-style/marker redundancy is mandatory for ≥ 3 series. |
| **Consistent time axis** | Time runs left→right, newest right, everywhere. Never flip. |
| **Big numbers first** | The primary number is the biggest element; everything else serves it (§38.4). |

### 39.3 Number precision rules

| Data type | Display rule |
|-----------|--------------|
| Percentages | 0 decimals for scores ("94%"), 1 decimal for sub-10% changes |
| Temperature | 1 decimal ("47.3 °C") with unit always |
| Times | Local time + timezone note on any cross-timezone surface |
| Large counts | Thousands separators; "1.2k" only in tight table cells with the exact value in tooltip |
| Scores (health/perf/risk) | Integer 0–100 with its label and trend |
| **Rules** | Never more precision than the sensor; never round a critical value down in display |

### 39.4 Freshness and staleness

| State | Treatment |
|-------|-----------|
| Live | "Live" chip; values update in place with the §44.6 update flash |
| Fresh (< 5 min) | Timestamp meta: "updated 14:02" |
| Stale (> 5 min / configurable) | 13px Caution meta "data as of 14:02" + subtle warning icon |
| Offline | Explicit offline banner; surfaces render last-known values clearly labeled as last-known (§33) |

Staleness is never silent — a real-time product that quietly freezes is lying about the state of the world (TG-1A §20).

### 39.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Table + chart duality (both available for the same data) | Charts as the only representation of precise data |
| Direct labels, honest zeros, disclosed truncation | Chart-driven ambiguity (vague "high/mid/low" without numbers) |

---

## 40. AI Components

### 40.1 The philosophy

> **AI is the product's most powerful and most dangerous surface. The design language treats AI as a trusted advisor who always shows its homework: every answer is sourced, every certainty is labeled, and every consequential action stays human-approved.**

### 40.2 The AI design vocabulary

| Element | Standard |
|---------|----------|
| Identity color | `optic` cyan — AI-only (§5.3). Never used for non-AI elements. |
| Assistant avatar | 24px Optic glyph (the AI mark) — consistent, calm, no face, no animation by default |
| AI surface | Chat panel or inline block on `surface-panel` with `border-default`; the Optic accent appears in marks, not surfaces |
| Typography | `text-body-lg` prose, `container-reading` width (§7.4), sources below the answer |

### 40.3 The grounded AI answer block

```
┌────────────────────────────────────────────────┐
│ ○ TechFusion Assist            [Copy] [⋯]      │
│────────────────────────────────────────────────│
│  The device is likely overheating. GPU          │
│  temperature hit 91 °C at 14:02, while the      │
│  thermal threshold is 90 °C.                    │
│────────────────────────────────────────────────│
│  Sources  [log-line] [sensor-read] [KB-214]     │  source chips
│  Confidence  ● High — 3 sources, 1 open item    │  confidence line
│  [Apply suggested fix]  [Ask follow-up]         │  human-confirm CTA
└────────────────────────────────────────────────┘
```

### 40.4 Grounding rules (the anti-hallucination UI)

| Rule | Detail |
|------|--------|
| **Source chips on every claim** | Each substantive claim carries 1–3 source chips (§40.6). Zero sources = the answer must say so explicitly: "I couldn't find grounding for this — here's what's known." |
| **Confidence line** | Stated in plain language ("High — 3 sources", "Low — conflicting readings"), never a vague percentage. |
| **Uncertainty is visible** | Uncertain answers use neutral styling (no Caution theater) but lead with the uncertainty: "Readings conflict. Likely cause: …". |
| **Citations are tappable** | Every source chip opens the actual evidence (log line, KB article, sensor graph) in context — the verifiable interface (§3.2). |
| **No invented precision** | AI numbers quote the parsed source values with units (§39.3); never fabricated figures. |
| **Human approval** | Consequential suggestions (apply fix, restore, disconnect) render a prominent `human-confirm` CTA, not an auto-run. |

### 40.5 AI states

| State | Treatment |
|-------|-----------|
| Idle | Prompt bar with suggested prompts ("Analyze WKS-014", "Summarize today's alerts") |
| Thinking | "Reading logs…" / "Checking KB…" phase label with the §35 spinner — the model's actual stages, honestly named |
| Streaming | Text appears token-by-token; block layout is reserved in advance (no jumping) |
| Complete | Answer + sources + confidence + confirm CTA |
| No grounding | Explicit "I couldn't verify this" block with what it did check |
| Error / offline | §33 error pattern; retry; the model/provider never silently fails |
| AI availability | A header status chip shows provider health honestly ("Fallback: Anthropic") |

### 40.6 Source chip anatomy

| Attribute | Standard |
|-----------|----------|
| Form | `radius-full` pill, 24px, Optic 1.5px border, optic tint fill (≤ 12%) |
| Content | Type glyph + short name: `log-line` `sensor-read` `kb-214` `vendor-advisory` |
| Behavior | Tappable → opens the evidence in a panel/preview; keyboard-focusable |
| Count | 1–3 chips per answer; "3 sources" collapse for more |

### 40.7 AI suggestion rules

| Rule | Detail |
|------|--------|
| **Suggested actions are optional** | AI suggestions render as calm Optic chips with a dismiss (×); never as popups that hijack focus. |
| **One suggestion per surface** | Max one AI suggestion block per panel; competing suggestions are merged. |
| **No personality** | No emoji, no conversational flourish, no "As an AI…" filler (TG-1A §15). Professional, plain, sourced. |
| **Transparency of usage** | The model and provider are visible in the answer footer ("Anthropic · claude-*") — auditability is UI. |
| **Never gaming-style** | No typing-bubble theater, no "thinking dots" beyond the honest phase label (§40.5). |

### 40.8 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Optic identity + source chips + confidence + human-confirm on every AI surface | AI styling for non-AI features; sparkle overload |
| Honest phase labels while thinking | Fake "typing…" theater; hidden provider/uncertainty |
| Suggested chips with dismiss | Auto-popups; AI taking consequential action without confirmation |

---

# PART D — ACCESSIBILITY

---

## 41. Accessibility Standards

### 41.1 The philosophy

> **A professional tool must be usable by every professional (TG-1A §19). Accessibility is a usability requirement baked into components — not a compliance audit at the end. In a monitoring product, the colorblind operator, the keyboard-only admin, and the low-vision technician are not edge cases; they are the customer.**

### 41.2 Baseline

| Standard | Requirement |
|----------|-------------|
| WCAG | 2.2 AA minimum across light and dark themes; AAA targeted for contrast and label clarity where practical |
| Screen readers | NVDA, VoiceOver, and TalkBack support; semantic roles, not div soup |
| Keyboard | Every workflow reachable without a mouse; full focus visibility |
| Testing | Automated (axe) in CI + manual passes per release; screen-reader QA on major flows |

### 41.3 Contrast rules

| Element | Requirement |
|---------|-------------|
| Body text / primary text | ≥ 4.5:1 (AA); primary target 7:1 |
| Large text (≥ 24px) and UI components | ≥ 3:1 |
| `text-secondary` | ≥ 4.5:1 in light; ≥ 7:1 preferred in dark |
| `text-muted` | Never below 4.5:1 on its background — if it can't pass, it isn't a text color |
| Focus indicator | 3:1 vs. adjacent, ≥ 2px, with 2px offset (§41.5) |
| Status colors | Foreground icon/label ≥ 3:1 on their fill; text on fills ≥ 4.5:1 |

Concrete pairings already validated in the palette (§5): `text-primary` on dark uses `graphite-100`; `text-secondary` on dark uses `graphite-300`; `text-muted` (graphite-400) is **large-text-only** on dark surfaces.

### 41.4 Color never alone

| Rule | Detail |
|------|--------|
| Every status | Icon + text + color (the Signal Color Code, §5.6) |
| Every chart series | Color + line style/marker + legend (§37.4) |
| Every link | Underline on hover *plus* a non-color cue (text emphasis); links in running text always underlined |
| Every form error | Icon + message + (border) — §18.3 |
| Selection states | Border/fill change + checkmark or row indicator, not tint alone |

### 41.5 Keyboard and focus

| Rule | Detail |
|------|--------|
| **Complete keyboard parity** | Tab order follows visual order; every interactive element is reachable; `Esc` closes overlays; arrows navigate menus/lists. |
| **Focus is always visible** | 2px ring, `signal-600` (light) / `signal-300` (dark), offset 2px. Never remove the ring; `outline: none` is forbidden unless a custom ring replaces it. |
| **Focus trap** | Modals and dialogs trap focus; returning focus to the trigger on close (§26.2). |
| **Skip link** | "Skip to content" first on every page. |
| **Landmarks** | `header`, `nav`, `main`, `footer` regions; one `main` per page; correct heading hierarchy (one H1). |
| **Shortcuts** | Documented shortcuts (`Ctrl/Cmd+K`, `/`, `?` help) — never single-key actions without modifiers on content surfaces. |

### 41.6 Screen reader truth

| Rule | Detail |
|------|--------|
| Labels describe meaning | "Health score: 94 of 100 (Healthy)" — never layout ("top left card"). |
| Live regions | Live data updates announce via `aria-live="polite"` (sparingly); toasts `role="status"`, errors `role="alert"`. |
| Progress | Loaders and skeletons announce completion state via `aria-busy` toggling (§35, §36). |
| Icons | Meaningful icons have `aria-label`/`title`; decorative icons are `aria-hidden`. |
| Tables | Real `<table>` semantics or role-complete grids; `aria-sort` on sortable columns; summaries via `caption`. |
| Forms | Labels associated (`for`/`id`); errors linked via `aria-describedby`. |
| AI | AI answers read as content with the sources listed; "AI-generated" announced once per block, not per line. |

### 41.7 Motion reduction

| Rule | Detail |
|------|--------|
| Honor `prefers-reduced-motion` | Collapse all transform/scale animation to opacity-only, or remove entirely. |
| Zero-motion floor | Information is never carried by motion alone (§43.5) — so removing motion changes nothing semantically. |
| Replacements | Spinner → static ring with pulse ≥ 2s; shimmer → static; slide → fade (or instant). |
| User override | A manual "Reduce motion" setting overrides the OS pref (persisted per user). |
| No exception | Charts, dashboards, and AI states all honor reduced motion. There is no "but it's cool" clause. |

### 41.8 Cognitive and motor accessibility

| Rule | Detail |
|------|--------|
| **No time pressure** | No timed interactions that block work; session timers warn and never silently destroy state. |
| **Generous targets** | ≥ 44px touch targets on mobile; ≥ 36px on desktop for icon-only controls (§17.5). |
| **Predictable layout** | Navigation and structure stable (§8.3); no layout jumps or auto-morphing controls. |
| **Plain language** | TG-1A §15 copy standards everywhere; complex topics offer technical detail on demand. |
| **Density without damage** | The Compact density setting is opt-in and never shrinks focus rings, touch targets, or readable text below §41.3. |

### 41.9 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| AA everywhere, AAA for text contrast targets | A "compliance theme" that differs from the real UI |
| Automated + manual accessibility QA per release | Treating accessibility as a final checklist after design freeze |

---

# PART E — MOTION

---

## 42. Motion Philosophy

### 42.1 The philosophy

> **Motion is the system breathing: quick, calm, purposeful, and honest. It explains state changes, directs attention to what changed, and never, ever performs. In this product, motion is information — not decoration.**

### 42.2 The six motion laws

| Law | Meaning |
|-----|---------|
| 1. **Every animation has a job** | Explain a state change, show direction, focus attention, or confirm cause→effect. Idle animation is removed. |
| 2. **Fast over fancy** | 80–300ms for everything; perceived responsiveness beats choreography (§50). |
| 3. **Damped, not bouncy** | One smooth approach to rest; overshoot/spring is forbidden (it reads playful). |
| 4. **Direction means something** | Menus grow from their trigger; modals rise; toasts arrive bottom-right; back is the reverse. Never arbitrary. |
| 5. **Nothing essential animates** | Load-bearing information never fades in/out of existence; content may appear, then settle. |
| 6. **Reduced motion is a first-class state** | §41.7 — motion is enhancement, never carrier of meaning. |

### 42.3 What this means concretely

- A dashboard value updates: it eases into its new value in 200ms — no confetti, no flash.
- A menu opens: it fades and slides 8px from its trigger in 150ms — no spring.
- An AI answer streams: it types steadily with a reserved layout — no bouncing dots.
- A critical alert arrives: it places itself calmly at top of the list with a 2s `signal` flash — no siren animation (§43.7).

### 42.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| State-change explanations, directional reveals, live-update flashes | Page-load logos, idle looping, hover bounce, parallax, scroll-jacking |
| 80–300ms damped easing | Springs, overshoot, elastic, wobble |
| Motion that aids comprehension | Motion that must be "turned off" to work comfortably |

---

## 43. Animation Rules

### 43.1 Duration scale

| Token | Duration | Use |
|-------|----------|-----|
| `motion-80` | 80ms | Micro feedback: color, opacity, press, focus ring |
| `motion-150` | 150ms | Instant UI: button hover/press, checkbox, toggle, icon swap |
| `motion-200` | 200ms | Standard: menus, dropdowns, tooltips, list reorder, value updates |
| `motion-300` | 300ms | Panels: modals, dialogs, drawers, command palette, expanded sections |
| `motion-400` | 400ms | Maximum: page transitions, full-screen state changes |

Rule: **nothing animates longer than 400ms.** If a transition feels like it needs more time, the problem is the layout, not the animation.

### 43.2 Easing scale

| Token | Curve | Use |
|-------|-------|-----|
| `ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default enter and state transitions |
| `ease-signal` | `cubic-bezier(0.16, 1, 0.3, 1)` | Big entrances: modals, panels, page transitions (fast start, calm settle) |
| `ease-exit` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits: leaving the screen faster than it entered |
| `ease-linear` | `linear` | Opacity-only, shimmer sweep, continuous rotation |

Rules: no bounce/elastic curves ever; exit is always faster (or equal) to enter; identical easing for the same behavior everywhere.

### 43.3 Distance scale

| Token | Distance | Use |
|-------|----------|-----|
| `motion-d1` | 4px | Tooltips, focus-driven reveals |
| `motion-d2` | 8px | Dropdowns, popovers, menus |
| `motion-d3` | 12px | Modals, dialogs, toasts, panels |
| `motion-d4` | 16px | Drawers, full-panel slides (maximum travel) |

Elements never travel more than 16px for a state reveal. Beyond that, it is a navigation change and should be a page transition, not an animation.

### 43.4 Property rules (what may animate)

| May animate | Must NOT animate |
|-------------|------------------|
| `opacity` | `width` / `height` on critical content (layout shift) |
| `transform: translate/scale` | `top/left/margin/padding` for motion (layout reflow) |
| `color`, `background-color`, `border-color` (≤ 80–150ms) | `box-shadow` on every hover (expensive, §50.3) |
| `background-position` (shimmer) | `filter: blur` in bulk; `backdrop-filter` in bulk |
| SVG stroke-dash (chart draw-in, ≤ 300ms) | `all` shorthand transitions |

### 43.5 Information vs. decoration

| Information motion (always allowed) | Decoration motion (never allowed) |
|-------------------------------------|-----------------------------------|
| Value change flash, status transitions, streaming text | Idle pulsing, floating, parallax, hover wiggles, logo loops |
| Directional open/close, reorder, drag feedback | Marquee, auto-rotating carousels in dashboards |
| Focus/selection transitions | "Attention" shakes for non-critical content |

**Cardinal rule:** if removing the animation would lose no information, the animation is decoration — remove it.

### 43.6 Shimmer and loading animation

| Rule | Detail |
|------|--------|
| Skeleton shimmer | 1.6s linear sweep, 60% width, subtle (≤ 12% luminance delta) — §36 |
| No strobing | No element flashes faster than 3Hz. Ever. (This is a seizure-safety rule, not style.) |
| Reduced motion | Static skeleton, no sweep (§41.7) |

### 43.7 Critical-alert motion (the one exception)

Critical alerts are conveyed **calmly**: they place into the list/panel with a one-time, 2s `signal`-to-normal flash on the row, plus an immediate toast/dialog. Rules:

- No flashing, blinking, pulsing, or shaking under any circumstance (seizure risk + urgency theater, §43.6).
- The exception to static-critical is a *single, short, non-repeating* flash (≤ 2s), and even that yields to reduced motion.
- If a third-party or emergency flow demands attention, use an `aria-live="assertive"` announcement + persistent placement — never motion.

### 43.8 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| The token scale (80–400ms, allowed properties) | Ad-hoc durations/curves per feature |
| Information motion (§43.5 left column) | Any decoration motion (§43.5 right column) |
| One-time calm flash for changes | Looping attention effects; anything > 3Hz |

---

## 44. Transition Rules

### 44.1 Definition

Transitions are the motion between two states of the same element (as opposed to animations, which are scripted sequences). The rules below make transitions consistent across components.

### 44.2 Standard transitions by component

| Component | Enter | Exit |
|-----------|-------|------|
| Button hover/press | 80–150ms color/bg | — |
| Dropdown / menu | 150ms fade + 8px | 120ms fade |
| Tooltip | 80ms fade + 4px | 80ms fade |
| Modal / dialog | 200–300ms fade + 12px + scale 0.98→1 | 150ms fade |
| Toast | 200ms fade + 12px up | 150ms fade down-out |
| Expanded section | 200–300ms height via transform (measured, not animating layout) | 150ms |
| Chart draw-in | 300ms stroke/bar grow (`ease-signal`) | — |
| Value change | 200ms ease into new number (tabulated) | — |
| Page change | 300–400ms cross-fade + 8px, content regions only | 200ms |

### 44.3 Rules

| Rule | Detail |
|------|--------|
| **Symmetric in intent, asymmetric in speed** | Exit is always faster than enter; the *path* is the reverse of the enter path. |
| **Staggering** | Multi-item reveals stagger 40–60ms per item, max 6 items, total ≤ 300ms. Used for lists/skeletons only. |
| **Interruptible** | Transitions cancel cleanly on reverse action (fast open menu then fast close = no ghosting). |
| **Reduce on scroll** | Scroll-triggered motion only for progressive content; never for persistent chrome. |
| **No transition on mount churn** | The frame (header, sidebar) never transitions on page change — content only (§8.3). |
| **Match motion to density** | Compact density shortens durations by ~25% (150→110ms) — a user preference, not per-screen. |

### 44.4 Live-data update flash

When a value changes in a live surface:

- The changed value eases to its new figure over 200ms with a one-time `signal` tint fading over 1.5s (Go for improvement, Caution for regression).
- New rows highlight once (≤ 2s) and settle — no persistent "NEW" badges.
- Row positions never silently jump; reordering animates along the grid path (200ms), so the eye can follow.

### 44.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Component transitions from §44.2 | Per-feature invented transitions |
| Reverse-path exits, faster exits | Enter/exit asymmetry that feels abrupt (same curve, faster duration) |
| Measured-transform expands | Layout-shifting transitions that move siblings |

---

# PART F — RESPONSIVE

---

## 45. Responsive Philosophy

### 45.1 The philosophy

> **One product, every screen. The instrument adapts its frame, not its character: the same calm precision on a 4-inch phone in a data closet and a 34-inch panel in a NOC. Responsiveness is re-layout, never redesign.**

### 45.2 The principle

- **Mobile** is not "the desktop squeezed"; it is a deliberate priority order: the primary signal first, secondary context after, actions always reachable.
- **Desktop** is not "mobile stretched"; it uses the full canvas for the instrument panel (§48).
- At every size: same component, same behavior, same vocabulary — only arrangement changes.

### 45.3 Rules

| Rule | Detail |
|------|--------|
| **Content-first breakpoints** | Breakpoints are set where content breaks (§45.4), and every page defines its primary signal *before* its chrome. |
| **Chrome collapses, content grows** | Navigation collapses to rails/drawers; content regions consume the saved space (§46). |
| **No mobile-specific redesigns** | The same components reflow; new "mobile components" require design-system review. |
| **Test every state at every size** | Tables, charts, modals, and dialogs each have defined small-screen behavior (§46.4–§46.5). |
| **Touch parity** | Everything hover-revealed has a tap alternative; tooltips become inline text (§28.3). |
| **Performance scales down** | The mobile budget is tighter (§50.4): fewer bytes, same honesty. |

### 45.4 Breakpoint tokens

| Token | Range | Common devices |
|-------|-------|----------------|
| `bp-mobile` | < 640px | Phones |
| `bp-tablet` | 640–1023px | Tablets, small laptops portrait |
| `bp-laptop` | 1024–1279px | Small laptops |
| `bp-desktop` | 1280–1535px | Standard desktops |
| `bp-large` | ≥ 1536px | Large monitors, 4K |

### 45.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Reflow-first responsive design on every screen | Separate mobile and desktop "versions" of the product |
| Tested states at every breakpoint | Mobile behavior discovered in QA |
| Primary-signal-first priority | Hiding core signals on small screens |

---

## 46. Mobile Rules (< 640px)

### 46.1 Frame

| Element | Behavior |
|---------|----------|
| Header | 56px fixed; global search icon collapses to a button that opens command palette full-screen |
| Sidebar | Hidden; a full-height drawer (≥ 80% width) slides from the left via the hamburger; rail mode never used |
| Content | Single column, 16px margins, `container-content` width |
| Footer | Status line only; legal links collapse into the user menu |

### 46.2 Priority order

1. Primary signal (health, status, alerts)
2. One primary action (reachable: sticky bottom action bar for forms/flows)
3. Secondary context (reports, details)
4. Settings/advanced (behind navigation, never blocking the main job)

### 46.3 Rules

| Rule | Detail |
|------|--------|
| Touch targets ≥ 44px with ≥ 8px gaps (§41.8) |
| Sticky primary action bar during creation/edit flows ("Save" always visible) |
| Full-width buttons and inputs in forms (§17.5) |
| Table → card pattern: tables become stacked "detail rows" with the 2–3 key columns as the summary line and a chevron into full detail — **never** a horizontal-scroll table by default (§46.4) |
| Charts collapse to stat-card summaries with expand (§37.3); network maps offer pinch-zoom |
| Modals become bottom sheets or full-screen (height ≥ 90%) with the header pinned |
| Command palette is full-screen, search-first |
| Toasts are top, full-width minus 16px margins (§30.2) |

### 46.4 Table-on-mobile pattern

- Default: summary-line cards (device name + status + one key metric) with a chevron → detail.
- Secondary key-value columns follow in the expanded detail.
- Horizontal scroll is reserved for genuinely columnar data (comparison tables) with sticky first column and a visible "scroll →" hint.

### 46.5 Modal-on-mobile pattern

- `sm` modals become bottom sheets: slide up 300ms, rounded top corners (16px), full width.
- The scrim dims the page; swipe-down dismiss only for non-destructive content.
- Focus stays trapped; footer actions remain visible with the keyboard open (safe-area aware).

### 46.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Priority-ordered single column, sticky primary actions | Desktop layouts with pinch-zoom |
| Card-style tables, bottom-sheet modals, top toasts | Hover-revealed actions, multi-column panels, mega footers |

---

## 47. Tablet Rules (640–1023px)

### 47.1 Frame

| Element | Behavior |
|---------|----------|
| Header | 56px fixed; full global search field may appear ≥ 768px |
| Sidebar | Icon-rail (64px) by default, expandable; or hidden behind a drawer per workspace preference |
| Content | 8-column grid, 24px margins; panels reflow 2-up where content allows |
| Footer | Status + version + legal (no collapse) |

### 47.2 Rules

| Rule | Detail |
|------|--------|
| Two-column panels are allowed for summary cards (2 × 2 grid), never for dense tables |
| Touch and pointer both supported: hover states remain, tap targets stay ≥ 44px |
| Command palette renders `md` centered, not full-screen (≥ 640px) |
| Charts render at full fidelity ≥ 768px; below, they follow the mobile collapse (§46.3) |
| Split panes are avoided; one primary column plus an overlay drawer for secondary detail |

### 47.3 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Rail + drawer navigation, 2-up card grids | 3+ column data grids; hover-only interactions |
| Full charts at ≥ 768px | Desktop sidebar (240px) eating tablet width |

---

## 48. Desktop Rules (1024–1535px)

### 48.1 Frame

| Element | Behavior |
|----------|----------|
| Header | 56px fixed, full chrome (search, alerts, tenant, user) |
| Sidebar | 240px expanded ≥ 1280px; icon-rail 1024–1279px; user collapse persisted |
| Content | 12-column grid, 32px margins, `container-wide` ≤ 1600px |
| Footer | Full status line |

### 48.2 Rules

| Rule | Detail |
|------|--------|
| **The instrument panel is home** | Multi-panel dashboards, dense tables, and side-by-side data+detail panes all open up here. |
| **Three-pane pattern** | Master (list) → Detail (selected item) → Context (AI/related) is the desktop power layout. |
| **Hover affordances return** | Row actions, table sorting, and quick views are hover-revealed — with focus parity (§28.3) and never hover-only critical content. |
| **Shortcut-rich** | Full keyboard support: `Ctrl/Cmd+K`, arrows, `/`, `g then letter` navigation habits. |
| **Density choice** | Comfortable/Compact global setting applies here (§48.3). |

### 48.3 Density system

| Mode | Table rows | Panel padding | Font |
|------|-----------|---------------|------|
| Comfortable (default) | 44px | 24px | 14px |
| Compact (opt-in) | 36px | 16px | 13.5–14px (never below §41.3, never below 13px) |

- Persisted per user; applies product-wide; never breaks focus rings or touch targets (§41.8).
- Compact is a *mode*, not a per-page escape hatch.

### 48.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Full 12-column instrument layouts, three-pane detail | Mobile bottom sheets or card-tables on desktop |
| Hover affordances with keyboard parity | Hover-only destructive actions |

---

## 49. Large Screen Rules (≥ 1536px)

### 49.1 Frame

| Element | Behavior |
|----------|----------|
| Header | 56px fixed (no stretch) |
| Sidebar | 240px expanded; rail available |
| Content | `container-wide` ≤ 1600px, centered; full-bleed only for data canvases (§7.4) |
| Footer | Status line; content max-width respected |

### 49.2 Rules

| Rule | Detail |
|------|--------|
| **Whitespace scales, elements don't** | Type, spacing, and components stay at token values; width is where large screens express themselves. Elements are never scaled 120% "because there's room." |
| **Centered max-width** | The canvas centers rather than stretching to the bezel; 4K walls do not mean 4,000px-wide tables. |
| **Command surfaces** | Network maps, fleet grids, and remote sessions may use full-bleed canvas deliberately — they are the exception, granted by pattern, not by default. |
| **Multi-window workflows** | Large screens support two logical regions (list + detail, dashboard + AI) without awkward centered islands. |
| **Data density ceiling** | More screen does not license more widgets; the ~9-panel dashboard cap (§38.5) still applies. |

### 49.3 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Centered `container-wide` content; deliberate full-bleed canvases | Stretched full-width tables and text across 4K |
| Extra whitespace as structure | Scaled-up type, buttons, and cards |

---

# PART G — PERFORMANCE & UX

---

## 50. Performance Rules

### 50.1 The philosophy

> **Speed is a trust signal (TG-1A §20). In a real-time intelligence product, latency is honesty: a slow dashboard feels like it is hiding something. Performance budgets are brand budgets.**

### 50.2 Budgets (design-relevant)

| Metric | Budget |
|--------|--------|
| First contentful paint | < 1.5s on a mid-range device, 4G |
| Largest contentful paint | < 2.5s |
| Time to interactive | < 3.5s |
| Route transition (client) | < 100ms render, ≤ 400ms with motion (§43.1) |
| Interaction feedback | < 100ms perceived (optimistic UI, §52.4) |
| Input-to-value update | < 50ms (typed keystroke latency) |
| Animation frame | 60fps; never jank during 80–400ms transitions |
| Bundle (per route) | ≤ 180KB gzipped JS; charts/AI/3D split on demand |

### 50.3 Rendering rules

| Rule | Detail |
|------|--------|
| **Compositor-friendly motion only** | Animate `opacity` and `transform`; never `top/left/width/height/margin` (§43.4). |
| **`will-change` is a promise** | Applied only during animation, removed after; never sprayed across idle elements. |
| **No bulk backdrop-blur** | `backdrop-filter` only on the one open overlay (§12.3), never on dozens of cards. |
| **Shadows are token-sized** | The shadow scale (§11) is capped; multi-layer shadows on every card kill paint. |
| **Images are optimized** | Next.js image pipeline, intrinsic dimensions, `loading="lazy"` below the fold, no layout shift (§15.3). |
| **Fonts are self-hosted** | Subset + preload + `font-display: swap` (§6.2); no icon fonts (§13.3). |
| **Lists virtualize** | Device inventories and logs render windows, not 10,000 DOM rows. |
| **Charts throttle** | Live charts batch/decimate points (≤ 1 render/sec), pause offscreen, and never animate 60fps point clouds (§37). |

### 50.4 When an effect should NOT be used

| Effect | When forbidden |
|--------|----------------|
| Backdrop blur | More than one surface at a time; low-end devices; reduced-motion users |
| Heavy shadows | In lists and tables; on more than the hovered element |
| Skeleton shimmer | Over 150ms fetch; on reduced-motion; in compact density (static blocks) |
| Chart draw-in animation | Data sets > 500 points; live streaming (animate the update, not the whole chart); reduced-motion |
| Springy motion | Anywhere — forbidden by rule (§43.2) |
| Animated backgrounds / particles / parallax | Everywhere — forbidden by brand (§1.4) |
| CSS `all` transitions | Everywhere — unpredictable and janky |
| Blur/glow on text | Everywhere — hurts legibility and paint |

### 50.5 Perceived performance

| Technique | Rule |
|-----------|------|
| Optimistic UI | Apply reversible actions instantly, roll back honestly on failure (§52.4) |
| Instant placeholders | Skeletons at ≤ 150ms so the surface never flashes blank (§36.3) |
| Instant route shells | Header/sidebar render first; content streams in (§36) |
| Priority above the fold | The five-second signal (§38.2) loads before secondary panels |
| Honest long waits | Phase labels for queued jobs (§35.2); never fake progress (§35.4) |

### 50.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Compositor animations, virtualized lists, throttled charts | Animating layout properties; 60fps particle effects; heavy filters |
| Honest phase labels during long jobs | Fake progress bars; spinners that resolve to failure silently |

---

## 51. UX Principles

### 51.1 The philosophy

> **The interface should make the professional's state of the world obvious, act only on real data, and get out of the way the moment the work is understood (TG-1A §12).**

### 51.2 The principles in practice

| Principle | Meaning in the design system |
|-----------|------------------------------|
| **State over interface** | Status, health, and risk are always visible before any chrome (§38.2). |
| **Five-second comprehension** | Every screen's primary signal reads in five seconds (§2). |
| **Real data or nothing** | Placeholders, fabricated numbers, and fake progress are violations (§35.4). |
| **Calm failure** | Error states explain and guide without panic styling (§33). |
| **Progressive depth** | Novices see clarity; experts reach depth without obstacles (drill-downs, technical details, density). |
| **One coherent surface** | Shared patterns and vocabulary everywhere (§16, §21.2). |
| **Respect attention** | Fewer, better defaults; empty states that teach; no celebration noise (§34). |

### 51.3 The UX process rules

| Rule | Detail |
|------|--------|
| **Flows are tested, not assumed** | Every new flow passes the "five-second + two-click" test (primary signal in 5s, any claim verified in 2 clicks). |
| **Copy is UI** | All UI copy follows TG-1A §14–§15: plain, specific, calm. Copy is written by the flow owner, reviewed with the message hierarchy. |
| **Defaults are decisions** | Default selections, ranges, and timeframes are deliberate and documented — never arbitrary. |
| **Off-boarding mirrors on-boarding** | Export, deletion, and tenant-transfer flows carry the same craft as setup. |
| **Boring substrate, brilliant surface** | Keep core mechanics familiar; innovate on outcomes (TG-1A §18). |

### 51.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| State-first, honest, progressive-depth UX | Urgency theater; attention hijacking; feature advertising in flows |
| Five-second + two-click validation on every screen | Shipping flows that only "make sense in a demo" |

---

## 52. Interaction Principles

### 52.1 The philosophy

> **Every interaction has three beats: anticipate, respond, and confirm. The system never surprises the professional, always acknowledges within 100ms, and always closes the loop honestly.**

### 52.2 The interaction loop

| Beat | Rule | Example |
|------|------|---------|
| **Anticipate** | Controls state what they will do; destructive affordances are visually distinct (§17, §31). | A "Revoke" button never looks like "Save". |
| **Respond** | Every input acknowledges within 100ms (visual or optimistic) (§50.2). | Toggle flips instantly, sync happens quietly. |
| **Confirm** | Outcomes are confirmed calmly and honestly; errors are never silent (§30, §33). | "Saved." / "We couldn't reach the agent." |

### 52.3 Rules

| Rule | Detail |
|------|--------|
| **Direct manipulation** | Act on the object, not a menu about the object: inline edits, drag-to-reorder, in-row toggles. |
| **One gesture, one effect** | A single action never silently does two things (no "delete + unsubscribe" surprises). |
| **No trap interactions** | Every interaction is reversible or confirmed; no modal without an escape (§26, §31). |
| **State changes announce themselves** | Where the UI changes without a click (live data), the change is visible and labeled (§44.4). |
| **Idempotent retries** | Retry affordances are safe to press repeatedly (§33.4). |
| **Predictable shortcuts** | The same shortcut does the same thing everywhere; `?` documents them. |

### 52.4 Optimistic UI policy

| Rule | Detail |
|------|--------|
| Allowed | Reversible, low-risk actions (toggle, mark-read, reorder) |
| Allowed with visible in-flight | Actions whose failure is common (save, rename) — apply, mark "Saving…", roll back with a toast on error |
| Never optimistic | Irreversible or consequential actions (delete, disconnect, billing, restore) — wait for server confirmation before showing success |

### 52.5 Undo policy

| Rule | Detail |
|------|--------|
| Every reversible action offers Undo in the confirmation toast (§30.4) |
| Undo window: 5s for critical data, 8s for bulk actions |
| After undo, the surface restores the exact prior state — no refresh surprises |
| Irreversible actions use the confirm dialog (§31) instead of relying on undo |

### 52.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| 100ms response + calm confirm on every interaction | Interactions that close silently (no feedback, no rollback) |
| Optimistic only for reversible actions | Optimistic success on delete/disconnect/billing |

---

## 53. Micro Interaction Rules

### 53.1 Definition

Micro interactions are the sub-second responses to a single gesture — press, hover, toggle, drag, select. They are where craft is felt and where jank is unforgivable.

### 53.2 The micro-interaction library

| Interaction | Standard |
|-------------|----------|
| Button press | 80ms bg/border darken; no scale, no shadow animation (§17.4) |
| Hover | 150ms color/bg ease; one shadow step max on interactive cards (§11.3) |
| Checkbox / toggle | 150ms fill + 4px thumb travel on a linear-eased track (§25.6) |
| Menu open/close | §44.2 table (150ms, 8px, direction from trigger) |
| Row selection | 150ms row tint + 2px left indicator slide-in |
| Drag reorder | 200ms transform-follow + 150ms settle; drop zones highlight with a 1.5px signal outline |
| Copy to clipboard | 80ms icon swap copy→check + 13px "Copied" meta; no confetti |
| Live value update | 200ms number ease + ≤ 1.5s one-time tint (§44.4) |
| Scroll-to-anchor / expand | 200–300ms measured transform, never layout-lurch |

### 53.3 Rules

| Rule | Detail |
|------|--------|
| **Under 300ms, always** | Micro interactions live at 80–300ms (§43.1). |
| **One property, one job** | A micro interaction animates the thing it affects (the thumb on a toggle, the row on selection) — not the whole card. |
| **No gratuitous delight** | Every micro interaction responds to a real state; hover-wiggle, idle-pulse, and easter-eggs are forbidden. |
| **Feedback location** | Feedback appears at the point of interaction (the button, the row, the field) — not in a distant toast for a local action. |
| **Reduced motion** | Micro interactions collapse to instant or ≤ 80ms opacity changes (§41.7). |
| **Performance floor** | Each micro interaction runs on the compositor and hits 60fps on a mid-range device (§50.3). |

### 53.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| State-responding micro interactions at the interaction point | Celebration, bounce, idle animation, hover scale on non-interactive content |
| ≤ 80ms press feedback everywhere | Micro interactions that move layout (sibling reflow on press) |

---

# PART H — SYSTEM GOVERNANCE

---

## 54. Design Tokens Philosophy

### 54.1 The philosophy

> **Tokens are the source of truth in machine-readable form — the design system compiled. Designers and engineers share one vocabulary, one source, and one process for change. No token = no exception.**

### 54.2 The token architecture

| Layer | Purpose | Example |
|-------|---------|---------|
| **Primitive** | The raw, unopinionated values | `graphite-500`, `signal-600`, `space-4`, `motion-200` |
| **Semantic** | Named roles the UI consumes | `surface-panel`, `text-primary`, `border-default`, `action-primary`, `status-critical` |
| **Component** | Per-component mappings | `button-primary-bg`, `table-row-hover` |
| **Theme** | The dark/light projection of semantic tokens | `surface-canvas: dark→graphite-950, light→graphite-50` |

### 54.3 Rules

| Rule | Detail |
|------|--------|
| **UI consumes semantic tokens only** | Teams never bind to primitives directly; themes and rebranding become mapping exercises. |
| **One token, one value** | A given semantic role has one value per theme — no per-screen drift. |
| **Named by role, not appearance** | `status-critical`, not `red`; `elev-2`, not `big-shadow`. |
| **Motion and radius are tokens too** | Durations, curves, distances, and radii ship as tokens (§10, §43), never ad-hoc numbers. |
| **Governance gate** | New tokens require design-system review; changing a token's value requires a versioned release + visual regression run. |
| **Documented provenance** | Every token records its rationale (WHAT / WHY) — the design decision travels with the value. |
| **Generated, not hand-typed** | Tokens are generated from a single source into themes for light/dark and any future brand surface. |

### 54.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Semantic tokens in all UI code | Raw hex/Tailwind values in screens |
| New tokens via the governance gate | Inline "one-off" styles to avoid the process |

---

## 55. Future Expansion Rules

### 55.1 The philosophy

> **The system is designed to accept growth without changing character — new modules, new devices, new AI capabilities, new tenants, and ultimately third-party integrations all land inside the same calm instrument.**

### 55.2 Expansion rules

| Rule | Detail |
|------|--------|
| **Add capability, not vocabulary** | New features reuse the existing component, token, and naming systems (§56). A "new kind of card" is a signal the system is missing a primitive. |
| **New modules enter the canonical sidebar** | Modules are added to the fixed order (§22.3), never appended chaotically; counts and badges follow §22.3 rules. |
| **New AI capabilities stay in the AI vocabulary** | Optic identity, grounding chips, confidence, and human-confirm apply to every future AI surface (§40). |
| **Third-party integration surfaces** | Partner content renders inside approved components (cards, tables, chips) with the same tokens — never a foreign "partner skin". |
| **Enterprise growth is invisible** | SSO, audit, retention, and compliance add *surfaces*, not a heavier visual character (§49 remains true at 100,000 devices). |
| **White-labeling is token-mapped** | MSP white-labeling re-maps brand tokens (logo, name, accent) — the instrument structure is unchanged. |
| **Versioned evolution** | The system version-bumps when tokens change; consumers upgrade deliberately with the visual regression suite (§54.3). |

### 55.3 The expansion test

Before a new feature, surface, or component is approved, it must pass:

1. **Character test** — does it look like the same product at the same scale? (§3.3)
2. **Vocabulary test** — does it use existing tokens, names, and patterns? (§54, §56)
3. **Five-second test** — is its primary signal readable in five seconds? (§38.2)
4. **Trust test** — would a customer's executive trust its failure mode? (TG-1A §17)
5. **Reduced-motion + contrast test** — does it hold without motion and pass AA? (§41)

### 55.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Extension via tokens, components, and patterns | New visual subsystems per module |
| Canonical sidebar addition for new modules | Per-partner custom styling in an ecosystem |

---

## 56. Component Naming Convention

### 56.1 The philosophy

> **Names are vocabulary: consistent, descriptive, and shared by design, engineering, docs, and AI. A component's name is its contract.**

### 56.2 Naming rules

| Rule | Detail |
|------|--------|
| **Component names** | PascalCase nouns: `DeviceTable`, `HealthBadge`, `AISourceChip`, `StatCard`. |
| **File names** | kebab-case matching the component: `device-table.tsx`. |
| **Variants** | Semantic, `variant="primary | secondary | ghost | destructive | ai"` (§17.3). Never color-named variants. |
| **Sizes** | `size="sm | md | lg"` — never numeric or English ("smallish"). |
| **States** | `isLoading`, `isDisabled`, `hasError`, `isEmpty` — state as property, not as style. |
| **Slots** | `leftSlot` / `rightSlot` / `footer` — positional but readable. |
| **Semantic HTML** | Button uses `<button>`, cards `<article>/<section>`, nav `<nav>`, tables real `<table>` (§41). |

### 56.3 Vocabulary consistency

| Rule | Detail |
|------|--------|
| One term per concept product-wide (UI = docs = AI = support), per TG-1A §16 |
| Module names are stable nouns: Devices, Alerts, Reports, Network, Security, Backup, AI |
| Status words are fixed: Healthy / Warning / Critical / Offline — never synonyms in one screen |
| AI terms are fixed: Assist, Sources, Confidence, "I couldn't verify this" |
| New terms are reviewed by Design Systems before shipping; terminology changes are versioned like tokens |

### 56.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| PascalCase components + kebab files + semantic variants | Abbreviations (`Btn`), color variants (`variant="red"`), per-team naming |
| Fixed vocabulary across UI/docs/AI | "Device" here, "Workstation" there, "Endpoint" elsewhere |

---

## 57. Design Checklist

### The gate every screen and component must pass before it ships

| # | Check | Pass / Fail |
|---|-------|-------------|
| **Signal** | | |
| 1 | Is the primary signal readable within five seconds? (§38.2) | ☐ |
| 2 | Is there exactly one primary action per surface? (§8.3) | ☐ |
| 3 | Does every data element have honest empty, loading, error, and stale states? (§32–§36) | ☐ |
| 4 | Are all numbers real, unit-labeled, and precision-honest? (§39.3) | ☐ |
| **Structure** | | |
| 5 | Does layout use the 8pt grid and token spacing only? (§7, §9) | ☐ |
| 6 | Are radii, shadows, and elevation from the token scales? (§10–§12) | ☐ |
| 7 | Does it use shared components — no page-local forks? (§16.4) | ☐ |
| 8 | Is naming consistent with the vocabulary? (§56) | ☐ |
| **Color** | | |
| 9 | Is color semantic, desaturated, and never decorative? (§4, §5) | ☐ |
| 10 | Is status redundant (icon + label + color), never color-alone? (§41.4) | ☐ |
| 11 | Is Critical styling reserved for genuinely critical conditions? (§5.6) | ☐ |
| **Type & content** | | |
| 12 | Does typography follow the scale with tabular numerals for data? (§6) | ☐ |
| 13 | Is copy plain, specific, calm, and verification-honest? (§51.3, TG-1A §14) | ☐ |
| **Accessibility** | | |
| 14 | Do all text/UI pass WCAG AA contrast in both themes? (§41.3) | ☐ |
| 15 | Is the full flow keyboard-complete with visible focus rings? (§41.5) | ☐ |
| 16 | Do screen readers receive truthful labels and live regions? (§41.6) | ☐ |
| 17 | Does it honor reduced motion (no information lost)? (§41.7) | ☐ |
| **Motion** | | |
| 18 | Is motion within 80–300ms with approved easing and properties? (§43) | ☐ |
| 19 | Does every animation explain a state change — none decorative? (§42.2) | ☐ |
| 20 | Does it avoid all forbidden effects (§50.4) and forbidden aesthetics (§1.4)? | ☐ |
| **Interaction** | | |
| 21 | Does every interaction respond within 100ms and confirm honestly? (§52) | ☐ |
| 22 | Are irreversible actions confirmed with a consequence dialog? (§31) | ☐ |
| 23 | Is undo offered for every reversible action? (§52.5) | ☐ |
| **Responsive** | | |
| 24 | Is it tested at every breakpoint with mobile priority order? (§45–§49) | ☐ |
| 25 | Are touch targets ≥ 44px on mobile and no hover-only content? (§46) | ☐ |
| **AI (where AI is present)** | | |
| 26 | Does every AI claim carry source chips and a confidence line? (§40.4) | ☐ |
| 27 | Do consequential AI actions require human confirmation? (§40.4) | ☐ |
| 28 | Is uncertainty explicit and is the provider disclosed? (§40.4, §40.7) | ☐ |

---

## 58. Approval Checklist

### The governance gate for the design system itself

Any change to tokens, components, or this document requires the approval flow below. Individual screens use the Design Checklist (§57); changes *to the system* use this one.

| # | Check | Pass / Fail |
|---|-------|-------------|
| 1 | Does the change serve at least one Design Principle (§2) and no prohibited behavior (§1.4, §3.4)? | ☐ |
| 2 | Is it consistent with TG-1A (brand) — no contradiction with identity, voice, or values? | ☐ |
| 3 | Are all values expressed as tokens (no hard-coded design values)? (§54) | ☐ |
| 4 | Does it hold in both light and dark themes? (§5.7–§5.8) | ☐ |
| 5 | Does it pass WCAG AA including reduced motion? (§41) | ☐ |
| 6 | Does it survive the expansion test (§55.3) — including white-labeling and enterprise scale? | ☐ |
| 7 | Is the change backward-compatible, or is it a versioned break with a migration path? (§54.3) | ☐ |
| 8 | Does it reuse existing components rather than introducing a parallel system? (§16, §55.2) | ☐ |
| 9 | Is naming consistent with the component and vocabulary conventions? (§56) | ☐ |
| 10 | Are performance budgets respected (motion properties, effects, bundle impact)? (§50) | ☐ |
| 11 | Is the rationale documented (WHAT / WHY / WHEN / WHEN NOT)? | ☐ |
| 12 | Have visual regression + accessibility tests been run and recorded? | ☐ |

### Approval sign-off

| Role | Decision | Signature | Date |
|------|----------|-----------|------|
| Design Systems | ☐ Approve ☐ Amend | | |
| Product Design | ☐ Approve ☐ Amend | | |
| Frontend Engineering | ☐ Approve ☐ Amend | | |
| Accessibility Lead | ☐ Approve ☐ Amend | | |
| Executive Sponsor | ☐ Approve ☐ Amend | | |

### Amendments

This document is the permanent foundation of the TechFusion Design Language. Amendments are permitted only through a formal, signed revision that changes this version number and records the reason, scope of impact, and affected sections. Screens and components may not silently deviate while waiting for an amendment — they must conform to the current version.

| Version | Date | Reason | Sections affected |
|---------|------|--------|-------------------|
| 1.0 | 2026-07-31 | Initial design system foundation | All |

---

## Appendices

### A. One-sentence reference

- **Philosophy:** Signal is the design — calm, matte, layered surfaces with luminous, exact, verifiable data.
- **Principles:** Five-second comprehension; signal over chrome; layered, not floating; calibrated status; grounded by default; motion explains.
- **Identity:** Precise. Calm. Unified. Restrained. Honest. Professional.
- **Surface:** Graphite (cool, blue-tinted neutrals); layered `elev-0…4`; border-first depth; dark console default, light fully supported.
- **Action:** Signal Blue — one primary action per surface.
- **Intelligence:** Optic Cyan — AI only, always with sources + confidence + human-confirm.
- **Status:** Go / Caution / Critical — desaturated, sparing, icon + label + color, never decorative.
- **Type:** IBM Plex Sans (UI) + IBM Plex Mono (values only); tabular numerals for all data.
- **Motion:** 80–300ms, damped, directional, information-only; 400ms absolute maximum; reduced-motion first-class.
- **Trust floor:** Any claim is verifiable within two clicks; any failure is stated calmly and honestly.

### B. The six signatures (designer's checklist)

1. Instrument Surface — matte, layered, edge-first depth (§3.2).
2. Luminous Data — tabular numerals, light-on-dark readouts (§6.2).
3. Signal Color Code — one desaturated semantic language (§5.6).
4. Grounded AI Motif — sources, confidence, confirmation (§40).
5. Calibrated Motion — fast, damped, purposeful (§42).
6. The Verifiable Interface — every claim tappable to its evidence (§3.2).

### C. Related documents

| Document | Relationship |
|----------|--------------|
| TG-1A — Brand Identity Foundation | Parent document; this system derives from and may not contradict it |
| TG-1B — Visual Identity Extension | Logo and mark; the design system consumes, never invents |
| 01-Master-Specification.md | Functional scope; design patterns map to its modules |
| Component library (`@techfusion/ui`) | The compiled implementation of this document |

---

*End of document. The TechFusion Design Language is the instrument the professional looks through — calm, precise, honest, and always out of the way of the work.*

*End of TG-2A.*
