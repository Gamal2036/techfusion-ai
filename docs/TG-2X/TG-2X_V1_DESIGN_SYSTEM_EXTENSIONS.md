# TechFusion-AI — Design System Extensions

> **Document ID:** TG-2X
> **Phase:** Documentation
> **Priority:** CRITICAL
> **Status:** Final Design Documentation — Ready for Approval
> **Owner:** Design Systems
> **Version:** 1.0

---

## Table of Contents

1. Preamble — Why This Document Exists
2. Coverage Map (TG-2A ↔ TG-2X)

**Part 1 — Design Tokens**
1.1 Token Registry Model
1.2 Color Tokens
1.3 Typography Tokens
1.4 Spacing Tokens
1.5 Radius Tokens
1.6 Border Tokens
1.7 Shadow Tokens
1.8 Elevation Tokens
1.9 Opacity Tokens
1.10 Motion Tokens
1.11 Z-index Tokens
1.12 Size Tokens
1.13 Naming Convention
1.14 Token Governance
1.15 Future Token Expansion

**Part 2 — Enterprise Component Library**
2.1 Textarea — 2.30 Charts (see §2.0 index)

**Part 3 — Motion System**
3.1 Animation Philosophy
3.2 Timing Scale
3.3 Duration Scale
3.4 Easing Curves
3.5 Hover Motion
3.6 Focus Motion
3.7 Loading Motion
3.8 Page Transition
3.9 Modal Transition
3.10 Drawer Transition
3.11 Toast Motion
3.12 AI Motion
3.13 Dashboard Motion
3.14 Skeleton Motion
3.15 Reduced Motion Rules
3.16 Performance Guidelines

**Part 4 — Enterprise UX Patterns**
4.1 Authentication
4.2 Dashboard
4.3 Settings
4.4 Wizard
4.5 Search
4.6 Tables
4.7 Filters
4.8 Forms
4.9 Reports
4.10 Analytics
4.11 Notifications
4.12 Monitoring
4.13 AI Chat
4.14 Knowledge Base
4.15 Document Viewer
4.16 Cybersecurity Modules
4.17 Error Handling
4.18 Success Flow
4.19 Loading Flow
4.20 Empty States
4.21 Offline States

**Part 5 — Design Governance**
5.1 Component Lifecycle
5.2 Versioning
5.3 Deprecation
5.4 Breaking Changes
5.5 Approval Process
5.6 Documentation Standards
5.7 Contribution Rules
5.8 Review Workflow

**Part 6 — Quality Assurance**
6.1 Design Review Checklist
6.2 Accessibility Checklist
6.3 Performance Checklist
6.4 Responsive Checklist
6.5 Motion Checklist
6.6 Visual Consistency Checklist
6.7 Developer Handoff Checklist

Appendices
A. Coverage Matrix (final)
B. One-sentence Reference
C. Approval Sign-off

---

## Preamble — Why This Document Exists

This document is the **final extension of the TechFusion Design Language**. It completes **TG-2A (Design System Foundation)** by specifying every standard that TG-2A deliberately left for extension: the full token registry, the enterprise component library, the motion system, enterprise UX patterns, design governance, and quality assurance.

It is derived from **TG-1A (Brand Identity Foundation)** and **TG-2A (Design System Foundation)**, and **may not contradict either**.

### The document hierarchy

| Document | Role | Governs |
|----------|------|---------|
| TG-1A — Brand Identity Foundation | Who we are | Identity, voice, values, forbidden aesthetics |
| TG-2A — Design System Foundation | How we look and behave | All topics it already specifies (tokens, components, motion, responsive, a11y) |
| **TG-2X — Design System Extensions** | **The remaining standards** | **Every topic first specified here** |

**Resolution rule:** Where TG-2A is explicit on a topic, TG-2A governs. Where TG-2A is silent, TG-2X governs. Where TG-2X extends a TG-2A topic, TG-2X specifies only the *extension* and inherits the foundation. Where this document conflicts with either parent, the parent wins and this document must be amended.

**After this document is approved, no additional design documentation is required before UI implementation.** This document and TG-2A together are the complete, binding specification of the TechFusion Design Language.

### Scope of validity

Holds across every maturity stage defined in TG-1A (Small SaaS → Professional Platform → Enterprise Platform → AI Ecosystem). Scaling changes *capability*, never *character*.

### Reference standard

| Attribute | Standard |
|-----------|----------|
| Document | TG-2X — Design System Extensions |
| Completes | TG-2A — Design System Foundation |
| Derived from | TG-1A, TG-2A |
| Design language | TechFusion Design Language |
| Accessible baseline | WCAG 2.2 AA (minimum), AAA targets where practical |
| Governance | Any deviation requires a signed amendment to this document (TG-2A §58) |

### WHAT / WHY / WHEN / WHEN NOT — the writing contract

Every standard in this document states **WHAT** it is, **WHY** it exists, **WHEN** to use it, and **WHEN NOT** to use it. A standard that cannot answer all four questions is not ready to ship.

---

## Coverage Map (TG-2A ↔ TG-2X)

This map is the single answer to "where is X specified?" No standard is defined twice.

### Component coverage

| # | Component | Specified in | Status in TG-2X |
|---|-----------|--------------|-----------------|
| 1 | Button | TG-2A §17 | Reference only — no extension |
| 2 | Input | TG-2A §18 | Reference only — no extension |
| 3 | Textarea | **TG-2X §2.1** | Full spec |
| 4 | Checkbox | **TG-2X §2.2** | Full spec |
| 5 | Radio | **TG-2X §2.3** | Full spec |
| 6 | Switch | **TG-2X §2.4** | Full spec |
| 7 | Select | **TG-2X §2.5** | Full spec |
| 8 | Combobox | **TG-2X §2.6** | Full spec |
| 9 | Search | **TG-2X §2.7** | Full spec |
| 10 | Date Picker | **TG-2X §2.8** | Full spec |
| 11 | Avatar | **TG-2X §2.9** | Full spec |
| 12 | Badge | **TG-2X §2.10** | Full spec |
| 13 | Chip | **TG-2X §2.11** | Full spec |
| 14 | Tag | **TG-2X §2.12** | Full spec |
| 15 | Card | TG-2A §19 | Reference only — no extension |
| 16 | Panel | **TG-2X §2.13** | Full spec |
| 17 | Accordion | **TG-2X §2.14** | Full spec |
| 18 | Tabs | **TG-2X §2.15** | Full spec |
| 19 | Breadcrumb | **TG-2X §2.16** | Full spec (extends TG-2A §21.4) |
| 20 | Navbar | TG-2A §21, §23 | Reference only — no extension |
| 21 | Sidebar | TG-2A §22 | Reference only — no extension |
| 22 | Table | TG-2A §20 | Reference only — no extension |
| 23 | Pagination | **TG-2X §2.17** | Full spec (extends TG-2A §20.5) |
| 24 | Modal | TG-2A §26 | Reference only — no extension |
| 25 | Dialog | TG-2A §31 | Reference only — no extension |
| 26 | Drawer | **TG-2X §2.18** | Full spec |
| 27 | Tooltip | TG-2A §28 | Reference only — no extension |
| 28 | Popover | **TG-2X §2.19** | Full spec |
| 29 | Dropdown | TG-2A §27 | Reference only — no extension |
| 30 | Toast | TG-2A §30 | Reference only — no extension |
| 31 | Notification | TG-2A §29 | Reference only — no extension |
| 32 | Progress | **TG-2X §2.20** | Full spec |
| 33 | Stepper | **TG-2X §2.21** | Full spec |
| 34 | Timeline | **TG-2X §2.22** | Full spec |
| 35 | Tree View | **TG-2X §2.23** | Full spec |
| 36 | File Upload | **TG-2X §2.24** | Full spec |
| 37 | AI Response | **TG-2X §2.25** | Full spec (extends TG-2A §40) |
| 38 | AI Citation | **TG-2X §2.26** | Full spec (extends TG-2A §40) |
| 39 | AI Confidence | **TG-2X §2.27** | Full spec (extends TG-2A §40) |
| 40 | AI Sources | **TG-2X §2.28** | Full spec (extends TG-2A §40) |
| 41 | Dashboard Widgets | **TG-2X §2.29** | Full spec (extends TG-2A §38) |
| 42 | Charts | **TG-2X §2.30** | Extension only (extends TG-2A §37) |

### Pattern and system coverage

| Topic | Specified in | Status in TG-2X |
|-------|--------------|-----------------|
| Design tokens (color/type/space/radius/shadow/elevation/motion) | TG-2A §5–§12, §43 | Consolidated registry + new families (§1.1–§1.15) |
| Border, opacity, z-index, size tokens | **TG-2X §1.6, §1.9, §1.11, §1.12** | New |
| Motion philosophy, duration, easing, transitions | TG-2A §42–§44 | Extended choreography (§3.1–§3.16) |
| UX patterns: auth, settings, wizard, search, filters, reports, AI chat, offline | **TG-2X §4.1–§4.21** | New |
| UX patterns already founded in TG-2A | TG-2A §32–§40 | Pattern-level extension (§4.2, §4.6, §4.8, §4.11, §4.17–§4.20) |
| Design governance | TG-2A §54, §56, §58 | Full lifecycle and process (§5.1–§5.8) |
| Quality assurance | TG-2A §57 | Specialized checklists (§6.1–§6.7) |

---

# PART 1 — DESIGN TOKENS

---

## 1.1 Token Registry Model

### 1.1.1 The philosophy

> **Tokens are the design system compiled. TG-2A established the philosophy (§54); this part delivers the complete registry — the definitive inventory of every token family, the formal naming grammar, and the process that keeps the registry truthful.**

### 1.1.2 The registry structure

The registry has one file per family, one canonical source, and four layers (per TG-2A §54.2):

| Layer | Purpose | Example |
|-------|---------|---------|
| **Primitive** | Raw unopinionated values | `graphite-500`, `space-4`, `border-1`, `opacity-12`, `z-modal` |
| **Semantic** | Named roles the UI consumes | `surface-panel`, `text-primary`, `border-default`, `opacity-scrim` |
| **Component** | Per-component mappings | `button-primary-bg`, `table-row-hover`, `chip-filter-fill` |
| **Theme** | The dark/light projection | `surface-canvas: dark→graphite-950, light→graphite-50` |

### 1.1.3 Registry rules

| Rule | Detail |
|------|--------|
| **One source, generated output** | Tokens are authored once (single JSON/TS source) and generated into all themes and platforms. Hand-typed token files are a violation. |
| **UI consumes semantic tokens only** | Teams bind to semantic roles; primitives are touched only when minting new semantics (TG-2A §54.3). |
| **Every token has provenance** | Each token records WHAT / WHY / WHEN — the design decision travels with the value (§1.14). |
| **No orphan values** | A value used in UI that is not in the registry is a defect, not a token. |
| **Versioned** | The registry version-bumps with the design system; consumers pin (§5.2). |

### 1.1.4 The registry inventory

The complete token families, where each is defined, and what TG-2X adds:

| Family | Canonical definition | TG-2X status |
|--------|----------------------|--------------|
| Color | TG-2A §5 | Consolidated inventory (§1.2) |
| Typography | TG-2A §6 | Consolidated inventory (§1.3) |
| Spacing | TG-2A §9 | Consolidated inventory (§1.4) |
| Radius | TG-2A §10 | Consolidated inventory (§1.5) |
| Border | — | **New** (§1.6) |
| Shadow | TG-2A §11 | Consolidated inventory (§1.7) |
| Elevation | TG-2A §12 | Consolidated inventory (§1.8) |
| Opacity | — | **New** (§1.9) |
| Motion | TG-2A §43 | Consolidated inventory (§1.10) |
| Z-index | — | **New** (§1.11) |
| Size | — | **New** (§1.12) |

---

## 1.2 Color Tokens

### 1.2.1 What

The complete color registry. Primitive palettes and semantic roles are defined in TG-2A §5; this section is the **consolidated inventory** a team uses as its single look-up table.

### 1.2.2 Primitive palettes (defined in TG-2A §5.2–§5.5)

| Family | Steps | Referenced |
|--------|-------|------------|
| Graphite (neutral) | 50, 100, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950 | TG-2A §5.2 |
| Signal (action) | 50–950 | TG-2A §5.3 |
| Optic (AI) | 50, 100, 300–700 | TG-2A §5.4 |
| Status (Go/Caution/Critical/Info) | 400–600 + 50/100 tints | TG-2A §5.5 |

### 1.2.3 Semantic role catalog (consolidated)

| Role | Dark mapping | Light mapping | Job |
|------|--------------|---------------|-----|
| `surface-canvas` | `graphite-950` | `graphite-50` | App background |
| `surface-panel` | `graphite-900` | `white` | Panels, sidebar, header |
| `surface-raised` | `graphite-850` | `white` | Cards, raised content |
| `surface-inset` | `graphite-800` | `graphite-100` | Inputs, insets, hover fills |
| `border-default` | `graphite-600` | `graphite-200` | Default hairlines |
| `border-strong` | `graphite-700` | `graphite-300` | Elevated edges, focus borders |
| `text-primary` | `graphite-100` | `graphite-900` | Primary text |
| `text-secondary` | `graphite-300` | `graphite-600` | Secondary text |
| `text-muted` | `graphite-400` | `graphite-500` | Metadata (large text only on dark) |
| `text-inverse` | `white` | `white` | Text on colored fills |
| `action-primary` | `signal-500` | `signal-600` | Primary action identity |
| `action-hover` | `signal-400` | `signal-500` | Primary hover |
| `action-pressed` | `signal-700` | `signal-800` | Primary pressed |
| `intelligence-accent` | `optic-500` | `optic-600` | AI identity |
| `status-go` | `go-500` | `go-600` | Healthy |
| `status-caution` | `caution-500` | `caution-600` | Warning |
| `status-critical` | `critical-500` | `critical-600` | Critical |

### 1.2.4 When NOT to use color tokens

Color tokens are never used for decoration (TG-2A §4.6), never status-colored for neutral conditions (§5.6), and never swapped between AI and action roles (`optic` is AI-only, `signal` is action-only, per TG-2A §5.4).

---

## 1.3 Typography Tokens

### 1.3.1 What

The complete type registry: typeface roles, scale, weights, line-heights, letter-spacing, and numeric-variant rules. Defined in TG-2A §6; consolidated here.

### 1.3.2 Scale inventory (TG-2A §6.3)

| Token | Size / line-height | Weight |
|-------|--------------------|--------|
| `text-display` | 44px / 1.1 | 600 |
| `text-h1` | 32px / 1.2 | 600 |
| `text-h2` | 24px / 1.3 | 600 |
| `text-h3` | 20px / 1.35 | 600 |
| `text-h4` | 16px / 1.4 | 600 |
| `text-body-lg` | 16px / 1.6 | 400 |
| `text-body` | 14px / 1.5 | 400 |
| `text-label` | 13px / 1.45 | 500 |
| `text-meta` | 13px / 1.4 | 400 |
| `text-caption` | 12px / 1.4 | 400 |
| `text-eyebrow` | 11px / 1.3 | 600, +0.08em caps |

### 1.3.3 Extension — formal letter-spacing and numeric tokens

| Token | Value | Use |
|-------|-------|-----|
| `tracking-tight` | `-0.02em` | Display, H1 |
| `tracking-snug` | `-0.01em` | H2, H3 |
| `tracking-normal` | `0em` | Body, labels |
| `tracking-wide` | `+0.08em` | Eyebrow, all-caps labels |
| `numeric-tabular` | `font-variant-numeric: tabular-nums lining-nums` | All live data (TG-2A §6.2) |
| `weight-regular` / `weight-medium` / `weight-semibold` | 400 / 500 / 600 | The only UI weights |

### 1.3.4 When NOT to use

Never below 13px body on mobile, never proportional numerals for live data, never Plex Mono for non-value text (TG-2A §6.7).

---

## 1.4 Spacing Tokens

### 1.4.1 What

The spacing scale, defined in TG-2A §9.2: `space-1` (4px) through `space-24` (96px), on the 4px base.

### 1.4.2 Consolidation note

| Rule | Reference |
|------|-----------|
| Scale-only values, no ad-hoc pixels | TG-2A §9.3 |
| 8pt layout default, 4pt dense-data exception | TG-2A §9.3 |
| Related-closer gap grammar (label→control ≤ 20px, control→control ≥ 16px, panel→panel ≥ 24px) | TG-2A §9.3 |

### 1.4.3 When NOT to use

Pixel values outside the scale; 4pt rhythm on page layout; borders instead of gaps to separate siblings (TG-2A §9.4).

---

## 1.5 Radius Tokens

### 1.5.1 What

The radius scale, defined in TG-2A §10.2: `radius-xs` (4px) through `radius-full` (999px).

### 1.5.2 Consolidation note

| Rule | Reference |
|------|-----------|
| Size-proportional radius; one radius per surface | TG-2A §10.3 |
| `radius-full` only for height ≤ 24px pills | TG-2A §10.3 |
| Interactive elements never below `radius-sm` | TG-2A §10.3 |

### 1.5.3 When NOT to use

Pill buttons, bubbly cards, arbitrary per-designer radii, mixed radii in one panel (TG-2A §10.4).

---

## 1.6 Border Tokens

### 1.6.1 The philosophy

> **Borders are the instrument's edges — the crisp 1px definition that makes layering read as engineered structure (TG-2A §3.3). Width carries hierarchy; color carries meaning; both are tokens.**

### 1.6.2 Border width scale

| Token | Value | Use |
|-------|-------|-----|
| `border-1` | 1px | Default: surfaces, panels, cards, table separators, input resting borders |
| `border-1-5` | 1.5px | Emphasis: AI variant borders, active/focused interactive edges, selected states |
| `border-2` | 2px | Focus rings (drawn as ring, offset per §41.5), strong selection indicators |

### 1.6.3 Border style

| Style | Allowed? | Where |
|-------|----------|-------|
| `solid` | Yes (default) | Everything |
| `dashed` | Conditional | Drag-and-drop dropzones (§2.24) and empty-state placeholder frames only — the sole sanctioned dashed use |

Never `dotted`, never gradients, never multi-color borders, never animated borders.

### 1.6.4 Semantic border colors

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `border-default` | `graphite-600` | `graphite-200` | Resting surfaces, inputs, separators |
| `border-strong` | `graphite-700` | `graphite-300` | Elevated edges, hover borders, dropdowns, modals |
| `border-focus` | `signal-300` | `signal-600` | Focus rings and borders (§41.5) |
| `border-critical` | `critical-500` | `critical-600` | Error fields, destructive edges |
| `border-caution` | `caution-500` | `caution-600` | Warning fields, degraded state edges |
| `border-go` | `go-500` | `go-600` | Success edges (sparingly; §5.6) |
| `border-ai` | `optic-500` | `optic-600` | AI surfaces, source chips, AI variant buttons |
| `border-inverse` | `graphite-800` | `white` | Light borders on colored fills (pressed/dark fills) |

### 1.6.5 Border rules

| Rule | Detail |
|------|--------|
| **Edges first, always** | Every elevated surface has a 1px border — depth is border + shadow, never shadow alone (TG-2A §11.3). |
| **One width per element** | A resting element uses `border-1`; focus upgrades to `border-focus` at `border-1-5`+ring — width does not change on hover. |
| **No border for decoration** | A border must mark an edge, a state, or a separation. Decorative borders on neutral content are forbidden. |
| **Inset fields, outset controls** | Inputs carry resting borders on an inset surface; buttons are edge-first filled/outlined surfaces (TG-2A §18.2). |
| **Table hairline discipline** | Table separators are `border-default` 1px hairlines, full-width, never zebra (TG-2A §20.2). |

### 1.6.6 When NOT to use

Multiple nested borders ("box-in-box"), borders as the sole carrier of error (needs icon + text, §41.4), colored borders on neutral cards, animated or gradient borders.

---

## 1.7 Shadow Tokens

### 1.7.1 What

The shadow scale, defined in TG-2A §11.2: `shadow-xs` through `shadow-xl`, per-theme values, two-layer (contact + ambient), neutral only.

### 1.7.2 Consolidation note

| Rule | Reference |
|------|-----------|
| Border-first elevation; shadow confirms | TG-2A §11.3 |
| `shadow-md` ceiling for interactive; `lg`/`xl` overlays only | TG-2A §11.3 |
| One-step hover lift, never two | TG-2A §11.3 |
| No colored or glowing shadows | TG-2A §11.3 |

### 1.7.3 When NOT to use

Colored shadows, shadow-only elevation, heavy shadows in lists/tables, scaling or spinning on hover (TG-2A §11.4, §50.4).

---

## 1.8 Elevation Tokens

### 1.8.1 What

The elevation ladder, defined in TG-2A §12.2: `elev-0` (base) through `elev-4` (stage). Elevation is a strict, read-the-state ladder.

### 1.8.2 Consolidation note

| Rule | Reference |
|------|-----------|
| No skipping levels; scrims at 60% dark / 40% light | TG-2A §12.3 |
| Backdrop blur is overlay-only (`elev-2`+) | TG-2A §12.3 |
| Focus never floats above the element's level | TG-2A §12.3 |

### 1.8.3 Elevation ↔ surface pairing (canonical)

| Elevation | Typical surface | Z-index band |
|-----------|-----------------|--------------|
| `elev-0` | Canvas | `z-0` |
| `elev-1` | Panels, cards, header, sidebar | `z-sticky` / `z-header` |
| `elev-2` | Dropdowns, popovers, tooltips, command palette | `z-overlay` |
| `elev-3` | Modals, dialogs, drawers | `z-modal` / `z-drawer` |
| `elev-4` | Stage (remote session, focused workflow) | `z-stage` |

The elevation ↔ z-index pairing is specified once here and enforced by the z-index tokens (§1.11).

---

## 1.9 Opacity Tokens

### 1.9.1 The philosophy

> **Opacity is a controlled dial, never a slider. Every translucent value in the product is a named semantic token — scrims, fills, disabled states, shimmer — so transparency can never drift into "make it look sleek."**

### 1.9.2 Primitive opacity steps

| Token | Value | Typical primitive use |
|-------|-------|------------------------|
| `opacity-0` | 0% | Hiding (always paired with `visibility`/`aria-hidden` semantics) |
| `opacity-8` | 8% | Hover tint overlays |
| `opacity-12` | 12% | Chart series fills, AI tint fills (TG-2A §37.4, §40.6) |
| `opacity-16` | 16% | Subtle overlay tint |
| `opacity-25` | 25% | Placeholder art, watermark frames |
| `opacity-40` | 40% | Light-theme scrim, shimmer sweep |
| `opacity-50` | 50% | Disabled text (TG-2A §18.3) |
| `opacity-60` | 60% | Dark-theme scrim (TG-2A §12.3) |
| `opacity-85` | 85% | Hover-visible overlays on imagery |
| `opacity-100` | 100% | Fully opaque |

### 1.9.3 Semantic opacity roles

| Token | Value | Use |
|-------|-------|-----|
| `opacity-scrim-modal` | 60% (dark) / 40% (light) | Modal, dialog, drawer scrims (TG-2A §12.3) |
| `opacity-scrim-stage` | 70% | Stage overlays (remote session) |
| `opacity-disabled-control` | 35% | Whole disabled controls (visual dim) |
| `opacity-disabled-text` | 50% | Disabled text on disabled fills |
| `opacity-fill-chart` | 12% | Single-series area fill (TG-2A §37.4) |
| `opacity-fill-tint` | 12% | Tinted fills (selected rows, AI surfaces) |
| `opacity-hover-overlay` | 8% | Hover tint overlays on interactive rows/cards |
| `opacity-shimmer-sweep` | 40% | Skeleton shimmer luminance (TG-2A §36.2) |
| `opacity-image-scrim` | 60% | Text-over-image protection scrim (TG-2A §15.3) |

### 1.9.4 Opacity rules

| Rule | Detail |
|------|--------|
| **Semantic tokens only** | UI references `opacity-scrim-modal`, never `0.6`. |
| **Never for text** | Text legibility comes from color tokens (AA contrast), not opacity. Disabled text is the single exception (`opacity-disabled-text`). |
| **Never for motion emphasis** | Fade-to-reveal is fine (§43.4); pulsing, flashing, or blinking is forbidden (§43.6). |
| **Contrast still applies** | Translucent surfaces must still pass WCAG AA for the text on them — opacity never excuses contrast. |

### 1.9.5 When NOT to use

Opacity to dim meaningful data, opacity on status colors (a desaturated state is a token decision, not a translucency hack), per-screen invented values.

---

## 1.10 Motion Tokens

### 1.10.1 What

The motion registry, defined across TG-2A §43: durations, easing curves, distances. Consolidated here as the single look-up table; the choreography lives in Part 3.

### 1.10.2 Duration tokens (TG-2A §43.1)

| Token | Value | Use |
|-------|-------|-----|
| `motion-80` | 80ms | Micro feedback: press, focus ring, color |
| `motion-150` | 150ms | Instant UI: hover, checkbox, toggle, icon swap |
| `motion-200` | 200ms | Standard: menus, tooltips, value updates |
| `motion-300` | 300ms | Panels: modals, dialogs, drawers, expanded sections |
| `motion-400` | 400ms | Maximum: page transitions, full-screen changes |

### 1.10.3 Easing tokens (TG-2A §43.2)

| Token | Curve | Use |
|-------|-------|-----|
| `ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default enter / state transitions |
| `ease-signal` | `cubic-bezier(0.16, 1, 0.3, 1)` | Big entrances: modals, panels, pages |
| `ease-exit` | `cubic-bezier(0.7, 0, 0.84, 0)` | Exits |
| `ease-linear` | `linear` | Opacity, shimmer, rotation |

### 1.10.4 Distance tokens (TG-2A §43.3)

| Token | Value | Use |
|-------|-------|-----|
| `motion-d1` | 4px | Tooltips, focus reveals |
| `motion-d2` | 8px | Dropdowns, popovers, menus |
| `motion-d3` | 12px | Modals, dialogs, toasts |
| `motion-d4` | 16px | Drawers, full-panel slides (maximum) |

### 1.10.5 Extension — stagger and delay tokens

| Token | Value | Use |
|-------|-------|-----|
| `motion-stagger-40` | 40ms | Stagger between list/skeleton items (min) |
| `motion-stagger-60` | 60ms | Stagger between list/skeleton items (max) |
| `motion-delay-100` | 100ms | Secondary-element entrance after primary |
| `motion-delay-200` | 200ms | Tertiary-element entrance; data-arrival reveal |

Rules: stagger is 40–60ms per item, max 6 items, total ≤ 300ms (TG-2A §44.3). Delay tokens exist so multi-part reveals are deterministic, never hand-timed.

### 1.10.6 When NOT to use

Ad-hoc durations/curves, springs or bounce, anything over 400ms (TG-2A §43.1), decoration-only motion (TG-2A §43.5).

---

## 1.11 Z-index Tokens

### 1.11.1 The philosophy

> **Stacking order is the vertical axis of the instrument — layered, legible, and never improvised. A defined z-scale prevents the two classic failures: overlay-drowning (a tooltip above a modal) and z-index arms races (everyone adding 9999).**

### 1.11.2 The z-index scale

| Token | Value | Carries |
|-------|-------|---------|
| `z-0` | 0 | Base content, canvas |
| `z-sticky` | 100 | Sticky table headers, sticky toolbars, sticky page actions |
| `z-header` | 200 | Global header (fixed, TG-2A §23) |
| `z-drawer` | 300 | Drawers: context drawers, mobile navigation drawers |
| `z-overlay` | 400 | `elev-2` floating layers: dropdowns, popovers, tooltips, command palette |
| `z-modal` | 500 | `elev-3` blocking layers: modals, dialogs |
| `z-toast` | 600 | Toasts and transient notices |
| `z-stage` | 700 | `elev-4` stage overlays: remote-session view, focused workflows |

### 1.11.3 Z-index rules

| Rule | Detail |
|------|--------|
| **No raw numbers** | UI never hard-codes a z-index; tokens only. A token outside the scale requires governance review (§1.14). |
| **Elevation ↔ z pairing** | `elev-2→z-overlay`, `elev-3→z-modal`/`z-drawer`, `elev-4→z-stage` (§1.8.3). Elevation and stacking order never disagree. |
| **Toasts above modals, scrims inside** | A toast can appear over a modal (`z-toast > z-modal`); a modal's scrim sits inside its own stacking context, never above a second modal. |
| **One stage at a time** | Only one element may occupy `z-stage`; only one at `z-modal` (one modal at a time, TG-2A §26.3). |
| **Stacking contexts are contained** | Fixed/transformed ancestors create local contexts; z-tokens are meaningful within the document flow and are reassessed during component review. |
| **No dependence on order** | Overlays never rely on DOM order alone — z-tokens are explicit. |

### 1.11.4 When NOT to use

Z-values invented per feature, `z-index: 9999` escapes, elevation expressed via z-index without an elevation token, negative z-indices for content.

---

## 1.12 Size Tokens

### 1.12.1 The philosophy

> **Size is a spectrum of a few named steps, not a playground. The same `sm/md/lg` vocabulary drives controls, icons, and avatars so that any two components can sit in one row and agree.**

### 1.12.2 Control height scale

| Token | Value | Use |
|-------|-------|-----|
| `size-control-sm` | 32px | Dense toolbars, compact tables |
| `size-control-md` | 36px | Default buttons, inputs, selects, date fields |
| `size-control-lg` | 44px | Primary surface actions, forms on touch, hero CTAs |

Rules: control heights pair 1:1 in a row (TG-2A §18.4); never a 44px input next to a 32px button.

### 1.12.3 Touch target token

| Token | Value | Use |
|-------|-------|-----|
| `size-touch` | 44px | Minimum interactive target on touch devices (TG-2A §41.8); desktop icon-only targets may render at 36px visual with a ≥ 36px hit area |

### 1.12.4 Icon size tokens (TG-2A §13.2, formalized)

| Token | Value | Use |
|-------|-------|-----|
| `size-icon-xs` | 14px | Dense metadata, table cell icons |
| `size-icon-sm` | 16px | Buttons, table cells, inline status icons |
| `size-icon-md` | 20px | Navigation, empty states, section icons |
| `size-icon-lg` | 24px | Hero icons, status chips, avatar glyphs |

### 1.12.5 Density tokens

| Token | Value | Use |
|-------|-------|-----|
| `density-comfortable` | Table rows 44px, panel padding 24px | Default (TG-2A §48.3) |
| `density-compact` | Table rows 36px, panel padding 16px | Opt-in global mode |

Density is a global preference, never a per-screen hack (TG-2A §48.3), and never shrinks focus rings, touch targets, or text below accessibility floors.

### 1.12.6 When NOT to use

Fractional or off-scale sizes, percentage-scaled icons, size tokens applied to layout spacing (that is `space-*`).

---

## 1.13 Naming Convention

### 1.13.1 The philosophy

> **A token's name is its contract (TG-2A §56). The grammar makes names self-documenting: the family says what kind of thing it is, the role says what job it does, the modifier says exactly which instance.**

### 1.13.2 The token grammar

```
<family>[-<role>][-<modifier>]
```

| Segment | Rule | Examples |
|---------|------|----------|
| **family** | The token kind, usually a leading word | `surface`, `text`, `border`, `opacity`, `space`, `radius`, `shadow`, `elev`, `motion`, `ease`, `z`, `size`, `graphite`, `signal`, `optic`, `go`, `caution`, `critical` |
| **role** | The semantic job (semantic layer) | `-panel`, `-primary`, `-default`, `-scrim`, `-modal` |
| **modifier** | The specific instance (state / step / theme variant) | `-hover`, `-pressed`, `-disabled`, `-md`, `-500`, `-2` |

### 1.13.3 Token class rules

| Class | Pattern | Example |
|-------|---------|---------|
| **Primitive** | `family-<step>` or `family-<name>` | `graphite-500`, `space-4`, `border-1`, `opacity-12`, `radius-lg`, `signal-600` |
| **Semantic** | `family-<role>` | `surface-panel`, `text-primary`, `border-default`, `opacity-scrim-modal`, `elev-2`, `z-modal` |
| **Component** | `<component>-<role>` | `button-primary-bg`, `table-row-hover`, `chip-filter-fill`, `toast-error-icon` |
| **Theme** | `<family>-<role>` inside a theme map | `surface-canvas` mapped per theme |

### 1.13.4 Naming rules

| Rule | Detail |
|------|--------|
| **Role before appearance** | `status-critical`, not `red`; `elev-3`, not `big-shadow` (TG-2A §54.3). |
| **States are modifiers** | `action-hover`, `action-pressed`, `action-disabled` — never new roles per state. |
| **Scale steps are stable** | Numeric steps (500, 600) never change meaning across families. |
| **No abbreviations** | `surface`, not `sfc`; `opacity`, not `opa`. |
| **Singular, kebab-case** | `border-default`, not `borders-default`; tokens are kebab-case, values camelCase at runtime. |
| **One term, one token** | A concept has exactly one token; duplicates are merged in review (§1.14). |

### 1.13.5 When NOT to use

Color-named variants (`variant="red"`), team-local naming, tokens that encode layout position (e.g., `text-left`), and numeric magic values without a token name.

---

## 1.14 Token Governance

### 1.14.1 The philosophy

> **A token is a promise to every consumer. Changing one value ripples through every screen in both themes — so the registry has a lifecycle, an owner, and a gate (TG-2A §54.3 extended).**

### 1.14.2 The token lifecycle

| Stage | Meaning | Gate |
|-------|---------|------|
| **Proposed** | A gap is identified; a token is drafted with rationale | Designer or engineer files a Token Decision Record (TDR) |
| **Approved** | Design Systems + Engineering accept the value and rationale | TDR review |
| **Released** | Generated into the registry, versioned, published | Version bump (§5.2); consumers can adopt |
| **Deprecated** | Superseded; documented as deprecated with a replacement | Deprecation notice; ≥ 2 minor versions before removal |
| **Removed** | Deleted from the registry | Major version only; migration guide required |

### 1.14.3 Token Decision Record (TDR)

Every proposed or changed token carries a TDR with:

| Field | Required content |
|-------|------------------|
| **WHAT** | Token name, class, value per theme |
| **WHY** | The problem it solves; the design principle it serves (TG-2A §2) |
| **WHEN** | Where it is intended to be used |
| **WHEN NOT** | Where it must not be used |
| **Provenance** | The source value (hex, curve, spec reference) |
| **Impact** | Affected surfaces, existing tokens it replaces, theme delta, contrast result |
| **Evidence** | Visual regression capture (both themes) |

### 1.14.4 Change types and versioning

| Change | Version impact | Requires |
|--------|----------------|----------|
| Add new semantic/primitive token | Minor | TDR + review |
| Change a token's value (non-breaking) | Patch/Minor | TDR + visual regression both themes |
| Change a token's value (breaking visual) | Minor with deprecation note / Major | TDR + regression + migration note |
| Remove or rename a token | Major | Deprecation cycle first; migration guide (§5.3, §5.4) |

### 1.14.5 Governance rules

| Rule | Detail |
|------|--------|
| **No token, no exception** | A hard-coded design value anywhere in UI is a governance violation, not a token (TG-2A §54.3). |
| **Semantic-only consumption** | UI consumes semantic tokens; primitives are minted only through governance (§1.1.3). |
| **One source of truth** | The registry is generated from one source; editing generated output is forbidden. |
| **Both-theme proof** | Every value is valid and AA-checked in both themes before release (§6.2). |
| **Deprecation is documented** | Deprecated tokens remain in the registry, flagged, with replacement mapping and migration date. |
| **Changes are reviewed** | Token changes pass the Design Review Checklist (§6.1) and the system approval gate (TG-2A §58). |

### 1.14.6 When NOT to use

Skipping the gate for speed, silent value changes in themes, tokens created per-screen to avoid a real decision, undeprecated removal.

---

## 1.15 Future Token Expansion

### 1.15.1 The philosophy

> **The registry is designed to accept growth without character change (TG-2A §55). New capabilities land as new tokens inside the same grammar — never as parallel systems.**

### 1.15.2 Expansion roadmap (declared now, minted on demand)

| Future family | Purpose | Guardrail |
|---------------|---------|-----------|
| `container-*` | Container-query tokens for widget reflow | Only for true container-scoped layout; never for spacing/type |
| `chart-*` | Data-viz scales (axis, grid, tooltip, annotation tokens) | Derived from §37 and §2.30; colorblind-safe only |
| `focus-*` | Focus ring geometry (width, offset, color per theme) | Consolidates §41.5 into tokens |
| `ai-*` | AI surface tokens (avatar, source chip, confidence, citation) | Optic-only identity; never migrates to general UI |
| `brand-*` | White-label re-mapping surface (logo, accent, name) | Token-mapped, instrument structure unchanged (TG-2A §55.2) |
| `status-*` | Complete status scale (severity tiers, tints, icons) | Always icon + label + color (§5.6) |
| `motion-pref-*` | Reduced-motion override tokens | Guarantees zero information loss (§3.15) |

### 1.15.3 Expansion rules

| Rule | Detail |
|------|--------|
| **Same grammar** | New families follow §1.13 naming, §1.14 governance, and the four-layer model (§1.1.2). |
| **Capability, not vocabulary** | A "new kind of panel" means the registry is missing a token, not a new system (§55.2). |
| **Enterprise scale is invisible** | SSO, audit, retention, and compliance add surfaces, not heavier visual character (TG-2A §55.2). |
| **White-label is a mapping** | `brand-*` re-maps tokens; the instrument structure never changes. |

### 1.15.4 The expansion test (applies to every new token family)

A new family passes only if it: (1) serves a design principle (§2), (2) survives the character test (TG-2A §55.3), (3) holds in both themes at AA, (4) is expressible in the existing grammar, and (5) would be adopted by at least two surfaces.

---

# PART 2 — ENTERPRISE COMPONENT LIBRARY

---

## 2.0 Library Introduction

### 2.0.1 The philosophy

> **Components are machined parts (TG-2A §16): one definition, one behavior, one anatomy, everywhere. This part completes the library — every component the enterprise platform needs that TG-2A did not already specify.**

### 2.0.2 How to read this part

- Components **fully specified in TG-2A** are listed in §2.0.4 as reference entries and are **not re-specified** here.
- Components **new to this part** carry the full standard: Purpose, Anatomy, Variants, States, Accessibility, UX Rules, Usage, Anti-Patterns.
- Every component, wherever specified, must pass the Design Checklist (TG-2A §57) and the QA checklists (§6).

### 2.0.3 Component taxonomy (the decision map)

```
TOKENS (Part 1)
  └── PRIMITIVES            COMPOSITES              PATTERNS (Part 4)
      Button (§17)          Card (§19)              Dashboard (§38, §4.2)
      Input (§18)           Panel (§2.13)           Forms (§25, §4.8)
      Textarea (§2.1)       Table (§20)             Wizard (§4.4)
      Checkbox (§2.2)       Accordion (§2.14)       Settings (§4.3)
      Radio (§2.3)          Tabs (§2.15)            AI Chat (§4.13)
      Switch (§2.4)         Modal (§26)             Reports (§4.9)
      Select (§2.5)         Drawer (§2.18)          Monitoring (§4.12)
      Combobox (§2.6)       Dialog (§31)            Knowledge Base (§4.14)
      Search (§2.7)         Dropdown (§27)          Cybersecurity (§4.16)
      Date Picker (§2.8)    Popover (§2.19)
      Avatar (§2.9)         Toast (§30)
      Badge (§2.10)         Notification (§29)
      Chip (§2.11)          Progress (§2.20)
      Tag (§2.12)           Stepper (§2.21)
      Breadcrumb (§2.16)    Timeline (§2.22)
      Pagination (§2.17)    Tree View (§2.23)
                            File Upload (§2.24)
                            AI Response/Citation/Confidence/Sources (§2.25–§2.28)
                            Dashboard Widgets (§2.29)
                            Charts (§2.30)
```

### 2.0.4 Reference entries (components specified in TG-2A — no extension)

| Component | Specified in | Purpose (one line) |
|-----------|--------------|---------------------|
| **Button** | TG-2A §17 | The atomic action element; everything the user does starts from a button. |
| **Input** | TG-2A §18 | Text entry on the instrument's data-entry points; inset field, visible label. |
| **Card** | TG-2A §19 | Self-contained unit of information and/or action on `elev-1`. |
| **Navbar** | TG-2A §21, §23 | The fixed 56px global header: identity, tenant, search, alerts, user. |
| **Sidebar** | TG-2A §22 | The persistent left navigation rail; the product's structural spine. |
| **Table** | TG-2A §20 | The instrument's data grid; the highest-density, highest-precision component. |
| **Modal** | TG-2A §26 | Blocking overlay (`elev-3`) for a focused task. |
| **Dialog** | TG-2A §31 | The confirmation dialog; the last line of defense before an irreversible change. |
| **Tooltip** | TG-2A §28 | A micro label that clarifies an element; identification only, never instructions. |
| **Dropdown** | TG-2A §27 | A lightweight menu of options triggered by a control. |
| **Toast** | TG-2A §30 | A transient, non-blocking confirmation of an action's outcome. |
| **Notification** | TG-2A §29 | The persistent in-product message center; the record of alerts and events. |

These components are complete. No extension is added in TG-2X; any future change goes through governance (§5).

---

## 2.1 Textarea

### 2.1.1 Purpose

Multi-line text entry for prose, notes, log excerpts, and descriptions — the field where users write, not type. **WHAT:** A resizable, labeled multi-line input. **WHY:** Single-line inputs truncate meaning; free-form notes are a core professional activity (runbook notes, incident descriptions, report comments).

### 2.1.2 Anatomy

```
 Label (13px, 500)                            [optional count 120/400]
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Multi-line text entry surface                              │
│                                                            │
└────────────────────────────────────────────────────────────┘
   bottom-right resize handle (vertical only)
 helper text / error (icon + message, 13px)
```

| Part | Standard |
|------|----------|
| Height | Min 3 rows (~80px); grows with content up to a defined max (default 8 rows), then scrolls internally |
| Width | 100% of its grid column, ≤ 720px (`container-reading`) for prose |
| Padding | 8px 12px (matches Input, §18.2) |
| Radius | `radius-sm` (6px) |
| Surface | `surface-inset`, `border-default`, focus `signal` 1.5px + ring |
| Resize | Vertical only; the horizontal handle is disabled (horizontal scroll is forbidden in textareas) |
| Count | Character count only for bounded fields, right-aligned, `text-meta` |

### 2.1.3 Variants

| Variant | Use |
|---------|-----|
| `standard` | Notes, descriptions, comments, runbook entries |
| `mono` | Log excerpts, JSON, command blocks — Plex Mono, tabular figures, no spell-check UI |
| `code` | Code/script entry — mono, line numbers optional, tab inserts space (not focus) |

### 2.1.4 States

| State | Rules |
|-------|-------|
| Default | Inset, `border-default` |
| Hover | `border-strong` |
| Focus | 1.5px `signal` border + 2px ring offset 2px (§41.5); no layout shift |
| Error | `critical` border + icon + message below (§33); never red alone |
| Disabled | `surface-inset` at `opacity-disabled-control`, no pointer; explain why if blocking (§33) |
| Read-only | Normal look, non-interactive, value selectable |

### 2.1.5 Accessibility

Label associated via `for`/`id`; helper and error linked via `aria-describedby`; error announced via `aria-live`; mono variant exposes correct monospace semantics to screen readers (no special handling needed — text is text).

### 2.1.6 UX Rules

| Rule | Detail |
|------|--------|
| **Resize is user-controlled** | Auto-grow only for constrained note fields; never reflow siblings while typing. |
| **Bounded fields declare the bound** | A max-length field shows the counter *before* the limit is hit; hitting the limit blocks input, never silently truncates. |
| **Enter behavior is explicit** | Textareas insert newlines by default; an "Enter to submit" form announces it or uses a submit button. |
| **Spell-check and formatting** | Spelling/grammar suggestions are native and calm; markdown/rich-text is a separate component decision. |

### 2.1.7 Usage

Runbook notes, incident descriptions, report annotations, AI prompt detail, release notes, knowledge base articles (with markdown).

### 2.1.8 Anti-Patterns

- A single-line Input stretched into a "textarea-like" field (broken tab, broken wrap).
- Horizontal scrolling inside a textarea.
- Character count that appears only at the limit.
- Disabling paste or auto-expanding beyond the viewport.

---

## 2.2 Checkbox

### 2.2.1 Purpose

Binary selection that is **committed with the form** — the checkbox is a choice to be saved, not an immediate action. **WHAT:** A 16px box with a check glyph and an always-present label. **WHY:** Bulk selection and multi-option toggles are the professional's daily vocabulary (select devices, enable modules, apply settings).

### 2.2.2 Anatomy

```
┌──┐
│✓ │  Device WKS-014               ← label right, 14px, clickable
└──┘
 16px box, radius-sm (4px), border-strong,
 checked: signal fill, white check
```

| Part | Standard |
|------|----------|
| Box | 16 × 16px, `radius-sm` (4px), `border-strong` resting |
| Checked | `action-primary` fill, `white` 12px check glyph |
| Label | Right, 14px, `space-2` gap; the entire label is part of the hit area |
| Group | `fieldset` + `legend` for any group; groups may be a single column or inline (≤ 4 short options) |

### 2.2.3 Variants

| Variant | Use |
|---------|-----|
| `single` | A lone binary option in a form |
| `group` | A set of independent options (multi-select) |
| `indeterminate` | Parent reflects "some children selected" (never a user-set resting state) |
| `table-header` | Select-all on page (TG-2A §20.4); header checkbox mirrors row state |

### 2.2.4 States

| State | Rules |
|-------|-------|
| Unchecked | Empty box, `border-strong` |
| Checked | Signal fill + white check; check draws in 150ms fill + glyph appear (§53.2) |
| Indeterminate | Signal fill + horizontal bar; 150ms |
| Hover | Box border brightens (`border-focus`); fill never applies on hover alone |
| Focus | 2px ring offset 2px (§41.5); **never** `outline: none` |
| Disabled | `opacity-disabled-control`; disabled option still conveys its checked state |
| Group error | Fieldset-level error banner; individual boxes get `aria-invalid` where a specific option is invalid |

### 2.2.5 Accessibility

`role="checkbox"` with `aria-checked` (true/false/mixed); groups use `fieldset`/`legend`; keyboard `Space` toggles; disabled state announced; never rely on the glyph alone (checked = visual + `aria-checked` + text).

### 2.2.6 UX Rules

| Rule | Detail |
|------|--------|
| **Checkbox ≠ Switch** | Checkbox = a choice saved with the form. Switch = immediately applied (§2.4). If the UI has a "Save" button, the boolean is a checkbox. |
| **Label is the target** | Clicking the label toggles; the 16px box alone is too small a target (extend hit area to ≥ 24px, label included). |
| **Indeterminate is derived** | Only the parent of a mixed group is indeterminate; users never set it directly. |
| **No double meaning** | A checkbox means one thing; "enable all" must be a distinct control. |

### 2.2.7 Usage

Multi-device selection in tables, permission toggles, settings lists, filter "include" options, mass actions.

### 2.2.8 Anti-Patterns

- Checkbox for an immediate action (use Switch).
- Checkbox-only state without a label (accessible-name error).
- Indeterminate shown as a user-settable resting state.
- Table header checkbox that silently deselects across pages (state it, TG-2A §20.4).

---

## 2.3 Radio

### 2.3.1 Purpose

Single selection from a small, mutually exclusive set (≤ 5 visible options). **WHAT:** A circle with a fill dot in a `radiogroup`. **WHY:** Radio forces one answer and makes all options visible — better than a Select when the set is small and the decision matters.

### 2.3.2 Anatomy

```
┌─┐
│●│  Standard plan                    ← one of ≤ 5, label right
└─┘
 16px circle, border-strong, selected: signal fill + white dot
```

### 2.3.3 Variants

| Variant | Use |
|---------|-----|
| `standard` | Vertical stack of options (default) |
| `inline` | Horizontal row — only ≤ 4 short options |
| `card` | Options presented as selectable tiles (with description); radio semantics retained |

### 2.3.4 States

Same state model as Checkbox (§2.2.4) with `aria-checked` true/false (never mixed).

### 2.3.5 Accessibility

`role="radiogroup"` on the group; arrow-key navigation between options (Roving tabindex); `Space` selects the focused option; selected state announced; each option labeled.

### 2.3.6 UX Rules

| Rule | Detail |
|------|--------|
| **One default** | A radio group has a sensible default or a deliberate "None"; never a group that starts empty without reason. |
| **Arrows move selection** | In a radio group, arrow keys change the selection (unlike lists where arrows navigate). |
| **≤ 5 options** | 6+ options become a Select or Combobox (§2.5, §2.6). |
| **Never mixed with Select** | The same option set is one component; never radio-in-modal plus select-in-panel for identical data. |

### 2.3.7 Usage

Plan tier, deployment mode, retention window, report granularity, permission level.

### 2.3.8 Anti-Patterns

- More than 5 options in a radio stack.
- Radio for a Boolean (that is a Checkbox/Switch).
- Horizontal radio rows that wrap unpredictably.
- Clicking the label not selecting (label must be in the hit area).

---

## 2.4 Switch

### 2.4.1 Purpose

A Boolean control whose effect is **applied immediately** — no Save button needed. **WHAT:** A track with a sliding thumb, always labeled, announcing the resulting state. **WHY:** Toggles are the "instant response" primitive of a live product (enable monitoring, mute alerts, enter maintenance mode).

### 2.4.2 Anatomy

```
Label (14px)                     ┌──────┐
Enable live monitoring        ───│ ○─── │─── On
                                 └──────┘
   track 36×20 (touch 44×24), thumb 16px, travel 4px,
   on: action-primary track, white thumb; off: graphite-600 track
```

| Part | Standard |
|------|----------|
| Track | 36 × 20px desktop (44 × 24px touch), `radius-full` |
| Thumb | 16px white circle; 4px travel; 150ms linear ease (§53.2) |
| Label | Left, 14px, `space-3` gap; or right in dense lists |
| On-state text | "On"/"Off" conveyed by `aria-checked` + optional visible label; a standalone `On/Off` text next to the track is recommended |

### 2.4.3 Variants

| Variant | Use |
|---------|-----|
| `standard` | Settings, preferences, feature toggles |
| `inline-list` | Dense rows where each row is a switch with label (maintenance, notification per-device) |

### 2.4.4 States

| State | Rules |
|-------|-------|
| Off | `graphite-600` track, thumb left |
| On | `action-primary` track, thumb right |
| Pending | Optimistic in-flight: thumb in final position, subtle `opacity-85`; roll back honestly on failure (§52.4) |
| Hover | Track brightens; **never** translate the thumb on hover |
| Focus | 2px ring offset 2px (§41.5) |
| Disabled | `opacity-disabled-control`; state still visible |

### 2.4.5 Accessibility

`role="switch"` + `aria-checked` (true/false); keyboard `Space`/`Enter` toggles; label associated; the resulting state is announced, not just the gesture.

### 2.4.6 UX Rules

| Rule | Detail |
|------|--------|
| **Switch = immediate** | If the value only takes effect on Save, it is a Checkbox (§2.2.6). |
| **Label the state, not the gesture** | "Enable live monitoring" — never "Click to enable." |
| **Consequences are visible** | A switch that starts a consequential state (e.g., maintenance mode) shows its consequence inline or with a confirm dialog (§31) when irreversible. |
| **No hidden autosave** | A switch that saves silently still shows the applied result (optimistic + honest rollback, §52.4). |

### 2.4.7 Usage

Live monitoring, alert muting, auto-reporting, maintenance mode, data retention toggles, feature flags for admins.

### 2.4.8 Anti-Patterns

- Switch inside a Save-button form (contradicts the primitive's contract).
- Label-less switches (no accessible name).
- Thumb animation on hover.
- Switch used for a destructive state without consequence visibility.

---

## 2.5 Select

### 2.5.1 Purpose

Single selection from a closed list too long for radio (6–25 options). **WHAT:** A trigger showing the current value with a chevron, opening the Dropdown menu (§27). **WHY:** A Select collapses options to one line — right-sized for settings, filters, and config where radio would be a wall of choices.

### 2.5.2 Anatomy

```
Label (13px, 500)
┌────────────────────────────────┐
│ Current value            [chev] │  height 36px, radius-sm,
└────────────────────────────────┘   surface-inset, border-default
  ┌──────────────────────────────┐
  │ ● Current value              │   dropdown (§27): 8px menu,
  │   Option two                 │   radius-md, shadow-md
  └──────────────────────────────┘
```

### 2.5.3 Variants

| Variant | Use |
|---------|-----|
| `standard` | 6–25 fixed options |
| `searchable` | > 25 options — but that is the Combobox contract (§2.6); Select stays closed-list |
| `grouped` | Options grouped with 11px eyebrow labels (§27.3) |
| `native` | Mobile fallback: the browser's native `<select>` (reliable, accessible picker on touch) |

### 2.5.4 States

| State | Rules |
|-------|-------|
| Unselected | Placeholder text `text-muted` + chevron; never a blank field |
| Selected | Value in primary text + chevron |
| Open | Menu per §27; selected option marked with check |
| Hover / Focus / Disabled / Invalid | Identical to Input (§18.3); invalid includes icon + message |

### 2.5.5 Accessibility

Use `combobox`/`listbox` ARIA pattern for custom renders; native `<select>` is preferred where full styling is unnecessary. Keyboard: `Enter`/`Space` opens, arrows move, `Esc` closes, selection announced. Label always associated.

### 2.5.6 UX Rules

| Rule | Detail |
|------|--------|
| **Size the control to the job** | ≤ 5 → Radio; 6–25 → Select; > 25 → Combobox. This is a hard rule. |
| **Value is always visible** | The trigger shows the current value; a Select never reads like an input placeholder. |
| **Groups over alphabetical walls** | Long option lists use groups and a stable sort (canonical order, then alphabetical). |
| **Default documented** | The pre-selected option is deliberate and documented (§51.3). |

### 2.5.7 Usage

Status assignment, timezone, retention window, report format, filter dimension.

### 2.5.8 Anti-Patterns

- Select for ≤ 5 options (radio is faster to scan).
- Select for search-required lists (that is a Combobox).
- Multi-select via a Select (use checkbox menu or a dedicated multi-select per §27.3).
- Free text entry inside a Select.

---

## 2.6 Combobox

### 2.6.1 Purpose

Selection from a large set (> 25) or search-with-optional-free-entry. **WHAT:** An input that filters a listbox as you type, with keyboard-complete selection. **WHY:** Device inventories, tenants, and KB articles are too large for a Select; search-first selection is the enterprise pattern.

### 2.6.2 Anatomy

```
Label (13px, 500)
┌────────────────────────────────────┐
│ ⌕ WKS-0…               [×] [chev]  │  input + listbox popover
└────────────────────────────────────┘
  ┌──────────────────────────────────┐
  │ WKS-014   · SRV · Healthy   ●    │  6 results max before scroll,
  │ WKS-021   · WKS · Caution   ▲    │  selected value marked, first item
  └──────────────────────────────────┘   highlighted as active
```

### 2.6.3 Variants

| Variant | Use |
|---------|-----|
| `search-select` | Filtering a fixed set; free text not allowed |
| `create-option` | Filtering plus "Create 'x'" affordance when no match (e.g., new tag) |
| `multi` | Multiple selected values as chips in the field (with remove ×) |

### 2.6.4 States

| State | Rules |
|-------|-------|
| Closed/selected | Value shown; clear (×) when a value exists and is clearable |
| Typing | Filter as-you-type; results update on every keystroke (debounce ≤ 150ms) |
| Active row | Keyboard highlight, `surface-inset` |
| Empty results | "No matches for 'xyz'." + clear/close affordance (§32 grammar) |
| Error / Disabled | Per Input (§18.3) |

### 2.6.5 Accessibility

Full ARIA `combobox` pattern: `role="combobox"` + `aria-expanded` + `role="listbox"` + `aria-activedescendant`; keyboard: arrows navigate, `Enter` selects, `Esc` closes then clears if already open; selection announced. The listbox is a popover on `elev-2`.

### 2.6.6 UX Rules

| Rule | Detail |
|------|--------|
| **Selection is confirmed** | The field closes to the selected value — a combobox never stays open waiting after selection unless multi. |
| **Highlight on match** | Matching substring is emphasized (bold/`signal`) so users see *why* a row matched. |
| **Threshold for search** | Show the first N options (e.g., 8) on open so an empty-input state is never a blank list. |
| **Create-option is explicit** | "Create" is a distinct affordance, never a silent free-text result. |

### 2.6.7 Usage

Device selection, tenant/org switcher, KB search-as-select, tag creation, user assignment.

### 2.6.8 Anti-Patterns

- Combobox for ≤ 25 fixed options.
- Free-text entry where the value must come from a closed set (validation breaks).
- Listbox that scrolls infinitely without virtualizing (device fleets, §50.3).
- Selecting on blur without visual confirmation.

---

## 2.7 Search

### 2.7.1 Purpose

Find content across or within a surface. Two families: **Global search** (header + `Ctrl/Cmd+K` → command palette, TG-2A §21.5) and **field search** (within tables, panels, settings). **WHAT:** An input with a magnifier and clear affordance, wired to a results surface. **WHY:** In an enterprise product, search is a primary navigation verb — professionals search before they browse.

### 2.7.2 Anatomy

```
Global (header):
┌─────────────────────────────┐
│ ⌕  Search devices, alerts…  │  width 320–480px, focus: full-width palette
└─────────────────────────────┘

Field (in a table toolbar, §4.6):
┌──────────────────┐
│ ⌕  Filter by name │ [×]
└──────────────────┘
```

| Part | Standard |
|------|----------|
| Leading icon | Magnifier, 16px, `text-muted` |
| Clear (×) | Appears only when there is a query; `Esc` clears first, then closes |
| Placeholder | Actionable: "Search devices, alerts, KB…" — never the word "Search" alone when scope is evident |
| Results | Command palette (§21.5) for global; inline table filtering for field search |
| Debounce | 150–300ms for remote search; instant for local filtering |

### 2.7.3 Variants

| Variant | Use |
|---------|-----|
| `global` | Header; opens the command palette (§21.5) |
| `field` | Scoped to the current table/panel; narrow (≤ 320px) |
| `expandable` | Mobile: icon → expands to full-width field |

### 2.7.4 States

| State | Rules |
|-------|-------|
| Idle | Placeholder visible |
| Focus | Ring per §41.5; global search expands to the palette |
| Loading | Thin "Searching…" meta or skeleton rows in the palette; never a full spinner for search |
| Empty | "No matches for 'xyz'." + suggestions (§32 grammar); never a dead end |
| Recent (global) | Show recent searches on idle focus; clearable history |

### 2.7.5 Accessibility

`role="search"` landmark; input labeled; results announced via `aria-live="polite"` (count-level, not per-row); keyboard: `↑↓` navigate, `Enter` open, `Esc` clear-then-close; the palette is focus-trapped (TG-2A §26.4).

### 2.7.6 UX Rules

| Rule | Detail |
|------|--------|
| **Global search is navigation** | Results are grouped (Actions, Devices, Alerts, Reports, KB) with labels (§21.5) — never one undifferentiated list. |
| **Keep context** | Field search scopes to the panel and states it ("within devices"); global search states scope via group labels. |
| **Highlight matches** | Matching text is emphasized so relevance is explainable. |
| **Typo tolerance** | Minor typo tolerance for device/tenant names; exact-match results rank first. |
| **Clear affordance always reachable** | `Esc` clears first, then closes — the standard search escape. |

### 2.7.7 Usage

Global command palette, table filtering, settings search, KB search, alert triage search.

### 2.7.8 Anti-Patterns

- Search that silently searches "everything" from a table toolbar (scope confusion).
- Live full-table re-render on every keystroke without debounce (perf, §50).
- Search results that require a page reload to clear.
- Search as the *only* way to reach primary navigation.

---

## 2.8 Date Picker

### 2.8.1 Purpose

Choose a date, date range, or relative time window. **WHAT:** A field that opens a calendar popover (`elev-2`) or quick-range menu. **WHY:** Retention, scheduling, and reporting are all date decisions; a precise, keyboard-complete picker is a professional trust signal (TG-2A §25.6).

### 2.8.2 Anatomy

```
 Label (13px, 500)
┌───────────────────────────────┐
│ 2026-07-31 — 2026-08-30  [cal] │  height 36px, radius-sm, inset
└───────────────────────────────┘
  ┌─────────────────────────────┐
  │ ‹  August 2026            › │
  │ Mo Tu We Th Fr Sa Su        │
  │           1  2  3           │  calendar grid, radius-md,
  │  4  5  6  7  8  9 10        │  today outlined, range highlighted,
  └─────────────────────────────┘  selected = signal fill
```

### 2.8.3 Variants

| Variant | Use |
|---------|-----|
| `single` | One date |
| `range` | Start–end pair; drag/click start then end |
| `quick` | Relative presets: "Last 7 days", "This month", "Today", "Custom…" (range picker) |
| `datetime` | Date + time; timezone shown explicitly (§39.3) |

### 2.8.4 States

| State | Rules |
|-------|-------|
| Empty | Placeholder format hint, e.g., "MMM D, YYYY" |
| Selected | Value in primary text, mono tabular when numeric format |
| Invalid | Typed value fails validation → `critical` + message (§18.3) |
| Open | Popover with calendar; `Esc` closes; focus moves into the calendar grid |
| Disabled | Per Input (§18.3); explain locked ranges ("Retention locked — plan limit") |

### 2.8.5 Accessibility

Calendar grid with proper `role="grid"` semantics, `aria-label` on days (e.g., "July 31, 2026, Friday"), arrow-key day navigation, `Enter` selects, `aria-live` on month change; typed input accepts ISO-friendly formats with validation; keyboard users never forced into the mouse calendar.

### 2.8.6 UX Rules

| Rule | Detail |
|------|--------|
| **Typing is equal to clicking** | Both typed entry and calendar selection work; typing is validated, not ignored. |
| **Timezone is explicit** | Any cross-timezone surface shows the timezone (§39.3); scheduling states the zone in the result. |
| **Relative presets map to absolute** | "Last 7 days" resolves to a concrete range shown in the field; no ambiguity at export. |
| **Min/max are visible** | Constrained ranges show the bounds; out-of-range dates are disabled, not error-popping. |
| **Today is always findable** | Today has a distinct outline; "Today" is a one-click preset in `quick`. |

### 2.8.7 Usage

Report date windows, retention settings, schedule creation, backup windows, analytics ranges.

### 2.8.8 Anti-Patterns

- Calendar-only selection (typing blocked) — mobile and power users suffer.
- Free-format text with no format hint.
- Range pickers that silently swap start/end.
- Date pickers in timezone-naive contexts without stating the zone.

---

## 2.9 Avatar

### 2.9.1 Purpose

Identity representation for people and tenants. **WHAT:** A circular (or rounded-square for tenants) image-or-initials element. **WHY:** Users, tenants, and agents must be scannable and distinguishable across lists, comments, and chat without full names everywhere.

### 2.9.2 Anatomy

```
  ┌───┐
  │ TK │  28px, radius-full, graphite-700 fill (dark) / graphite-200 (light),
  └───┘  12px white 600 initials; optional status dot (bottom-right)
```

| Part | Standard |
|------|----------|
| Sizes | `xs` 20px, `sm` 24px, `md` 32px, `lg` 40px, `xl` 56px |
| Shape | User: `radius-full`; tenant/org: `radius-lg` (12px); AI: the Optic AI mark, no initials (§40.2) |
| Fallback | First+last initials, 600 weight, `text-secondary` on `graphite-700/200`; photo preferred when available |
| Status dot | 25% of avatar size, bottom-right, Go/Caution/Critical/Offline per §5.5; color never alone (dot + `aria-label`) |

### 2.9.3 Variants

| Variant | Use |
|---------|-----|
| `user` | Circular; initials/photo; current user gets a `signal` ring |
| `tenant` | Rounded-square; org mark or initials |
| `ai` | The Optic AI glyph — never a face, never initials (TG-2A §40.2) |
| `group` | Stacked (overlapping, ≤ 3, +count for more) or 2×2 grid |

### 2.9.4 States

| State | Rules |
|-------|-------|
| Default | Neutral surface, initials or photo |
| Hover | Only if interactive (opens profile): 1px ring + subtle lift; never on static avatars |
| Focus | Ring per §41.5 when interactive |
| Missing image | Fallback initials; broken-image icon is forbidden |

### 2.9.5 Accessibility

Decorative avatars are `aria-hidden`; interactive avatars are links/buttons with an accessible name (the person's name). Status dots have `aria-label` ("WKS-014 — Healthy"); images carry `alt` = person/tenant name.

### 2.9.6 UX Rules

| Rule | Detail |
|------|--------|
| **Consistent size in context** | One list uses one size; avatars never vary within a row. |
| **Initials are deterministic** | First letter of first + last name; never random colors per user. |
| **Status belongs to the object** | The dot reports the *person's/device's* state, not UI state. |
| **AI is never anthropomorphic** | The AI avatar is the Optic mark — the product's honesty motif, not a character. |

### 2.9.7 Usage

User menus, comment attribution, chat participants, tenant switcher, agent/device identity chips.

### 2.9.8 Anti-Patterns

- Emoji or random-color avatars.
- Avatar-only rows without names (identity ambiguity).
- Animated avatars (idle motion is forbidden, §42).
- Using the AI mark for human users or vice versa.

---

## 2.10 Badge

### 2.10.1 Purpose

A **non-interactive** indicator of state, status, or count attached to an icon, label, or row. **WHAT:** A small chip-like marker. **WHY:** Professionals need at-a-glance state: unread counts, severity, "new", environment tags — without the affordance (or implied action) of a Chip.

### 2.10.2 Anatomy

```
 ● Healthy ── status badge: status icon + label, radius-full, 20–24px height
 (3) ──────── count badge: tabular number, 16–20px, on a corner of an icon
 [Prod] ───── label badge: environment/module tag, radius-full, graphite
```

| Part | Standard |
|------|----------|
| Heights | 16px (corner dot/count), 20px (mini), 24px (standard) |
| Radius | `radius-full` |
| Status badge | Icon + label + color, per §5.6 (never color alone) |
| Count badge | Tabular figures; `critical` fill only when the count is genuinely critical (§5.6); otherwise graphite/signal |
| Placement | Attached corner (top-right of icon), inline after label, or in a table cell |

### 2.10.3 Variants

| Variant | Use |
|---------|-----|
| `status` | Go/Caution/Critical/Info — the Signal Color Code (§5.5) |
| `count` | Unread counts, result counts, cart-like quantities |
| `dot` | 8px presence dot (online, active); color + `aria-label` |
| `label` | Environment (Prod/Staging), module, version |

### 2.10.4 States

Badges are **never interactive** — they have no hover, focus, or active states. Interactivity is the Chip's job (§2.11).

### 2.10.5 Accessibility

Icon-only or dot badges carry `aria-label`; a badge that merely echoes a visible label is `aria-hidden` to avoid duplication; count badges announce as "3 unread".

### 2.10.6 UX Rules

| Rule | Detail |
|------|--------|
| **Badge ≠ Button** | A badge reports; a Chip acts (§2.11.6 decision table). |
| **Severity honesty** | Critical fill only for genuinely critical counts (§5.6); a "3" of informational messages is graphite. |
| **Counts are live** | Count badges update in place with the §44.4 update flash; they never silently jump. |
| **One badge role at a time** | An element carries status *or* count *or* label — never two badges stacked for one concept. |

### 2.10.7 Usage

Alert bell unread count (§23.3), status in table cells, environment tags, "new" feature markers (§22.3).

### 2.10.8 Anti-Patterns

- A clickable badge (make it a Chip or Button).
- Color-only status badges (no icon/label, §41.4).
- Decorative badges with no meaning.
- More than one badge per concept.

---

## 2.11 Chip

### 2.11.1 Purpose

A compact **interactive or removable** label: filter chips, AI suggestion chips, removable value chips, AI source chips. **WHAT:** A pill (≤ 28px) that is tappable, toggleable, removable, or a deliberate informational pill. **WHY:** Chips pack selection, suggestion, and dismissal into a dense, scannable form — the primary multi-select and AI-affordance primitive.

### 2.11.2 Anatomy

```
 ┌───────────────────┐
 │ [✓] Environment  × │  filter chip: toggleable, 28px, radius-full,
 └───────────────────┘   selected: signal tint + check; × when removable
 ┌───────────────────┐
 │ ○ Analyze WKS-014 × │  AI suggestion chip: Optic accent (§40.7)
 └───────────────────┘
```

| Part | Standard |
|------|----------|
| Heights | `sm` 24px, `md` 28px |
| Radius | `radius-full` |
| Selected fill | `signal-50/300` tint + `signal` text + leading check; borders per §1.6.4 |
| AI chip | Optic border + ≤ 12% optic tint (§40.6); never signal |
| Dismiss | Trailing × 14px, focusable; removed chips animate out 150ms |

### 2.11.3 Variants

| Variant | Use |
|---------|-----|
| `filter` | Toggleable filter state (active = tinted) |
| `suggestion` | AI suggestion with dismiss (×) — Optic identity (§40.7) |
| `value` | Selected value in a multi field (removable ×) |
| `status` | **Informational, non-interactive** status pill (icon + label, §5.6) |
| `source` | AI source chip — Optic, tappable to evidence (§2.28) |

### 2.11.4 States

| State | Rules |
|-------|-------|
| Default | Neutral outline, `text-secondary` |
| Selected (toggle) | Signal tint + check + signal text; 150ms transition |
| Hover | Border `border-strong`; removable chips show × brighter |
| Focus | Ring per §41.5 |
| Pressed | 80ms `surface-inset` flash |
| Disabled | `opacity-disabled-control`; state still readable |
| Removed | 150ms fade + shrink (measured transform); sibling chips close the gap |

### 2.11.5 Accessibility

Chips are real buttons (`role="button"` or `<button>`); selected chips expose `aria-pressed`; removable chips expose `aria-label="Remove filter: Environment"`; AI suggestion chips are announced with their Optic/AI context once.

### 2.11.6 Chip vs Badge vs Tag — the decision table

| Need | Component |
|------|-----------|
| Reports a state, no interaction | **Badge** (§2.10) |
| Marks metadata, no interaction, read-only | **Tag** (§2.12) |
| Toggleable, removable, actionable, or AI suggestion | **Chip** (§2.11) |

### 2.11.7 UX Rules

| Rule | Detail |
|------|--------|
| **Dense wrapping** | Chip groups wrap on 8px gaps; overflow shows "+N more" expander (never a horizontal scroll row). |
| **One AI suggestion per surface** | §40.7 — max one AI suggestion chip block per panel. |
| **Removal is clear** | Removable chips always show × (or a defined remove gesture) — never remove by click alone without indication. |
| **Selection meaning is stated** | A filter chip's active state means "included"; this contract is consistent product-wide. |

### 2.11.8 Usage

Table filters (§4.7), AI suggestions (§40.7), multi-select values, AI sources (§2.28), status pills.

### 2.11.9 Anti-Patterns

- Chips as primary navigation (sidebar is, §21).
- A chip that looks selected but has no selection semantics.
- More than one AI-suggestion chip block per surface.
- Non-interactive decoration styled as a chip.

---

## 2.12 Tag

### 2.12.1 Purpose

A **non-interactive, read-only metadata marker** — classification, not action. **WHAT:** A small label affixed to an item. **WHY:** Devices, alerts, and reports carry classification (owner, category, environment, custom tags) that must be visible but never confused with actions.

### 2.12.2 Anatomy

```
 ┌──────────────┐
 │  Department   │  20px, radius-sm (4px), graphite-700/200 surface,
 └──────────────┘   text-secondary 12px, no icon by default
```

| Part | Standard |
|------|----------|
| Heights | 18–20px |
| Radius | `radius-sm` (4px) — Tag is the one "square" label; pills are Chips/Badges |
| Surface | Neutral `graphite-700/200` at ~50% fill, `text-secondary` |
| Prefix | Optional fixed glyph (lock = permission-restricted) |
| Color | Neutral only. Categorical *data* coloring is a chart concern (§37.4), never per-tag decoration |

### 2.12.3 Variants

| Variant | Use |
|---------|-----|
| `neutral` | Default classification |
| `module` | Module-derived tags (Alerts, Reports, Security) — fixed vocabulary (§56.3) |
| `permission` | With lock glyph: "Restricted", "SSO enforced" |
| `custom` | User-created classification; neutral surface, user-named |

### 2.12.4 States

Tags are **never interactive** — no hover, focus, or active states. To *edit* tags, the edit affordance lives outside the tag (an "Edit tags" control), not inside it.

### 2.12.5 Accessibility

Tags are plain text within the item; they carry no role. Where a tag affects actions (permission), the permission state is also conveyed in the item's accessible description, not by color or icon alone.

### 2.12.6 UX Rules

| Rule | Detail |
|------|--------|
| **Fixed vocabulary** | Tag values follow the product vocabulary (§56.3); custom tags are user-defined but single-term. |
| **Count discipline** | Max ~5 tags per item before "+N" collapse; tags wrap, never truncate silently. |
| **Tags are data** | Tagging is searchable and filterable (§4.7) — a tag with no findability is decoration. |

### 2.12.7 Usage

Device classification, alert categories, report type, environment, owner, compliance labels.

### 2.12.8 Anti-Patterns

- Interactive tags (that is a Chip).
- Status colors on tags (that is a Badge/status pill).
- Decorative rainbow tags.
- Tags that truncate with no way to read the full value.

---

## 2.13 Panel

### 2.13.1 Purpose

The **structural container** of a page — a section of the instrument's faceplate, not a standalone story. **WHAT:** A bordered region with an optional header and body. **WHY:** Pages need named, separated sections (settings groups, form sections, report sections) that are quieter and more "structural" than Cards (TG-2A §19).

### 2.13.2 Anatomy

```
┌──────────────────────────────────────────────┐
│ Section title (h3/h4)          [action ghost] │  header: 16px padding, optional border-bottom
├──────────────────────────────────────────────┤
│                                              │
│  body: 24px padding (16px compact)           │
│                                              │
└──────────────────────────────────────────────┘
 surface-raised, border-default, radius-lg, elev-1
```

### 2.13.3 Panel vs Card — the decision table

| Dimension | **Panel** | **Card** |
|-----------|-----------|----------|
| Role | Structural section of a page | Standalone content unit with a story |
| Header | Section title; may be repeated on the same page | Unique title (§19.2) |
| Interactivity | Never clickable as a whole | May be interactive (§19.3) |
| Hover | Never | Only when interactive |
| Nested | Panels contain cards/sections | Cards rarely nest panels |
| Typical place | Settings, forms, report sections | Dashboards, summaries, tiles |

### 2.13.4 Variants

| Variant | Use |
|---------|-----|
| `standard` | Settings group, form section, report section |
| `divided` | Internal sections separated by hairlines (settings zones) |
| `inset` | A sub-panel within a panel for a tightly related group (never a nested border wall) |

### 2.13.5 States

Panels have no interactive states. Loading, empty, and error states inside a panel follow §32–§36 (skeleton/empty/error in-panel patterns).

### 2.13.6 UX Rules

| Rule | Detail |
|------|--------|
| **One panel, one concern** | A panel groups one logical concern; a settings page is a stack of panels with clear titles (§4.3). |
| **Header is a label, not a story** | Panel titles are short nouns ("Device settings"), distinct from Card titles. |
| **No panel-soup** | If two adjacent panels share intent, merge them; if a panel has no title and no action, it is likely layout chrome, not a panel. |
| **Borders stay crisp** | One radius per panel (§10.3); nesting uses the one-step-smaller radius rule. |

### 2.13.7 Usage

Settings sections, form groups, report sections, filter panels, detail sections.

### 2.13.8 Anti-Patterns

- Panels that look clickable (no hover, no affordance).
- A card-wrapped table inside a panel (double chrome).
- Three nested panels of identical weight (visual noise).
- Panel titles that repeat the page title verbatim.

---

## 2.14 Accordion

### 2.14.1 Purpose

Progressive disclosure of secondary content in vertical sections. **WHAT:** Collapsible section headers over content regions. **WHY:** Long configuration, FAQ-style content, and nested settings need one-at-a-time focus without the navigation cost of separate pages.

### 2.14.2 Anatomy

```
┌──────────────────────────────────────────┐
│ ▸ Log retention settings           [Info] │  header: full-width hit target, 44px,
├──────────────────────────────────────────┤   title 14px + chevron (rotates 90°)
│ ▾ Alert thresholds                        │  expanded: chevron down, content below
│   • CPU threshold: 90%                    │  12–16px left inset
│   • Memory threshold: 85%                 │
└──────────────────────────────────────────┘
```

| Part | Standard |
|------|----------|
| Header | 44px hit target, full-row; title left, optional meta/icon right; chevron rotates, never swaps icon style |
| Content | 12–16px left inset aligned to the title; reveal 200–300ms measured transform (§44.2) |
| Motion | Expand: 200–300ms height via measured transform; collapse: 150ms; reduced motion → fade (§3.15) |
| Divider | Hairline between sections (`border-default`) |

### 2.14.3 Variants

| Variant | Use |
|---------|-----|
| `single-open` | One section open at a time (default; open closes the others) |
| `multi-open` | Independent sections (settings that invite comparison) |
| `unstyled` | Invisible borders; used inside a panel body (rare) |

### 2.14.4 States

| State | Rules |
|-------|-------|
| Collapsed | Chevron right, title `text-secondary` |
| Expanded | Chevron down, title `text-primary` |
| Hover | Header `surface-inset` tint |
| Focus | Ring per §41.5; `Enter`/`Space` toggle |
| Disabled | `opacity-disabled-control`; reason via tooltip (§28) |

### 2.14.5 Accessibility

Header is a `<button>` with `aria-expanded` and `aria-controls`; content region linked; keyboard: `Tab` to header, `Enter`/`Space` toggle, `↑↓` move between headers; screen readers announce expanded state.

### 2.14.6 UX Rules

| Rule | Detail |
|------|--------|
| **Disclosure, not navigation** | Accordions hide *secondary* content. Primary tasks must not require an accordion to be found (§8.3 progressive disclosure). |
| **State is obvious** | Expanded/collapsed must be readable without the chevron (chevron + text state + aria). |
| **No nesting beyond one level** | An accordion inside an accordion is a structure failure. |
| **Default state is deliberate** | First section open by default on page load; deep links open their section. |

### 2.14.7 Usage

Advanced settings, filter panels, runbook details, report methodology, help content.

### 2.14.8 Anti-Patterns

- Hiding the primary signal inside an accordion (§38.2 violation).
- Accordion used as a vertical menu (use Tabs/Sidebar).
- Jumping content while expanding (measured transform only, §43.4).
- Every section auto-opening (accordion degenerates to a list).

---

## 2.15 Tabs

### 2.15.1 Purpose

Sub-navigation within a single page for mutually exclusive views of the same object. **WHAT:** A horizontal row of tab labels with an active indicator. **WHY:** Device detail, report detail, and settings need sibling views (Overview / Alerts / Config) that belong to one context.

### 2.15.2 Anatomy

```
 ┌─────────────────────────────────────────────────────┐
 │ Overview   Alerts   Config   History   ··· [more]   │  secondary style tabs,
 │ ▔▔▔                                                  │  active: signal text + 2px
 └─────────────────────────────────────────────────────┘   underline indicator
```

| Part | Standard |
|------|----------|
| Style | `secondary` tabs (§21.3): `text-secondary`, active = `signal` text + 2px underline indicator |
| Height | 36px; labels 14px/500 |
| Leading icon | Optional, 16px; never icon-only tabs |
| Overflow | Scrollable row or "More" dropdown beyond viewport — never wrap |
| Counts | Small neutral count badges allowed (e.g., Alerts (3)); red only if critical (§5.6) |

### 2.15.3 Variants

| Variant | Use |
|---------|-----|
| `secondary` | Standard in-page tabs |
| `segmented` | 2–4 short, equally important options (filters, view modes) — `surface-inset` track, selected = `surface-raised` pill (§53.2) |
| `vertical` | Left-rail tabs for long settings lists on wide screens (mobile: vertical tabs become an accordion/stack) |

### 2.15.4 States

| State | Rules |
|-------|-------|
| Default | `text-secondary` |
| Active | `signal` text + underline; 150ms indicator slide |
| Hover | `text-primary` + faint underline preview (never a full active style) |
| Focus | Ring per §41.5 |
| Disabled | `opacity-disabled-control`; reason via tooltip (§28) |

### 2.15.5 Accessibility

Tablist semantics: `role="tablist"` + `role="tab"` + `role="tabpanel"` with `aria-selected`, `aria-controls`, `aria-labelledby`; arrow keys move between tabs, `Enter`/`Space` activate; keyboard users can always reach panels. Panels are real regions, not hidden-in-aria.

### 2.15.6 UX Rules

| Rule | Detail |
|------|--------|
| **Tabs are sibling views** | Tabs partition one context; distinct pages go in the sidebar (§21). |
| **No tabs for steps** | Sequential steps use the Stepper (§2.21), not tabs — tabs imply "any order." |
| **State persists per tab** | Switching tabs preserves the previous tab's scroll/selection (no data loss surprise). |
| **URL-addressable** | Active tab is reflected in the URL so views are linkable and back/forward works. |

### 2.15.7 Usage

Device detail (Overview/Alerts/Config/History), report tabs, settings sub-sections, incident views.

### 2.15.8 Anti-Patterns

- Tabs for a linear wizard (§2.21).
- More than ~6 tabs (overflow hides meaning; restructure).
- Icon-only tabs with no labels.
- Active tab indicated by color alone (color + underline + text, §41.4).

---

## 2.16 Breadcrumb

### 2.16.1 Purpose

Location and recovery of depth. **WHAT:** A chain of ancestor links ending at the current page. **WHY:** Professionals navigate deep hierarchies (Devices → Fleet → WKS-014 → Settings); breadcrumbs answer "where am I" and offer one-click ascension (TG-2A §21.4).

### 2.16.2 Anatomy

```
 Devices › Fleet › WKS-014 › Settings   ← current page: primary text, NOT a link
```

| Part | Standard |
|------|----------|
| Visibility | Only at depth ≥ 3 (TG-2A §21.4) |
| Separator | Chevron `›` 16px `text-muted` |
| Items | Text links (`signal` on hover + underline); current = `text-primary`, non-link |
| Truncation | Long names truncate with ellipsis + `title`; middle items collapse to a "⋯" dropdown above 5 levels |

### 2.16.3 Variants

| Variant | Use |
|---------|-----|
| `standard` | Page-level hierarchy |
| `trail` | With trailing contextual actions (e.g., "Save") — actions always after the current item, never inside the chain |
| `collapsed` | Middle items behind a "⋯" overflow dropdown (deep hierarchies) |

### 2.16.4 States

Links hover/focus per §41.5; current page has no interactive state.

### 2.16.5 Accessibility

`<nav aria-label="Breadcrumb">` with `aria-current="page"` on the current item; screen readers announce the path; the "⋯" menu follows Dropdown semantics (§27).

### 2.16.6 UX Rules

| Rule | Detail |
|------|--------|
| **One breadcrumb per page** | Breadcrumbs live in the page header; module names echo the sidebar (§21.2). |
| **Current is never a link** | The current page is text; clicking the current name reloading is a failure. |
| **Every ancestor is a real link** | No dead links in the chain. |
| **Mobile parity** | Breadcrumbs wrap or collapse on mobile — never a horizontal scroll trap. |

### 2.16.7 Usage

Device detail, report editor, settings deep pages, KB articles, multi-tenant hierarchies.

### 2.16.8 Anti-Patterns

- Breadcrumbs at depth ≤ 2 (redundant with the page title).
- Breadcrumb items that are not navigable.
- Breadcrumbs inside modals or wizards (they are flow, not hierarchy).
- A breadcrumb that duplicates the page title one-to-one.

---

## 2.17 Pagination

### 2.17.1 Purpose

Bounded traversal through large result sets. **WHAT:** Controls to move between pages/sets of rows. **WHY:** Inventories, logs, and audit trails can far exceed a single view; users need position, scale, and controlled movement (TG-2A §20.5).

### 2.17.2 Anatomy

```
 1,204 of 1,204 devices        [‹]  1  2  3 … 48  [›]   per page: 50 ▼
```

| Part | Standard |
|------|----------|
| Position | Bottom of table, left = count summary, center = pager, right = per-page selector |
| Pager slots | 5 numeric slots with ellipsis (`1 2 3 … 48`); current page `signal` outlined |
| Per-page | 25 / 50 / 100 (configurable, persisted); results reload on change |
| Previous/Next | Chevron buttons; disabled at bounds |

### 2.17.3 Variants

| Variant | Use |
|---------|-----|
| `numbered` | Default for > 1000 rows or pageable contexts (TG-2A §20.5) |
| `load-more` | ≤ 1000 rows, append pattern ("Load more", button or in-view trigger) |
| `infinite` | Logs/streams — windowed virtual list (§50.3); never for sets with a known count that users paginate |

### 2.17.4 States

| State | Rules |
|-------|-------|
| Loading | Skeleton rows persist in place; pager dims but keeps position (§35) |
| Empty page | §32 empty state; pagination controls hide |
| At bounds | Previous/Next disabled; current page always visible |

### 2.17.5 Accessibility

Current page: `aria-current="page"`; pager is `<nav aria-label="Pagination">`; Previous/Next labeled; per-page selector is a labeled Select (§2.5); result count announced on navigation (`aria-live="polite"`).

### 2.17.6 UX Rules

| Rule | Detail |
|------|--------|
| **Position and context persist** | Page state survives filtering/sorting (filters reset to page 1 deliberately); a filter change returns to page 1 with a stated result count. |
| **Scroll behavior is defined** | Navigation may scroll to the table top (announced) or preserve scroll — pick per table and document it. |
| **Count is always honest** | "1,204 of 1,204" style summaries state the true total; never "displaying 50" without context. |
| **No dead pagination** | A set that fits one page shows no pager — pagination appears only when traversal exists. |

### 2.17.7 Usage

Device inventories, alert lists, audit logs, report result sets, KB search results.

### 2.17.8 Anti-Patterns

- Pagination that resets to page 1 on a sort (surprise).
- Hiding the result count.
- Infinite scroll for a numbered set (position loss).
- Per-page selector that resets per visit (persist it, §48.3 density-like preference).

---

## 2.18 Drawer

### 2.18.1 Purpose

A **slide-over surface** for context, tasks, or navigation that keeps the page visible beside it. **WHAT:** A panel (`elev-3`) that slides from an edge over the current page. **WHY:** Enterprise surfaces alternate between "browse the list" and "work one item"; a drawer holds the item's context or a focused task without losing the list (three-pane power layout, TG-2A §48.2).

### 2.18.2 Anatomy

```
┌──────────────┬──────────────────────────────────────┐
│   Page       │  ┌───────────────────────────────┐   │
│   (dimmed    │  │  Title (h3)            [×]    │   │  header 20px,
│    by scrim  │  │───────────────────────────────│   │   border-bottom
│    at 60%)   │  │  body scrolls internally      │   │  body 24px
│              │  │                               │   │
│              │  │                               │   │
│              │  ├───────────────────────────────┤   │
│              │  │  [Cancel]      [Primary]      │   │  footer, border-top
│              │  └───────────────────────────────┘   │
└──────────────┴──────────────────────────────────────┘
```

| Attribute | Standard |
|-----------|----------|
| Width | `sm` 400px (context), `md` 560px (task), `lg` 720px (report/edit), `stage` ≥ 90vw (remote session, `elev-4`) |
| Edge | Right = context/task (default); left = navigation drawer on mobile (§46.1); never top/bottom |
| Surface | `surface-panel` + `border-default` (left edge) + `shadow-lg`/`xl` |
| Scrim | 60% (dark) / 40% (light) graphite, `elev-3` rules (§12.3) |
| Motion | 300ms slide `motion-d4` (16px travel) from edge + scrim fade; exit 200ms; reduced → fade (§3.10) |
| Focus | Trapped in drawer on open; restored to trigger on close (§26.2) |

### 2.18.3 Variants

| Variant | Use |
|---------|-----|
| `context` | Detail beside a list (three-pane master-detail, §4.6) |
| `task` | Focused create/edit task (longer than a modal suits) |
| `nav` | Mobile navigation overlay (from left, ≥ 80% width) |
| `stage` | Remote-session / full focused workflow (`elev-4`, near full-screen) |

### 2.18.4 States

| State | Rules |
|-------|-------|
| Closed | Not rendered (no lingering DOM focus traps) |
| Opening | Scrim first (200ms), then panel slides (300ms); no content stagger on exit |
| Open | Page is non-interactive behind scrim; drawer scrolls internally; footer pinned |
| Dismiss | `Esc`, ×, scrim-click for non-destructive content only (§31.4); destructive tasks require explicit confirm |

### 2.18.5 Accessibility

Dialog semantics (`role="dialog"` + `aria-modal`), focus trap, focus return; the page behind is `aria-hidden` while open; heading hierarchy starts inside the drawer (H2/H3).

### 2.18.6 UX Rules

| Rule | Detail |
|------|--------|
| **Drawer ≠ Modal** | Modal = fully blocking focused task (§26). Drawer = page stays visible as context. Choose by whether the page context matters during the task. |
| **One drawer at a time** | A drawer may open *from* a drawer for a dependent confirm; two independent drawers is a failure (§26.3 stacking). |
| **State persists** | Opening a context drawer doesn't reset the list behind it; closing restores exact prior view. |
| **Scroll containment** | Body scrolls internally; the page never scrolls while a drawer is open. |
| **Width from scale** | Drawer widths come from the scale; never arbitrary vw values. |

### 2.18.7 Usage

Device detail context, edit/configuration task, notification center at depth, mobile nav, remote-session stage.

### 2.18.8 Anti-Patterns

- A drawer for a task that fits a modal (heavier than needed).
- Stacking drawers to arbitrary depth.
- Drawers that don't trap focus.
- Context drawers on mobile that cover the whole screen (they become modals/bottom sheets, §46).

---

## 2.19 Popover

### 2.19.1 Purpose

An **interactive floating panel** with its own content — controls, previews, quick forms — anchored to a trigger. **WHAT:** `elev-2` panel, optionally with title/footer/arrow. **WHY:** Inline editing, quick previews, and compact controls need more than a tooltip and less than a modal.

### 2.19.2 Anatomy

```
 ┌─────────────────────────┐
 │  Title             [×]  │   radius-md, surface-raised,
 │─────────────────────────│   border-strong, shadow-md
 │  interactive content    │   optional arrow pointing at trigger
 │  (controls, form)       │
 │─────────────────────────│
 │  [Cancel]  [Apply]      │   optional footer
 └─────────────────────────┘
   8px offset from trigger; flips to fit viewport
```

### 2.19.3 Popover vs Tooltip vs Dropdown — the decision table

| Need | Component |
|------|-----------|
| Identify/clarify, non-interactive | **Tooltip** (§28) |
| Menu of actions/options | **Dropdown** (§27) |
| Interactive content: controls, forms, previews | **Popover** (§2.19) |
| Blocking focused task | **Modal** (§26) / **Dialog** (§31) |

### 2.19.4 Variants

| Variant | Use |
|---------|-----|
| `standard` | Quick controls, inline edit, preview |
| `with-footer` | Apply/cancel confirmations within the popover |
| `hover-preview` | Hover reveals non-interactive preview; click reveals interactive content |

### 2.19.5 States

| State | Rules |
|-------|-------|
| Closed | Trigger shows standard affordance (chevron/ellipsis) |
| Open | Panel + scrim-less `elev-2`; focus moves into the panel (interactive content) |
| Dismiss | `Esc`, outside click, or apply/close |

### 2.19.6 UX Rules

| Rule | Detail |
|------|--------|
| **Focus enters on open** | Unlike tooltips, an interactive popover receives focus; keyboard users can operate its controls. |
| **Hover-preview is not hover-interact** | Interactive controls never open on hover alone; hover preview may exist, click/Enter opens the interactive version. |
| **Dismiss discipline** | `Esc` and outside-click close; a popover with a "Apply" button closes on apply. |
| **Positioning flips** | Anchors to trigger, flips to fit, arrow points at trigger (§27.3). |

### 2.19.7 Usage

Inline cell edit, quick status change, notification preview, annotation controls, quick filters.

### 2.19.8 Anti-Patterns

- Interactive content inside a tooltip (semantics + a11y breakage).
- A popover for a simple option list (that is a Dropdown).
- Popovers that must be dismissed by clicking a tiny × only.
- Nested popovers.

---

## 2.20 Progress

### 2.20.1 Purpose

Honest, quantifiable task completion. **WHAT:** A track and fill showing real progress toward a known end. **WHY:** Long jobs (backups, indexing, fleet actions) need a truthful time-and-completion statement — never fake progress (TG-2A §35.4).

### 2.20.2 Anatomy

```
 ┌──────────────────────────────────────────┐
 │  Backing up WKS-014          34 of 120    │  label + live count
 │  ██████████░░░░░░░░░░░░░░░    28%         │  4px track, radius-full,
 │                                          │   fill: action-primary
 └──────────────────────────────────────────┘
```

| Part | Standard |
|------|----------|
| Track | 4px tall (8px when standalone large), `surface-inset`, `radius-full` |
| Fill | `action-primary`; status colors only when progress *is* a status signal (a restore that's healthy/failed) |
| Label | Phase + live count (or %); percent only when it maps to real work (§35.4) |
| Motion | Fill eases 200–300ms per increment, then holds — no smooth "tween" that outruns real work |

### 2.20.3 Variants

| Variant | Use |
|---------|-----|
| `determinate` | Known total and unit (files, %, bytes) |
| `stepped` | Known phase count (jobs: 3 of 5 stages) |
| `indeterminate` | Bounded wait with unknown end (defers to spinner rules §35.3; use sparingly) |
| `inline` | Compact progress inside a table row or file list |

### 2.20.4 States

| State | Rules |
|-------|-------|
| Running | Fill advances on real events; label updates |
| Paused | Fill holds, label "Paused — resume"; never an indeterminate shimmer for paused |
| Complete | Fill 100%, state flips to the result (Go/neutral) — never an infinite "100% complete" hold |
| Error | §33 in-panel error + retry; progress is reset honestly, never "99% forever" |

### 2.20.5 Accessibility

`role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`; updates announced at meaningful milestones, not every tick; completion announced via `role="status"`.

### 2.20.6 UX Rules

| Rule | Detail |
|------|--------|
| **Honest mapping** | Percent reflects measured work. Fabricated 0→100 is a violation (§35.4). |
| **Label beats percent** | "Backing up — 34 of 120 files" is more honest than a bare percentage; use both. |
| **Long jobs degrade** | Long waits move to the job/notification surface (§35.2); progress is a foreground statement of a bounded wait, not a hostage screen. |
| **Time estimates are range-based** | If shown, an estimate is a range ("~2–4 min"), never false precision. |

### 2.20.7 Usage

Backup/restore jobs, report generation, bulk fleet actions, file uploads (§2.24), installation wizards.

### 2.20.8 Anti-Patterns

- Fake progress (indeterminate label with a fake bar).
- A progress bar that resolves to a silent failure.
- Full-screen progress for background work.
- "100%" held indefinitely while cleanup runs (state it: "Cleaning up…").

---

## 2.21 Stepper

### 2.21.1 Purpose

Sequential, multi-step flows with explicit position and progress (wizard pattern, §4.4). **WHAT:** A numbered step trail + step content + navigation. **WHY:** Setup, provisioning, and complex configuration are inherently ordered; users need to know where they are, what's left, and that they can go back.

### 2.21.2 Anatomy

```
  ●───○───○───○
  1   2   3   4           horizontal: complete = check in signal circle,
 Step: 1 of 4 — Device setup   current = filled number, upcoming = outline

 ●── ○
 │   ●  ─ vertical (mobile/side): connectors down the left
 ├── ○
```

| Part | Standard |
|------|----------|
| Step marker | 24px circle: complete = `action-primary` + check; current = filled + number; upcoming = outline `border-strong` + number |
| Connector | 2px line, `border-default`; complete segments turn `action-primary` (200ms) |
| Label | 13px under/right of marker; current `text-primary` 500; completed readable; upcoming `text-secondary` |
| Meta | "Step 1 of 4" + step title in the content header |
| Navigation | Back (ghost) + Next/primary; per-step validation before advance (§4.4) |

### 2.21.3 Variants

| Variant | Use |
|---------|-----|
| `horizontal` | Desktop, ≤ 5 steps |
| `vertical` | Mobile and side-rail wizards; long forms |
| `compact` | Collapsed to "Step 2 of 4 — Configuration" with a small progress segment (repeat visits) |
| `summary` | Review step (last step) showing all entered values with edit affordances |

### 2.21.4 States

| State | Rules |
|-------|-------|
| Complete | Check + `action-primary`; connector to next complete |
| Current | Filled number, bold label, content visible |
| Upcoming | Outline, `text-secondary`; **never disabled silently** — reachable via back always |
| Error | Step marker flips to `critical` + inline error on the step content; step is still revisitable |
| Optional | Marked "(optional)" on the label; marker unchanged |
| Saving | Advance button spinner (§17.4); inputs locked |

### 2.21.5 Accessibility

`role="list"` structure with labels; current step `aria-current="step"`; step content `aria-labelledby` its marker; `aria-live="polite"` announces step changes; keyboard complete (back/next focusable, `Enter`).

### 2.21.6 UX Rules

| Rule | Detail |
|------|--------|
| **Steps are ordered, not optional-in-order** | Stepper is for sequential flows. A step the user could complete in any order → Tabs (§2.15) or a plain form. |
| **Back is always safe** | Going back preserves entered values (draft state, §4.4); validation runs on advance, not on arrival. |
| **≤ 5–6 steps** | More steps need grouping ("Device → Identity → Security" as 3 steps, not 9). |
| **Review before commit** | Consequential wizards end in a summary step with edit-back affordances. |
| **Exit is guarded** | Leaving a wizard mid-flow asks to save/discard (§4.4); silent loss is forbidden. |

### 2.21.7 Usage

Device provisioning, tenant onboarding, report builder, backup configuration, compliance setup.

### 2.21.8 Anti-Patterns

- Stepper for a single-screen form (over-process).
- Tabs styling steps (implies any order).
- Steps the user can't go back from.
- A final "Done" step that celebrates (calm completion, §34.2).

---

## 2.22 Timeline

### 2.22.1 Purpose

A chronological record of events or workflow stages — the past, made scannable. **WHAT:** A vertical line of nodes with content and timestamps. **WHY:** Audit trails, incident timelines, and device event history must read as a story with a strict order and clear states.

### 2.22.2 Anatomy

```
 ●  14:02  Critical — CPU threshold exceeded        node: status-colored,
 │         Temp hit 94 °C on core 3                connector: graphite hairline
 ○  14:05  Warning — high memory pressure          status nodes use §5.5 colors,
 │         (icon + label, never color alone)
 ●  14:11  Resolved — cooling restored              zoomed entries: content + timestamp
```

| Part | Standard |
|------|----------|
| Node | 12px status dot or 20px status icon; color + icon + label (§5.6) |
| Connector | 2px `border-default` hairline between nodes |
| Content | Title 14px/500 + optional description + source; timestamp `text-meta` right or below |
| Order | Newest-first for feeds; top-down chronological for process recounts — stated consistently |

### 2.22.3 Variants

| Variant | Use |
|---------|-----|
| `feed` | Event stream (device events, activity) — newest first |
| `process` | Workflow stage recount (incident lifecycle) — strict order |
| `audit` | Audit trail — immutable, filterable, exportable |
| `compact` | Dense rows (log-like) with mono timestamps |

### 2.22.4 States

| State | Rules |
|-------|-------|
| Live | Newest event enters with the §44.4 update flash (≤ 2s), then settles |
| Loading | Skeleton nodes (§36), not a spinner |
| Empty | §32 in-panel empty state |
| Paused/filtered | A filtered timeline shows "3 of 40 events" + clear-filter affordance |

### 2.22.5 Accessibility

Ordered list semantics (`<ol>`/`<li>`); each item has an accessible label combining title + state + time ("CPU threshold exceeded, Critical, 14:02"); filters and live updates use `aria-live="polite"`.

### 2.22.6 UX Rules

| Rule | Detail |
|------|--------|
| **Status color discipline** | Critical nodes appear only for genuinely critical events (§5.6). |
| **Order is sacred** | Timelines never reorder silently; a reordering filter is explicit ("by severity"). |
| **Filters for volume** | Long histories filter by type/severity and virtualize (§50.3). |
| **Timestamps are local + zone** | Cross-timezone surfaces state the zone (§39.3). |

### 2.22.7 Usage

Incident timelines, device event history, audit trails, backup/restore history, update rollout logs.

### 2.22.8 Anti-Patterns

- A timeline for a comparison (use a table).
- Status color without icon/label (§41.4).
- Infinite nested timelines.
- Non-chronological default order.

---

## 2.23 Tree View

### 2.23.1 Purpose

Hierarchical navigation, selection, or organization — parent/child structures. **WHAT:** An indented, expandable list of nodes. **WHY:** Device groups, org structures, folder trees, and policy hierarchies are inherently nested; a flat list would lose the structure the enterprise relies on.

### 2.23.2 Anatomy

```
 ┌────────────────────────────────┐
 │ ▸  Production (12)             │  node: chevron (expand) or gap,
 │   ▸  Cluster A (5)             │  indent 16px per level,
 │   ▾  Cluster B (7)             │  36px rows, radius-sm,
 │       ● WKS-014   Healthy      │  icon + label + optional meta/status
 │       ▲ SRV-021   Warning      │
 └────────────────────────────────┘
```

| Part | Standard |
|------|----------|
| Node row | 36px, `radius-sm`, padding 8px; full-row selection target |
| Expand control | 16px chevron, rotates 90° (never icon swap); rows without children show a placeholder gap (alignment) |
| Indent | 16px per level; default expands to ≤ 3 levels deep before scroll |
| Selection | Single (default) or multi (checkbox on rows, §2.2); selected = `signal` tint + left indicator |

### 2.23.3 Variants

| Variant | Use |
|---------|-----|
| `navigation` | Expand to navigate (group hierarchy) |
| `selection` | Single/multi select for actions (bulk operations on a group subtree) |
| `organization` | Drag-to-reorder/move within the tree (drop affordance §53.2) |
| `lazy` | Load children on expand (large fleets) — with a row-level skeleton/spinner |

### 2.23.4 States

| State | Rules |
|-------|-------|
| Collapsed | Chevron right; children hidden (keep in DOM state, not visually) |
| Expanded | Chevron down; children revealed 150ms measured transform (§43.4) |
| Hover | Row `surface-inset` |
| Focus | Ring per §41.5; arrow keys navigate |
| Disabled | Nodes may be disabled with a reason (tooltip §28); never hide silently |
| Loading (lazy) | Row-level spinner or 2-row skeleton on expand |

### 2.23.5 Accessibility

`role="tree"` + `treeitem` semantics with `aria-expanded`, `aria-selected`, `aria-level`; arrow keys expand/collapse (`→`/`←`) and navigate; `Enter` selects; typeahead jumps to matching node. Large trees offer a flat search alternative (§2.7).

### 2.23.6 UX Rules

| Rule | Detail |
|------|--------|
| **Default depth is shallow** | Open to the first level by default; deep trees are lazy-loaded and searchable. |
| **Selection semantics are explicit** | Selecting a parent does *or* doesn't select descendants — stated per tree, never ambiguous. |
| **Indent is structure** | Indentation is 16px/level and never visually broken by long labels (truncate + tooltip). |
| **Drag is a bonus, not a requirement** | If drag-reorder exists, keyboard reorder (move up/down/indent) exists too (§41.5 parity). |
| **No tree-soup** | Trees for real hierarchies only; a flat list in a tree control is a failure. |

### 2.23.7 Usage

Device group hierarchy, org/tenant structure, backup folder browsing, policy trees, KB category trees.

### 2.23.8 Anti-Patterns

- Trees for flat lists.
- Unlimited nesting (structure failure beyond ~4 levels).
- Hover-only expand controls.
- A tree that reorders children alphabetically mid-session (instability).

---

## 2.24 File Upload

### 2.24.1 Purpose

Bring files into the product — scripts, configs, logs, images, backups. **WHAT:** A dropzone or attach control plus a file manifest with per-file state. **WHY:** Professional workflows upload evidence and artifacts; upload must be obvious, safe, and honest about progress and errors.

### 2.24.2 Anatomy

```
┌───────────────────────────────────────────────┐
│  Drag files here or [Browse…]                  │  2px dashed border (§1.6.3),
│  PNG, JSON, LOG — up to 50 MB                  │  surface-inset, radius-lg
└───────────────────────────────────────────────┘
 ┌─────────────────────────────────────────────┐
 │ ● config.json        1.2 MB    ██████░ 60%  │  manifest rows: name, size,
 │ ○ backup-014.zip     84 MB     ✓ Ready      │  progress/success/error, remove
 └─────────────────────────────────────────────┘
```

| Part | Standard |
|------|----------|
| Dropzone | Dashed `border-strong`, `surface-inset`, radius-lg; full area is the drop target |
| Actions | Drag + drop, `Browse…`, paste, and file dialog all work |
| Manifest | Row per file: name (+icon by type), size, per-file progress (§2.20 inline), success/error, remove |
| Limits | Declared up front (size, count, type, extension) — stated in the dropzone, not discovered on error |

### 2.24.3 Variants

| Variant | Use |
|---------|-----|
| `dropzone` | Standalone area (bulk/log/backup upload) |
| `attach` | Compact button/input (attach to a report, message, device) |
| `avatar-image` | Single-image crop-and-upload (§2.9) |

### 2.24.4 States

| State | Rules |
|-------|-------|
| Idle | Declared limits visible |
| Drag-over | Dropzone highlights: `border-ai`→ no, `border-focus` + `surface-raised` tint; cursor drop-ok |
| Uploading | Per-file progress; overall progress for batches |
| Success | ✓ + Go state per file (icon + label, §5.6) |
| Error | Per-file: reason ("File too large — max 50 MB"), `critical` + message; never silent skip |
| Too many / wrong type | Immediate validation error on the file, not a confusing silent rejection |

### 2.24.5 Accessibility

The dropzone is a real `<button>`/keyboard-accessible control (Enter/Space opens the dialog); drag-over affordances have keyboard parity; per-file status uses `role="status"`/`aria-live="polite"`; errors use `role="alert"`.

### 2.24.6 UX Rules

| Rule | Detail |
|------|--------|
| **Limits are visible before the attempt** | Size/type/count stated in the dropzone (§2.24.2) — no post-hoc "that's too big." |
| **Errors are per-file and explainable** | The error names the file and the exact rule violated, with a fix ("compress to under 50 MB"). |
| **Remove is always available** | Any file, in any state, can be removed; removal is instant with no confirm (reversible via re-select). |
| **Progress is real** | Upload progress maps to bytes; large files can run in the background with a toast on completion (§30). |
| **Security is disclosed** | Where uploads are scanned (malware/secret detection), the scanning state is visible ("Scanning…" → ✓). |

### 2.24.7 Usage

Script/config deployment, backup restore, log/evidence attachments, KB document imports, avatar images.

### 2.24.8 Anti-Patterns

- Dropzone that requires exact pixel positioning (whole-area target).
- Silent file rejection (no error row).
- Uploads that block the page (progress in the manifest, not a modal hostage).
- A dashed border on anything other than a dropzone (§1.6.3).

---

## 2.25 AI Response

### 2.25.1 Purpose

The complete, grounded AI answer surface — the product's honesty contract rendered as a component (extends TG-2A §40.3). **WHAT:** Header + streaming body + sources + confidence + footer + optional human-confirm CTA. **WHY:** AI output is the platform's most powerful and most dangerous surface; every answer must be identifiable as AI, sourced, and confidence-labeled by structure, not by luck (TG-2A §40.1).

### 2.25.2 Anatomy

```
┌────────────────────────────────────────────────────┐
│ ○ TechFusion Assist        [Copy] [Regenerate] [⋯] │  header: avatar + name + actions
├────────────────────────────────────────────────────┤
│  The device is likely overheating. GPU temp hit     │  body: prose, text-body-lg,
│  91 °C at 14:02, while the thermal threshold is     │   container-reading width,
│  90 °C.[1]                                          │   streaming reserve layout
│────────────────────────────────────────────────────│
│  Sources  [log-line] [sensor-read] [KB-214]  · 3    │  AI Sources (§2.28)
│  Confidence  ● High — 3 sources, 1 open item        │  AI Confidence (§2.27)
│────────────────────────────────────────────────────│
│  Anthropic · claude-* · 14:02            [👍][👎] │  footer: provider, model, time,
│  [Apply suggested fix]                              │   feedback, human-confirm CTA
└────────────────────────────────────────────────────┘
```

### 2.25.3 Variants

| Variant | Use |
|---------|-----|
| `chat` | Message in the AI chat surface (§4.13) |
| `inline` | AI answer embedded in a panel (dashboard insight, device analysis) |
| `card` | Standalone AI result (report summary, triage recommendation) |
| `compare` | Side-by-side model comparison (A/B) |

### 2.25.4 States

| State | Rules |
|-------|-------|
| Thinking | Phase labels, honestly named ("Reading logs…", §40.5) + §35 spinner |
| Streaming | Token-by-token with a reserved block (no layout jump); no bouncing dots (§40.7) |
| Complete | Answer + sources + confidence + CTA |
| No grounding | Explicit "I couldn't verify this — here's what's known" block (§40.4) |
| Error | §33 pattern + retry; provider never silently fails (§40.5) |
| Regenerating | Keep old answer visible with a "Regenerating…" meta until replacement arrives (never blank) |
| Exporting | "Preparing export…" with §2.20 inline progress |

### 2.25.5 Accessibility

The block is announced once as AI-generated (`aria-label`/role at block level, not per line — §41.6); streaming content is not read per token (announce completion); citations and sources are focusable links; copy/regenerate are labeled buttons.

### 2.25.6 UX Rules

| Rule | Detail |
|------|--------|
| **AI identity is structural** | Optic avatar + "TechFusion Assist" header on every response — never styling-dependent recognition. |
| **Streaming is steady** | Text reveals at a calm, even pace; no word-by-word bounce, no typewriter theater (§40.7). |
| **Grounding is non-negotiable** | Sources (§2.28) + confidence (§2.27) ship with every answer; zero sources states it explicitly. |
| **Human-confirm is reserved** | Consequential suggestions render the confirm CTA (§40.4); the AI never auto-applies. |
| **Regenerate keeps context** | Regeneration re-runs with the same conversation context and replaces content in place. |

### 2.25.7 Usage

Device analysis, alert triage, report summaries, root-cause suggestions, policy recommendations.

### 2.25.8 Anti-Patterns

- AI responses that look like ordinary product text (identity must be structural).
- Answers without sources or confidence.
- Auto-applying suggested fixes without confirmation.
- Fake typing theater or idle AI avatars.

---

## 2.26 AI Citation

### 2.26.1 Purpose

The **inline** evidence marker within AI prose — the verifiable interface at sentence level (extends TG-2A §40.4). **WHAT:** A small superscript index `[1]` after a claim, linking to the AI Sources list (§2.28). **WHY:** Professionals must be able to walk from a claim to its evidence in one action — "every claim is tappable to its source" (TG-2A §3.2).

### 2.26.2 Anatomy

```
  …the thermal threshold is 90 °C.¹

  superscript [1], 11px, optic text, superscripted,
  focused: 2px ring; hover: underline + slight emphasis
```

| Part | Standard |
|------|--------|
| Form | `[n]` superscript, `text-caption` size (11px), `optic-600/500` text |
| Placement | Immediately after the claim it supports; numbering matches the Sources list order (§2.28) |
| Behavior | Tappable/click → opens the source's evidence (preview/panel per §40.4); keyboard-focusable |
| Count | A claim carries 1–3 citations; more collapse into the source list |

### 2.26.3 Variants

| Variant | Use |
|---------|-----|
| `inline` | Within prose (default) |
| `grouped` | One citation marker covering a sentence/paragraph with multiple sources |

### 2.26.4 States

| State | Rules |
|-------|-------|
| Default | Superscript optic number, subtle |
| Hover | Underline + emphasis (preview may appear on hover) |
| Focus | Ring per §41.5 |
| Open | Source preview/panel open; `Esc` closes |

### 2.26.5 Accessibility

Citations are links to the source evidence; they are focusable and announced as "Source 1: log-line"; the source list is reachable via keyboard. Citation markers never rely on color alone.

### 2.26.6 UX Rules

| Rule | Detail |
|------|--------|
| **Every factual claim cites** | Numbers, causes, statuses get an inline citation; general phrasing and clearly-marked AI reasoning need not. |
| **Numbers match the list** | Inline `[1]` always equals source #1 in §2.28 — a mismatch is a defect. |
| **Never fabricate** | A citation points to a real, opened evidence item; unverifiable claims say so instead (§40.4). |
| **No citation chains** | `[1][2][3]` after every sentence is noise; group by claim. |

### 2.26.7 Usage

Device diagnosis prose, report AI summaries, risk explanations, KB answers.

### 2.26.8 Anti-Patterns

- Citations that don't open anything.
- Citations on every word (spam).
- Citation numbering that doesn't match the source list.
- Non-focusable citation markers.

---

## 2.27 AI Confidence

### 2.27.1 Purpose

An honest statement of how certain the answer is — in plain language, not theater (extends TG-2A §40.4). **WHAT:** A compact line combining a confidence level with the evidence basis. **WHY:** A confident-sounding wrong answer is damage (TG-1A §5); users must calibrate trust from the answer's own statement of certainty.

### 2.27.2 Anatomy

```
 Confidence  ● High — 3 sources, 1 open item

 label "Confidence"  +  optic mark/level  +  evidence basis
```

| Part | Standard |
|------|--------|
| Level | `High` / `Medium` / `Low` / `Unverified` — plain words, never a bare percentage |
| Evidence basis | Count and nature: "3 sources, 1 open item", "conflicting readings" |
| Visual | Neutral/optic identity — **never** Go/Caution/Critical status colors (§5.6); confidence is not status |
| Alignment | Below the body, left-aligned with sources (§2.25.2) |

### 2.27.3 Variants

| Variant | Use |
|---------|-----|
| `line` | In an answer block (default) |
| `inline` | Compact form in a card footer or tooltip |
| `computing` | "Determining confidence…" while sources are gathered |

### 2.27.4 States

| State | Rules |
|-------|-------|
| Computing | Meta text + subtle progress; no fake percentage |
| Computed | Level + basis |
| Unverifiable | Explicit "Couldn't verify" framing per §40.4 — never a silent default of "High" |

### 2.27.5 Accessibility

Read as plain text; the level is announced with the answer ("Confidence: High, based on 3 sources"). Screen readers get the same words the sighted user sees — no icon-only confidence.

### 2.27.6 UX Rules

| Rule | Detail |
|------|--------|
| **Words over numbers** | "High — 3 sources" beats "87%" — percentages imply precision the model doesn't own (§40.4). |
| **Level maps to evidence** | High = consistent, multiple sources; Medium = partial; Low = conflicting/limited; Unverified = none. |
| **Never status-colored** | Confidence is not health; Go/Caution/Critical are for systems (§5.5). |
| **Deterministic mapping** | The level is derived from evidence rules (source count, agreement), never hand-tuned per response. |

### 2.27.7 Usage

Every AI answer (§2.25), AI suggestions, root-cause statements, compliance findings.

### 2.27.8 Anti-Patterns

- A green "High confidence" that reads like a system health state.
- Confidence without its evidence basis.
- A universal "High" default.
- Confidence hidden in an expander (it belongs with the answer).

---

## 2.28 AI Sources

### 2.28.1 Purpose

The evidence list under an AI answer — grounding made visible and actionable (extends TG-2A §40.6). **WHAT:** Source chips + a full list; each item opens the actual evidence. **WHY:** "Grounded by default" (TG-2A §2) means the sources are not decoration — they are the answer's proof, one tap from the claim.

### 2.28.2 Anatomy

```
 Sources  [log-line] [sensor-read] [KB-214]  · 3 sources ▾

 ┌────────────────────────────────────────┐
 │ log-line · 14:02:13 · core-3-temp.log   │  expanded list: type glyph,
 │ "Temp 94 °C exceeded threshold"         │   name, snippet, open →
 │────────────────────────────────────────│
 │ sensor-read · CPU thermal sensor        │   click → evidence panel (§40.4)
 └────────────────────────────────────────┘
```

| Part | Standard |
|------|--------|
| Chip form | `radius-full`, 24px, optic 1.5px border + ≤ 12% optic tint (§40.6) |
| Chip content | Type glyph + short name: `log-line` `sensor-read` `kb-214` `vendor-advisory` |
| Count | 1–3 chips shown; "· N sources" expands the full list (max ~6 shown) |
| Item anatomy | Type + name + snippet (1–2 lines) + open affordance |
| Evidence | Clicking opens the real evidence (log line, sensor graph, KB article) in context — the verifiable interface (§3.2) |

### 2.28.3 Variants

| Variant | Use |
|---------|-----|
| `chips` | Compact summary under an answer (default) |
| `list` | Full list panel (for "N sources" expander or a sources tab) |
| `compact` | Single-line "Sources: 3" with chips in tooltip/preview |

### 2.28.4 States

| State | Rules |
|-------|-------|
| Empty | Zero sources → the answer states it (§40.4); no empty chip row |
| Loading | Skeleton chips (3 bars) while grounding resolves |
| Error | Source failed to load → item shows §33 pattern with retry, never a fake link |
| Open | Evidence panel/preview open; `Esc` closes |

### 2.28.5 Accessibility

Chips are links with accessible names ("Source: log-line"); the list is real content read by screen readers; open affordances are focusable; snippets are selectable text.

### 2.28.6 UX Rules

| Rule | Detail |
|------|--------|
| **Every chip opens evidence** | A source chip with nothing behind it is a defect (§40.4). |
| **Order by relevance** | Sources rank by contribution to the answer; the most-load-bearing first. |
| **Honest counts** | "3 sources" counts real, distinct evidence items; duplicates are merged. |
| **No source theater** | Sources must actually support the claim — decorative citation is fabrication-adjacent. |

### 2.28.7 Usage

Every AI answer block (§2.25), AI chat messages (§4.13), dashboard AI insights, compliance findings.

### 2.28.8 Anti-Patterns

- Chips that don't open evidence.
- Fake or reused sources across unrelated answers.
- Ten sources listed with no priority (noise).
- Sources that vanish behind a tiny expander with no count.

---

## 2.29 Dashboard Widgets

### 2.29.1 Purpose

The dashboard's modular data unit — one question, one widget (extends TG-2A §38). **WHAT:** A self-contained tile with a defined data question, rendered from the widget registry. **WHY:** Dashboards are the instrument panel (TG-2A §38.1); widgets are its gauges — modular, honest, and bound to the ~9-panel discipline.

### 2.29.2 Anatomy

```
┌───────────────────────────────┐
│ Fleet health          [⋯] [↻] │  header: title + menu + refresh
│                               │
│   94%  Healthy                 │  hero number (28px tabular) + delta
│   ▲ +2 vs. yesterday          │
│                               │
│  ▁▂▃▅▆▅▂▂   (sparkline)        │  optional sparkline (§37.2)
│  updated 14:02 · 12s ago       │  footer: freshness (§39.4)
└───────────────────────────────┘
```

| Part | Standard |
|------|----------|
| Frame | `surface-raised`, `border-default`, radius-lg, elev-1 (§19 card frame) |
| Header | Title (h4) + optional overflow menu + optional refresh control |
| Hero | Stat pattern per §38.4 (28px/600 tabular, contextual delta) |
| Footer | Data freshness: "updated 14:02 · 12s ago" — never silent staleness (§39.4) |
| Sizing | Grid cells on the 8pt grid; standard 1×1 stat, 2×1 chart; resize within the canonical grid |

### 2.29.3 Widget types (registry)

| Widget | Question it answers | Uses |
|--------|--------------------|------|
| `stat` | One number and its trend | §38.4 stat card |
| `chart` | Trend / comparison / distribution | §37 chart types |
| `list` | Recent items | Alerts, events, devices (≤ 6 rows + "View all") |
| `status` | State of a system | Health summary, connectivity |
| `alert` | Things needing attention | Critical/caution list, severity-aware |
| `ai-summary` | AI's grounded read of a dashboard | AI Response inline variant (§2.25), with sources |
| `gauge` | One metric vs threshold | Health score, capacity |
| `composite` | Stat + sparkline + list (bounded) | Rich fleet tiles |

### 2.29.4 Widget states

| State | Rules |
|-------|-------|
| Loading | Skeleton block matching final shape (§36) — never a spinner or blank |
| Empty | §32 in-widget empty state (a widget with no data states why) |
| Error | §33 in-widget error + retry |
| Stale | "data as of 14:02" + Caution meta (§39.4); live never silently freezes |
| Editing | Arrange/resize mode: handles on focus, ghost during drag, `signal` outline for drop zone (§53.2) |

### 2.29.5 Accessibility

Each widget is a real heading + content region; live updates announce via `aria-live="polite"` sparingly (§41.6); charts within widgets carry chart accessibility (§2.30.6); refresh controls are labeled buttons.

### 2.29.6 UX Rules

| Rule | Detail |
|------|--------|
| **One question per widget** | A widget that mixes two questions is split (TG-2A §19.4 one-story rule applied to widgets). |
| **The ~9-panel cap holds** | More widgets means subdivision, not scroll (TG-2A §38.5). |
| **Every widget links out** | Each widget links to its full module view — a widget with no drill-down is a dead gauge. |
| **Customization is bounded** | Users arrange and resize within the canonical grid (§38.5); no free-form canvas. |
| **Honest freshness everywhere** | Every widget footer states data age; the dashboard never presents stale as live. |

### 2.29.7 Usage

Fleet health, alert summary, capacity, device status, AI insights, backup status, compliance posture.

### 2.29.8 Anti-Patterns

- 20 live widgets on one screen (TG-2A §38.6).
- Widgets that don't link to detail.
- Empty widgets shown as blank tiles.
- Widgets with per-widget visual styles (one surface language, §3.3).

---

## 2.30 Charts — Extension

### 2.30.1 Purpose

This section **extends** TG-2A §37 (chart types, rules, color, states) with the enterprise chart standards §37 does not cover: toolbar, comparison, annotations, accessibility, and tooltip anatomy.

### 2.30.2 Chart toolbar

| Element | Standard |
|---------|----------|
| Title + unit | Always (§37.3) |
| Range control | Quick ranges ("1h/24h/7d/30d") + custom (§2.8); the active range is always visible |
| Live toggle | "Live" on/off; off = timestamped snapshot (§37.3) |
| Compare | "Compare to previous period" toggle; comparison series render `graphite` dashed (§37.4) |
| Export | PNG / CSV; PNG for inclusion in reports (§4.9), CSV for data truth |
| Density | Chart gridlines and labels respect the density setting (§1.12.5) |

### 2.30.3 Chart tooltip anatomy

| Attribute | Standard |
|-----------|----------|
| Surface | `surface-raised`, `border-strong`, `shadow-md`, radius-md (elev-2) |
| Content | Series color/dash swatch + label + value with unit (§39.3 precision) + timestamp |
| Delay | 200ms hover delay; appears on focus for keyboard (§2.30.6) |
| Behavior | Single tooltip per chart; follows nearest point; never overlaps the primary signal |

### 2.30.4 Comparison and annotations

| Feature | Standard |
|---------|----------|
| Threshold line | 1.5px dashed `critical`/`caution` line + edge label; only for genuine thresholds (§37.4 status discipline) |
| Event marker | Small neutral marker on the x-axis (incident, change) with tooltip; never status-colored unless the event is status |
| Compare mode | Primary series `signal` solid; previous period `graphite` dashed; legend always on |
| Zoom/drill | Click-drag zoom on time charts with a "Reset" affordance; never cumulative zoom confusion |

### 2.30.5 Chart states (full list, extends §37.5)

| State | Treatment |
|-------|-----------|
| Loading | Skeleton card (§36) |
| Empty | §32 in-panel empty state |
| No data in range | "No readings in this window" + range stated (§37.5) |
| Error | §33 + retry |
| Paused snapshot | "as of 14:02" label (§39.4) |
| Offline | Last-known values, clearly labeled last-known (§33, §4.21) |

### 2.30.6 Chart accessibility

| Rule | Detail |
|------|--------|
| `role="img"` + accessible name | Chart title + summary of the key reading ("CPU utilization rose to 94% at 14:02") |
| Data table alternative | A real data table (visible or in an expandable/collapsible region) for all chart data (§39.5) |
| Keyboard | Focusable chart; arrow-key point navigation; tooltip shows on focus with the same anatomy as hover |
| Colorblind safety | §37.4 categorical palette + line-style/marker redundancy; never color alone |
| Reduced motion | No draw-in animation; instant render (§3.15) |

### 2.30.7 Small-multiple charts

- Reserved for comparing the same metric across categories (per-device utilization); each cell repeats the same axis/scale.
- Cells are labeled; the shared legend appears once.
- Never for a single series; never more than ~6 cells before "see table."

### 2.30.8 Anti-Patterns (extensions to §37.6)

- Tooltips that cover the primary signal.
- Comparison series that reuse the primary series color.
- Event markers that imply causation without annotation.
- Chart-only data with no table alternative (§39.5).

---

# PART 3 — MOTION SYSTEM

---

## 3.1 Animation Philosophy

### 3.1.1 The philosophy

> **Motion is the system breathing (TG-2A §42): quick, calm, purposeful, honest. TG-2A established the laws, the duration scale, the easing curves, the distance scale, and the transition table. This part extends those foundations into a complete choreography — the motion system teams implement from, surface by surface.**

### 3.1.2 What TG-2A established (binding)

| Foundation | Reference |
|------------|-----------|
| Six motion laws | TG-2A §42.2 |
| Duration tokens `motion-80…400` | TG-2A §43.1 |
| Easing tokens `ease-*` | TG-2A §43.2 |
| Distance tokens `motion-d1…d4` | TG-2A §43.3 |
| Property rules (what may animate) | TG-2A §43.4 |
| Transition table per component | TG-2A §44.2 |
| Reduced-motion baseline | TG-2A §41.7 |

### 3.1.3 What this part adds

The **choreography**: timing scale and sequencing (§3.2–§3.3), per-gesture motion for hover/focus/loading (§3.5–§3.7), surface transitions (page, modal, drawer, toast, §3.8–§3.11), domain motion (AI, dashboard, skeleton, §3.12–§3.14), the reduced-motion contract (§3.15), and motion performance (§3.16).

### 3.1.4 The motion decision (one question)

Before any animation, ask: **Does this help the user understand a state change, direction, or cause→effect?** If no, remove it. If yes, pick its duration, easing, and distance from the tokens — never invent them (§42.2).

---

## 3.2 Timing Scale

### 3.2.1 What

The **perceptual classes** that decide which duration token applies. Duration is chosen by *job*, not by taste.

| Class | Duration | Job | Examples |
|-------|----------|-----|----------|
| `timing-instant` | 0–80ms | Feedback that must feel simultaneous | Press states, focus appearance, checkbox fill start |
| `timing-micro` | `motion-80` (80ms) | Sub-attention state changes | Icon swap, copy-check, hover tint |
| `timing-fast` | `motion-150` (150ms) | Common interactive transitions | Toggle, menu open, row selection, value starts |
| `timing-standard` | `motion-200` (200ms) | The default for reveals and changes | Menus, tooltips, list reorder, value settle |
| `timing-panel` | `motion-300` (300ms) | Structural surface changes | Modals, drawers, expanded sections, command palette |
| `timing-max` | `motion-400` (400ms) | Full-scene changes, absolute maximum | Page transitions, full-screen state changes |

### 3.2.2 Sequencing rules (when things move)

| Rule | Detail |
|------|--------|
| **Enter order is fixed** | Overlays: scrim first (fade 200ms), then panel (300ms), then content settle (no separate content stagger on entry except defined reveals). |
| **Exit is faster and reversed** | Exit is the reverse path at ≤ enter duration (§44.3); content disappears before the panel slides. |
| **Stagger is tokenized** | 40–60ms per item (`motion-stagger-40/60`), max 6 items, total ≤ 300ms (§1.10.5). Lists and skeletons only. |
| **Delays are explicit** | `motion-delay-100/200` for secondary/tertiary elements (§1.10.5); never hand-timed `setTimeout` choreography. |
| **The primary signal moves first** | In any multi-part change, the element carrying the primary information updates first; chrome follows. |

### 3.2.3 When NOT to use

Hand-timed sequences, per-feature duration choices, staggered reveals on critical content (nothing essential animates into existence — §42.2 law 5).

---

## 3.3 Duration Scale

### 3.3.1 What

The token durations, already defined in TG-2A §43.1 and consolidated in §1.10.2 (`motion-80` through `motion-400`). This section adds the **duration decision rules**.

| Decision | Rule |
|----------|------|
| **Duration follows distance and size** | Larger movement = longer duration; a modal (12px + scrim) is 300ms, a tooltip (4px) is 80ms (§43.3). |
| **Exit ≤ enter** | Leaving is always at least as fast as arriving (§44.3). |
| **Density compresses time** | Compact density shortens durations ~25% (150→110ms), a persisted preference (§44.3). |
| **Nothing exceeds 400ms** | If a transition "needs" more time, the layout is wrong, not the animation (§43.1). |
| **Interruptible** | Any transition cancels cleanly on reverse action; no ghosting (§44.3). |

### 3.3.2 The duration look-up (quick reference)

| Motion | Enter | Exit |
|--------|-------|------|
| Button hover/press | 80–150ms | — |
| Focus ring | 80ms (or instant) | — |
| Menu/dropdown/popover | 150ms, d2 (8px) | 120ms fade |
| Tooltip | 80ms, d1 (4px) | 80ms fade |
| Modal/dialog | 200–300ms, d3 (12px) + scale 0.98→1 | 150ms fade |
| Drawer | 300ms, d4 (16px) | 200ms slide-back |
| Toast | 200ms, d3 up (12px) | 150ms down-out |
| Page | 300–400ms cross-fade + 8px | 200ms |
| Expanded section | 200–300ms measured transform | 150ms |
| Value change | 200ms tabulated ease | — |
| Chart draw-in | 300ms stroke/bar grow | — |
| Skeleton shimmer | 1.6s linear sweep | — |

---

## 3.4 Easing Curves

### 3.4.1 What

The four approved curves (TG-2A §43.2), with their **behavioral contract**:

| Token | Curve | Behavior contract |
|-------|-------|-------------------|
| `ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Symmetric, neutral; the default for every transition not otherwise specified |
| `ease-signal` | `cubic-bezier(0.16, 1, 0.3, 1)` | Fast start, calm settle — big entrances (modals, pages); reads deliberate, not decorative |
| `ease-exit` | `cubic-bezier(0.7, 0, 0.84, 0)` | Accelerating departure; exits feel decisive and brief |
| `ease-linear` | `linear` | Constant rate — opacity fades, shimmer sweeps, spinner rotation; never for positional settles |

### 3.4.2 Easing rules

| Rule | Detail |
|------|--------|
| **No bounce, ever** | Springs, overshoot, and elastic are forbidden in every context (§43.2). |
| **The same behavior, the same curve** | A modal entering in one screen uses the same curve as in every other screen. |
| **Entry and exit are different curves** | Enter uses `ease-signal`/`standard`; exit uses `ease-exit` — faster and accelerating. |
| **Linear is a special tool** | Continuous/opacity-only motion; never for the "landing" of a position change. |

### 3.4.3 When NOT to use

Custom per-feature curves, bounce/elastic, slower-than-entry exits, `ease-signal` on trivial 80ms micro feedback (over-production).

---

## 3.5 Hover Motion

### 3.5.1 The philosophy

> **Hover is a whisper: it confirms the element is alive without performing. On a precision instrument, a hovering control brightens, it does not dance.**

### 3.5.2 Hover standards by element

| Element | Hover treatment | Motion |
|---------|-----------------|--------|
| Button (primary) | One step brighter (`action-hover`); optional `shadow-xs` (no lift) | 150ms bg/color `ease-standard` |
| Button (secondary/ghost) | `surface-inset` tint | 150ms bg |
| Interactive card | One shadow step (`xs→sm`) + `-1px` translateY lift | 150ms transform + shadow |
| Row (table/list) | `surface-inset` tint | 150ms bg |
| Row action (revealed on hover) | Appears via 80ms fade + 4px slide-in | 80ms |
| Link | Color shift + underline (running text always underlined) | 80ms color |
| Chip | Border `border-strong`; removable × brightens | 150ms |
| Nav item | Tint + text emphasis; active state never on hover | 150ms |
| Switch/checkbox | Track/box brighten; thumb **never** moves on hover | 150ms |

### 3.5.3 Hover rules

| Rule | Detail |
|------|--------|
| **One property, one job** | Hover animates the thing being hovered — never a whole card for a row hover (§53.3). |
| **No scale on hover** | Scale-on-hover is forbidden (§44.2); the interactive-card lift is translate only, 1px. |
| **Shadow is one step, token-sized** | Hover lift uses one shadow step and the token scale (§11.3). |
| **Hover ≠ active** | Press (active) is darker/faster (80ms); hover is brighter/slower (150ms). |
| **Focus parity** | Anything hover-revealed is focus-revealed (§28.3). |
| **No hover on touch** | Touch devices have no hover; the reveal alternatives (persistent affordances) apply (§28.3, §46). |

### 3.5.4 When NOT to use

Hover scale/bounce, hover animation on non-interactive content, hover shadows in tables/lists (§50.4), hover that hides primary content (hover-reveal is for *secondary* affordances only).

---

## 3.6 Focus Motion

### 3.6.1 The philosophy

> **Focus is a state of readiness, not a performance. Focus indicators appear fast and stay put — a focus ring that "animates in slowly" makes the keyboard feel laggy, and a laggy keyboard is a broken instrument.**

### 3.6.2 Focus standards

| Element | Focus motion |
|---------|--------------|
| Focus ring appearance | Instant or 80ms fade — never a slow draw |
| Focus ring geometry | 2px ring, `signal-600/300`, 2px offset (§41.5) |
| Focus *movement* (menus, palette, tabs) | 80ms indicator slide/fade to the focused item |
| Focus restoration (modal close) | Instant — focus returns to the trigger before any exit motion completes |
| Focused-row scroll-into-view | 200ms measured scroll; never an abrupt jump in menus |

### 3.6.3 Focus rules

| Rule | Detail |
|------|--------|
| **Focus is never obscured by motion** | An entering overlay completes focus transfer *before* or exactly as its motion finishes — no moment where the keyboard is aimless. |
| **Rings don't animate** | The ring itself appears immediately; only its *position* may slide (80ms) when focus moves between adjacent items. |
| **Reduced motion** | Focus transitions become instant (§3.15). |
| **No focus theater** | No pulsing rings, no animated halos, no color cycling. |

### 3.6.4 When NOT to use

Animated focus halos, delayed focus appearance, focus indicators that rely on motion to be seen (they must be visible in the static frame).

---

## 3.7 Loading Motion

### 3.7.1 The philosophy

> **Loading motion states time honestly (TG-2A §35). It has three voices — skeleton for first paint, spinner for in-flight actions, progress for bounded jobs — and each voice has its own, quiet choreography.**

### 3.7.2 The loading choreography

| Phase | Voice | Motion |
|-------|-------|--------|
| First paint (> 150ms fetch) | Skeleton (§3.14) | 1.6s shimmer sweep, linear |
| In-flight action | Spinner | 1.1s/rotation, linear, 16–20px (§35.3) |
| Bounded job | Progress bar (§2.20) | Fill eases 200–300ms per real increment, then holds |
| Long/queued | Phase label + spinner | Phase text swaps 150ms; label stays steady |
| Background sync | Muted status | No motion — a static meta line (§35.2) |
| Arrival of data | Content reveal | 200ms fade-in after skeleton; ≤ 300ms total with stagger |

### 3.7.3 Loading rules

| Rule | Detail |
|------|--------|
| **No ambiguous spinners** | An indeterminate spinner that can run forever is a lie; cap waits and degrade to an honest error/offline state (§35.4). |
| **No fake progress** | Bars map to measured work; never fabricated 0→100 (§2.20.6). |
| **Layout never jumps** | Loading states reserve final dimensions (§50.2) — the skeleton is the faceplate, not a guess. |
| **Reduced motion** | Spinner → static ring or ≥ 2s pulse; shimmer → static blocks (§41.7). |
| **Exit-to-content is calm** | Skeleton → content cross-fades 200ms; it never "snaps" or "flashes." |

### 3.7.4 When NOT to use

A spinner for first paint (skeleton belongs), a skeleton for in-flight actions (§35.2), full-screen loading for background work, animated "thinking dots" theater (§40.7).

---

## 3.8 Page Transition

### 3.8.1 The philosophy

> **A page change is a scene change on the same instrument — the frame stays, the content breathes.**

### 3.8.2 The page transition

| Element | Motion |
|---------|--------|
| Frame (header, sidebar) | **No motion** — the chrome is stable (§8.3, §44.3) |
| Incoming content | 300–400ms cross-fade + 8px rise (`ease-signal`, `motion-d2`) |
| Outgoing content | 200ms cross-fade (`ease-exit`) |
| Scroll position | Restored to the top (or the anchor target) *before* the transition completes |
| Route transition budget | ≤ 100ms render; ≤ 400ms total with motion (§50.2) |

### 3.8.3 Rules

| Rule | Detail |
|------|--------|
| **Content only** | The frame never transitions on navigation; only the content region does (§44.3). |
| **Skeleton-first** | Slow routes render the shell + skeleton (§36), then content settles into place — the transition is from skeleton to data, not blank to data. |
| **No full-page spin** | There is no logo spin, no wipe, no cinematic page "reveal." |
| **Reduced motion** | Page changes become instant cross-fade (or none) — information is never carried by the transition (§3.15). |
| **Nested transitions** | A page opening with an expanded section uses the section's 200–300ms reveal, not a second page transition. |

### 3.8.4 When NOT to use

Transitioning the frame, animated route progress bars as a norm (a quiet top progress line is permitted only for genuinely slow routes), parallax or sliding chrome.

---

## 3.9 Modal Transition

### 3.9.1 The philosophy

> **A modal is the instrument held up to the eye: it arrives from below the attention, settles, and leaves faster than it came.**

### 3.9.2 The modal choreography (extends TG-2A §26.2)

| Step | Motion |
|------|--------|
| Scrim | Fades in 200ms (`ease-linear`, opacity) |
| Panel | 200–300ms fade + 12px rise (`motion-d3`) + scale 0.98→1 (`ease-signal`) |
| Content | Arrives with the panel; no separate content delay |
| Focus | Moves into the modal as the panel settles (§3.6.2) |
| Exit | 150ms fade (`ease-exit`); scrim fades with the panel |

### 3.9.3 Rules

| Rule | Detail |
|------|--------|
| **Scrim first, always** | The dim arrives before the panel — the page never visibly "floats above" an undimmed scrim. |
| **One entrance, one curve** | `ease-signal` for the panel; the scale factor is fixed at 0.98→1 (§44.2). |
| **No shake, no pulse** | Confirmation dialogs never shake or flash, even for destructive content (§31.2). |
| **Exit is quick and honest** | The panel leaves in 150ms; users are never waiting to click the trigger again. |
| **Reduced motion** | Modal opens close to instantly (fade only, ≤ 80ms) (§3.15). |

### 3.9.4 When NOT to use

Slide-in-from-edge for a modal (that is a Drawer, §3.10), springy overshoot, per-modal custom choreography.

---

## 3.10 Drawer Transition

### 3.10.1 The philosophy

> **A drawer is the page's partner: it slides from the edge it belongs to and returns the same way — directional, connected, and never theatrical.**

### 3.10.2 The drawer choreography (extends §2.18.2)

| Step | Motion |
|------|--------|
| Scrim | Fade 200ms (`ease-linear`) |
| Panel | 300ms slide `motion-d4` (16px) from its edge (`ease-signal`); right drawer slides right→left into view |
| Content | Travels with the panel; no independent content stagger |
| Exit | 200ms slide-back toward the edge (`ease-exit`) + scrim fade |

### 3.10.3 Rules

| Rule | Detail |
|------|--------|
| **Direction is semantic** | Right drawers slide from the right; navigation drawers slide from the left (§46.1); never arbitrary. |
| **Full travel = d4** | The panel travels the full token distance (16px) — it is the maximum motion in the system (§43.3). |
| **Edge alignment** | The drawer's far edge stays off-canvas; the visible portion is a panel, not a peeled layer. |
| **Exit mirrors entry** | Exit reverses the exact path and is faster (§3.2.2). |
| **Reduced motion** | Fade only, ≤ 80ms, or instant (§3.15). |

### 3.10.4 When NOT to use

Sliding a drawer in for a modal's job (blocking task → modal), cross-fading a drawer (loses direction), drawers that slide from the top/bottom (that's a bottom sheet on mobile, §46.5).

---

## 3.11 Toast Motion

### 3.11.1 The philosophy

> **A toast is a quiet nod: it appears where it belongs, stacks without jostling, and leaves before it becomes furniture.**

### 3.11.2 The toast choreography (extends TG-2A §30.2)

| Step | Motion |
|------|--------|
| Enter | 200ms fade + 12px rise (`motion-d3`, `ease-signal`) at the defined placement (bottom-right desktop / top mobile) |
| Stack | A new toast pushes the stack down 200ms measured transform — toasts never overlap (§30.2) |
| Hover | Timer pauses; the toast holds position (no motion while hovered) |
| Auto-dismiss | Exit 150ms fade down-out (`ease-exit`); the remaining stack closes the gap 200ms |
| Supersede | A same-type toast is replaced in place (150ms cross-fade) per §30.4 |

### 3.11.3 Rules

| Rule | Detail |
|------|--------|
| **Placement is fixed** | Bottom-right desktop, top full-width-minus-16px mobile (§30.2) — never drifting. |
| **Stack is animated, never absolute** | Pushing the stack uses measured transform; a new toast never overlays an existing one. |
| **Errors persist** | Error toasts stay until dismissed (§30.2); they do not auto-leave mid-sentence. |
| **Exit is faster** | 150ms vs 200ms enter; exit animates toward the edge it will disappear from. |
| **Reduced motion** | Toasts fade in/out (or appear) with no translation (§3.15). |

### 3.11.4 When NOT to use

Toast as the only feedback for a destructive action (§30.4 needs a dialog), toasts that animate their placement every time a new one arrives (reflow churn), bounce/spring entries.

---

## 3.12 AI Motion

### 3.12.1 The philosophy

> **AI motion is the system thinking out loud — calm, visible, and honest. Nothing about AI motion performs; it explains. The most dangerous thing an AI surface can do is move like magic.**

### 3.12.2 The AI choreography (extends §40, §2.25)

| Moment | Motion |
|--------|--------|
| Thinking | Phase label swaps ("Reading logs…" → "Checking KB…") 150ms; §35 spinner alongside; no bouncing dots (§40.7) |
| Streaming | Text reveals at a steady pace into a reserved block — no layout jump, no per-word bounce (§2.25.6) |
| Streaming cursor | A 2px block caret that breathes at ≤ 3Hz opacity (never faster — §43.6) and disappears on completion |
| Sources arrival | Source chips appear staggered 40ms each, max 300ms total (§1.10.5), from the Optic accent |
| Confidence | Settles after sources, 150ms fade-in, aligned left |
| Completion | A quiet, one-time settle — no "done" animation, no checkmark theater |
| Regenerate | Old content holds with a "Regenerating…" meta until the replacement begins (§2.25.4) |

### 3.12.3 Rules

| Rule | Detail |
|------|--------|
| **No typing theater** | No animated "typing" dots, no avatar bounce, no magical sparkles (§40.7). |
| **Layout is reserved** | The answer block's dimensions are reserved before streaming so text never reflows the page (§2.25.4). |
| **Identity is static** | The AI avatar is motionless (§40.2); the Optic mark never animates by default. |
| **Uncertainty is calm** | Low-confidence answers render with neutral styling — no warning-colored motion (§40.4). |
| **Reduced motion** | Streaming resolves instantly; sources fade (or appear) without stagger (§3.15). |

### 3.12.4 When NOT to use

"Thinking" dots, confetti on answers, avatar animations, streaming that types character-by-character with visible keypress rhythm, any motion faster than the reading pace.

---

## 3.13 Dashboard Motion

### 3.13.1 The philosophy

> **The dashboard is the instrument face: numbers move only when the world changes, and they move like instrument needles — fast to the new value, then still.**

### 3.13.2 The dashboard choreography (extends §38, §2.29)

| Moment | Motion |
|--------|--------|
| Value update | 200ms tabulated ease into the new figure (§44.4) + one-time tint flash (≤ 1.5s; Go for improvement, Caution for regression) |
| New row/event | Row enters 200ms + ≤ 2s highlight, then settles (§44.4) |
| Reorder | Panels/widgets move along the grid path 200ms transform; drop zone `signal` outline 1.5px (§53.2) |
| Live refresh | "Updating…" 13px meta fades in 150ms; values replace on arrival — no page flash |
| Widget enter (first paint) | Skeleton → content cross-fade 200ms (staggered ≤ 6 widgets, 40–60ms) |
| Data age tick | Freshness label updates in place, 150ms — never a blinking "LIVE" badge |

### 3.13.3 Rules

| Rule | Detail |
|------|--------|
| **Values settle fast** | A live number eases 200ms and holds — it never "breathes" while idle. |
| **No persistent motion** | No auto-scrolling feeds, no flashing alerts, no pulsing gauges (§43.5). |
| **Throttle renders** | Live charts batch/decimate to ≤ 1 render/sec and pause offscreen (§50.3). |
| **Position stability** | Rows and widgets never jump without animation; reordering animates the path (§44.4). |
| **Reduced motion** | Values replace instantly; no tint flash; panel reorder is instant (§3.15). |

### 3.13.4 When NOT to use

Idle animation on any widget, marquee tickers, animated backgrounds, gauges that spin on load, celebratory deltas (confetti on a good day, §34.2).

---

## 3.14 Skeleton Motion

### 3.14.1 The philosophy

> **The skeleton is the faceplate waiting for its readings: still shapes, a quiet sweep, nothing strobing (extends TG-2A §36).**

### 3.14.2 The skeleton choreography

| Attribute | Standard |
|-----------|----------|
| Sweep | 1.6s linear shimmer, 60% width, ≤ 12% luminance delta (§36.2) |
| Stagger | Multi-block skeletons reveal 40–60ms per block, ≤ 300ms total (§3.2.2) |
| Exit | Skeleton → content 200ms cross-fade; never "skeleton flash then empty" (§36.3) |
| Reduced motion | Static blocks, no sweep (§41.7) |
| Compact density | Static blocks (no sweep) in compact mode (§50.4) |

### 3.14.3 Rules

| Rule | Detail |
|------|--------|
| **Mirror the real layout** | Skeleton dimensions match final content; a misaligned skeleton is worse than none (§36.3). |
| **Only for real loads** | Skeletons appear when content is genuinely fetching (> 150ms) (§36.3). |
| **Sweep is subtle** | The shimmer reads as a luminance change, never a light beam or strobe. |
| **Exit on data or error** | The skeleton resolves to content or the error state — never to nothing (§36.3). |

### 3.14.4 When NOT to use

Shimmer over 150ms waits only, shimmer under reduced motion/compact, skeletons for empty surfaces (§36.3), animated skeletons that shift layout as content arrives.

---

## 3.15 Reduced Motion Rules

### 3.15.1 The philosophy

> **Reduced motion is a first-class state, not a courtesy (TG-2A §41.7). The system guarantees: removing motion removes no information. Every animation in this document has a defined reduced-motion substitute.**

### 3.15.2 The reduced-motion contract

| Motion | Reduced substitute |
|--------|--------------------|
| Hover tint/lift | Instant color change; no transform |
| Focus ring/indicator | Instant |
| Menu/dropdown/popover/tooltip | Opacity-only (≤ 80ms) or instant |
| Modal/dialog | Fade ≤ 80ms or instant |
| Drawer | Fade ≤ 80ms or instant (direction not conveyed by motion) |
| Toast | Fade in/out ≤ 80ms |
| Page transition | Instant cross-fade or none |
| Value update | Instant replace (no ease, no tint) |
| Skeleton | Static blocks, no sweep |
| Spinner | Static ring or ≥ 2s pulse (§41.7) |
| AI streaming | Answer resolves as a block (no per-token reveal) |
| Chart draw-in | Instant render |
| Stagger | All items appear together |

### 3.15.3 Rules

| Rule | Detail |
|------|--------|
| **OS preference + user override** | `prefers-reduced-motion` is honored, and a manual "Reduce motion" setting overrides it (persisted per user, §41.7). |
| **Information is never motion-carried** | No semantic difference between animated and reduced states — proven by the table above. |
| **No exceptions** | Charts, dashboards, AI, and marketing surfaces all honor reduced motion (§41.7). |
| **Implementation is token-driven** | `motion-pref-reduced` tokens gate all motion; features never re-implement the decision (§1.15.2). |

### 3.15.4 When NOT to use

A "reduced-motion-off" escape hatch for delight, motion that carries information, violating the ≤ 3Hz strobing rule in any state (§43.6).

---

## 3.16 Performance Guidelines

### 3.16.1 The philosophy

> **Motion is free only when it is invisible to the frame meter. Every transition must hit 60fps on a mid-range device — a janky animation is a lie about the speed of the system (§50).**

### 3.16.2 Motion performance rules

| Rule | Detail |
|------|--------|
| **Compositor-only properties** | Animate `opacity` and `transform` only; never layout properties (§43.4, §50.3). |
| **No bulk `backdrop-filter`** | Blur only on the one open overlay (§12.3); never on many cards. |
| **`will-change` is a promise** | Applied during animation, removed after; never sprayed on idle elements (§50.3). |
| **Shadow animation is capped** | Shadow transitions only on hover of a single element (§50.4); never in lists. |
| **Strobing floor** | Nothing flashes faster than 3Hz — a seizure-safety rule, not a style rule (§43.6). |
| **Batching** | Live updates batch to ≤ 1 render/sec for charts; DOM writes batch with `requestAnimationFrame` (§50.3). |
| **Interruption** | Transitions cancel on reverse input — no orphaned `transitionend` chains (§44.3). |
| **Reduced battery on mobile** | The mobile budget is tighter: no idle motion, no backdrop blur, reduced-light shimmer (§50.4). |

### 3.16.3 Motion budget summary (extends §50.2)

| Metric | Budget |
|--------|--------|
| Animation frame | 60fps during every 80–400ms transition |
| Route transition | ≤ 400ms total with motion; ≤ 100ms render |
| Live chart updates | ≤ 1 render/sec, paused offscreen |
| Stagger total | ≤ 300ms (6 items max) |
| Strobe floor | < 3Hz, always |

### 3.16.4 When NOT to use

Layout-animating properties, unbounded shimmer/blur, animations that fight the frame budget, motion on idle elements.

---

# PART 4 — ENTERPRISE UX PATTERNS

---

## 4.0 Pattern Introduction

### 4.0.1 The philosophy

> **A pattern is a page-sized application of the components — the instrument assembled into a working panel. TG-2A specified the parts (§32–§40 foundations); this part specifies the pages: their anatomy, their rules, and their failure modes.**

### 4.0.2 Pattern anatomy standard

Every pattern below follows the same four-part contract: **WHAT** (the pattern's job), **WHY** (the professional need it serves), **WHEN** (to use it), and **WHEN NOT** (to use something else). Patterns compose components; they never invent new ones (§55.2).

### 4.0.3 Where the pattern lives

Patterns are implemented as page templates in `@techfusion/ui` and consumed by screens. A screen that diverges from its pattern is a defect (§16.4).

---

## 4.1 Authentication

### 4.1.1 Purpose

**WHAT:** The entry surfaces — sign in, sign up, password reset, two-factor, SSO, and session-expiry. **WHY:** Authentication is the first trust moment (TG-1A §17); it must be calm, fast, and honest, and it must never look like the product is selling or celebrating.

### 4.1.2 Anatomy

```
┌──────────────────────────────────┬─────────────────────────────┐
│  Brand panel (left, desktop)     │  Form (right, ≤ 480px)      │
│  • Instrument-surface visual     │  • Logo mark (mobile top)    │
│  • One-line promise              │  • H1 action ("Sign in")     │
│  • Quiet, no text under 60%      │  • Fields + primary CTA      │
│    scrim                         │  • Links (reset, SSO)        │
└──────────────────────────────────┴─────────────────────────────┘
```

| Element | Standard |
|---------|----------|
| Layout | Split on desktop (brand left, form right); full-screen single-column form on mobile |
| Form width | ≤ 480px, single column, one primary CTA |
| Brand panel | Instrument-surface composition (TG-1A §13); real imagery only (§15); never "futuristic" |
| Actions | Sign in (primary), SSO (secondary), "Forgot password" (link) |
| Feedback | Inline field errors (§25.4) + a calm form-level error banner (§33); submitting = button spinner (§17.4) |
| Session | Session-expiry warning (never silent destruction of state, §41.8); re-auth inline |

### 4.1.3 Rules

| Rule | Detail |
|------|--------|
| **Calm, not celebratory** | No confetti on sign-up, no gamified progress, no hype copy (§34.2, TG-1A §24). |
| **First action is sign-in** | Returning users default to sign in; sign-up is a clear alternative, never the hero. |
| **Errors are actionable** | "We couldn't find an account with that email." beats "Invalid credentials" — without revealing which field was wrong (security). |
| **SSO is first-class** | Where SSO exists it renders as a primary route (tenant discovery), not a footnote. |
| **2FA is a step, not a maze** | One focused step; backup codes and recovery reachable; never a dead end. |
| **Security UX** | Password reveal toggle, `autocomplete` correctness (§18.4), masked by default, "cap lock" hint where applicable. |

### 4.1.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Sign in/up/reset/2FA/SSO surfaces | Feature advertisement on the auth screen |
| Calm completion → the default dashboard | Onboarding "tour" auto-playing at sign-in |
| Session warning + safe re-auth | Silent logout that destroys the user's session state |

---

## 4.2 Dashboard

### 4.2.1 Purpose

**WHAT:** The instrument panel — five-second state of the world, with drill-down (TG-2A §38). **WHY:** Professionals must know in five seconds whether anything is wrong, what changed, and where to act (§38.2).

### 4.2.2 Anatomy (extends TG-2A §38.3)

| Region | Content |
|--------|---------|
| Page header | H1 + description + primary action (right) |
| Summary band | 3–5 stat widgets (§2.29) — health, risk, alerts, online, pending |
| Primary panel | The module's main signal (fleet chart, alert list, network map) |
| Secondary panels | Related context (recent alerts, top risks, AI summary widget) |
| Footer strip | Data freshness, agent status, generation timestamp (§38.5) |
| Optional global range | A shared time-range control that the chart widgets honor (§2.30.2) |

### 4.2.3 Rules

| Rule | Detail |
|------|--------|
| **One focus** | One primary question per dashboard (§38.5); mixed agendas are subdivision, not dashboard. |
| **Widget discipline** | Max ~9 major widgets (§38.5); every widget links out (§2.29.6). |
| **Customization is bounded** | Arrange/resize within the canonical grid (§2.29.6); edit mode is explicit and calm. |
| **Honest freshness** | Every widget states data age; stale never masquerades as live (§39.4, §2.29.6). |
| **AI insights are widgets, not popups** | AI summaries render as AI Response inline widgets (§2.25) with sources + confidence — never auto-opened popups (§40.7). |
| **Empty-fleet honesty** | A tenant with no devices shows the §32 onboarding state, not a wall of zeros (§38.5). |

### 4.2.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Five-second summary + drill-down for every module | The dashboard as the only view (every panel links to its module, §38.6) |
| Bounded, persisted customization | Free-form canvas chaos |

---

## 4.3 Settings

### 4.3.1 Purpose

**WHAT:** The configuration surface — account, tenant, modules, security, notifications, billing, and admin. **WHY:** Settings are where trust is configured (SSO, retention, permissions); they must be findable, safe, and honest about save state.

### 4.3.2 Anatomy

```
┌──────────────┬──────────────────────────────────────────┐
│  Sub-nav      │  Panel:  [Title + description]           │
│  Account      │  ────────────────────────────────        │
│  Security     │   Field group (labels + inputs)          │
│  Notifications│   [Save changes]          ─────────────  │
│  Billing      │                                          │
│  ...          │  Destructive zone (separated, bottom)    │
└──────────────┴──────────────────────────────────────────┘
```

| Element | Standard |
|---------|----------|
| Structure | Left sub-nav (or vertical tabs §2.15) + panels; search within settings (§2.7) |
| Save model | **Preference toggles apply instantly** (Switch, §2.4); **critical config saves explicitly** (primary "Save changes"); both are stated per panel |
| Destructive zone | The bottom, visually separated panel; destructive actions require the confirm dialog (§31) |
| Permissions | Restricted items visible but disabled with a reason ("Locked — plan limit", §33); never hidden silently |
| Unsaved changes | Guard on leave with save/discard; draft preservation (§4.8) |

### 4.3.3 Rules

| Rule | Detail |
|------|--------|
| **Save state is always visible** | "Unsaved changes" / "Saving…" / "Saved" are explicit; autosave is announced, never silent (§52.4). |
| **One save vocabulary per panel** | A panel uses either instant-apply switches *or* explicit Save — mixing them in one panel confuses the contract (§2.2.6). |
| **Searchable** | Settings search surfaces panels and fields; results navigate directly (§2.7). |
| **Consequential settings confirm** | SSO enable, retention reduction, and tenant changes use confirmation or staged validation (§31). |
| **Danger is far from save** | Destructive actions never sit beside the primary Save without separation (§17.5). |
| **Changes are auditable** | Enterprise settings changes land in the audit trail (§4.16) with actor + timestamp. |

### 4.3.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Panels + explicit save for config | Settings buried behind a wizard every time |
| Instant switches for preferences | A Save button that does nothing until a page reload |
| Searchable settings | Settings as one giant scrolling form |

---

## 4.4 Wizard

### 4.4.1 Purpose

**WHAT:** A sequential, multi-step flow using the Stepper (§2.21) that carries the user from start to a committed result. **WHY:** Provisioning, onboarding, and complex configuration are inherently ordered; a wizard makes the order explicit and prevents half-configured states.

### 4.4.2 Anatomy

| Element | Standard |
|---------|----------|
| Stepper | Horizontal (desktop ≤ 5 steps) or vertical (mobile); §2.21 anatomy |
| Step content | One concern per step; fields grouped; per-step validation on advance |
| Navigation | Back (ghost, always) + Next/primary; final step = commit verb ("Provision devices") |
| Review step | Summary of all entered values with edit-back affordances for consequential flows (§2.21.3) |
| Exit guard | Leaving mid-flow asks to save a draft, discard, or continue — never silent loss |

### 4.4.3 Rules

| Rule | Detail |
|------|--------|
| **Minimal steps** | 3–5 steps; more means grouping (§2.21.6). A single-screen form is not a wizard. |
| **Progress is honest** | Stepper position + "Step 2 of 4" always visible; no fake completion (§2.21). |
| **Back preserves state** | Going back never loses entered values; drafts persist (§2.21.6). |
| **Validation on advance** | Validate a step when the user tries to leave it — never validate on arrival (§25.4). |
| **Commit is explicit** | The final action states the consequence ("Provision 12 devices"); confirm dialog where irreversible (§31). |
| **Completion is calm** | §34 completion view: result + next step; no celebration (§34.3). |

### 4.4.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Provisioning, onboarding, multi-step configuration | A form that fits one screen |
| Genuinely ordered tasks | Steps the user could do in any order (use Tabs/panels) |
| Review-before-commit for consequential flows | Wizards that hide the total cost of the action until the last step |

---

## 4.5 Search

### 4.5.1 Purpose

**WHAT:** The global search experience — command palette results and the dedicated search surface. **WHY:** Professionals search before they browse; search is a primary navigation verb (§2.7).

### 4.5.2 Anatomy (global search results)

```
 ⌕  "backup"
 ┌──────────────────────────────────────────────┐
 │ Actions                                      │  grouped results with
 │   Run backup on WKS-014                      │  eyebrow labels (§21.5)
 │ Devices                                      │
 │   WKS-014 · Healthy      ●                   │  type icon + name + meta
 │   SRV-021 · Caution      ▲                   │  + match highlight
 │ Reports                                     │
 │   Backup verification report (Jul 30)        │
 │ Knowledge base                               │
 │   "Backup retention best practices"          │
 │  No matches for "xyz" → suggestions          │  empty grammar (§32)
 └──────────────────────────────────────────────┘
```

### 4.5.3 Rules

| Rule | Detail |
|------|--------|
| **Grouped results** | Actions, Devices, Alerts, Reports, KB — never one undifferentiated list (§21.5). |
| **Keyboard-first** | Full keyboard navigation; `/` focuses; `↑↓` move; `Enter` opens (§21.2). |
| **Highlight matches** | Matching text is emphasized so relevance is explainable (§2.7.6). |
| **Previews for heavy results** | Device/report results preview key data inline; drill-down opens the object. |
| **Empty is a suggestion** | "No matches" + suggestions + clear-filter — never a dead end (§32). |
| **Recent + saved searches** | Recent searches on idle focus; saved searches for recurring work (both clearable). |
| **Scoped where right** | Field search stays in its panel (§2.7.6); global search is explicit about scope. |

### 4.5.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Global palette for navigation + field search for filtering | Search replacing the sidebar (navigation is sidebar, §21) |
| Search-in-settings for config | Search results that can't be reached by keyboard |

---

## 4.6 Tables

### 4.6.1 Purpose

**WHAT:** The data-grid pattern — the instrument's readout, extended to the page level with toolbar, master-detail, and editing (extends TG-2A §20). **WHY:** Inventories, alerts, and logs are the product's core data surfaces; the table pattern standardizes their surrounding machinery.

### 4.6.2 Anatomy (page-level)

```
┌──────────────────────────────────────────────────────────────┐
│ Page header: title + description + primary action            │
├──────────────────────────────────────────────────────────────┤
│ Toolbar: [filters §4.7] [⌕ search] [columns] [density] [export] │
├──────────────────────────────────────────────────────────────┤
│ Table (§20): header row, sortable columns, status patterns,  │
│   selection checkbox column, row actions                     │
├──────────────────────────────────────────────────────────────┤
│ Pagination (§2.17): count summary + pager + per-page         │
└──────────────────────────────────────────────────────────────┘
```

### 4.6.3 Master-detail (three-pane, §48.2)

| Pane | Content |
|------|---------|
| Master | List/table of items (left) |
| Detail | Selected item in a context Drawer (§2.18) or detail pane |
| Context | AI/related content beside the detail |

Rules: selection in master drives detail; the detail is URL-addressable; back/forward preserve both panes; the master's position persists when returning.

### 4.6.4 Inline editing

| Rule | Detail |
|------|--------|
| Editable cells show an affordance (pencil on hover/focus) | Never edit-on-click silently |
| Inline edit saves on blur/Enter, cancels on `Esc` | With an "Editing…" state and honest rollback (§52.4) |
| Bulk edit applies to selection only, confirmed | §31 where destructive |

### 4.6.5 Rules

| Rule | Detail |
|------|--------|
| **Toolbar mirrors content** | Filters, search, columns, and export all reflect the table's real data — no dead controls. |
| **Sorting is stable** | Default sort documented; re-sorting keeps selection and position sensible (§2.17.6). |
| **Status pattern is fixed** | Icon + label + color (§5.6); never color-alone. |
| **Selection is visible** | Checkbox column + floating bulk-action bar when selection > 0 (§20.4). |
| **Density is global** | Comfortable/Compact is a product preference (§48.3), never per-table. |
| **Every state defined** | Loading (skeleton), empty (§32), error (§33), stale (§39.4), pagination (§2.17). |

### 4.6.6 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Tabular data with shared columns | Card grids for comparable data (tables sort, §20.6) |
| Master-detail for high-volume browsing | Master-detail on mobile (mobile uses card-tables, §46.4) |
| Inline edit for small, reversible fields | Inline edit for irreversible/confusing fields (modal or dialog) |

---

## 4.7 Filters

### 4.7.1 Purpose

**WHAT:** The filter machinery — filter bar, facet panels, saved filters, and their combination with search. **WHY:** Large result sets (devices, alerts, logs) are unusable without precise narrowing; filters are how professionals ask the data questions.

### 4.7.2 Anatomy

```
 Toolbar:
 [All devices] [Status: Warning] [Environment: Prod] [Owner: ops]  [+ Filter]
   ───────────────────────────── 3 active filters · [Clear all]
 Filter panel (popover §2.19):
   Status    [✓ Go] [✓ Warning] [ ] Critical [ ] Offline     facet checkboxes
   Range     [Last 24h ▾]                                     range select
   Owner     [ ⌕ searchable combobox §2.6 ]                    combobox
   [Apply]  [Reset]
```

### 4.7.3 Rules

| Rule | Detail |
|------|--------|
| **Active filters are visible chips** | Applied filters render as removable Chips (§2.11) with a count and "Clear all" (§2.11.2). |
| **URL-addressable** | Filters live in the URL — shareable, bookmarkable, back/forward-safe. |
| **Combined with search** | Search narrows within filters; both are visible and independently clearable. |
| **Facets are honest** | Facet counts reflect the current result set; "0" options are disabled, never misleading. |
| **Debounced application** | Filter-as-you-type debounces ≤ 300ms; explicit Apply for heavy facets (§2.7). |
| **Saved filters** | Recurring filters save with a name; saved filters appear as chips/quick access (bounded list). |
| **Empty state explains** | Zero results: "No devices match your filters" + Clear filters (§32.4). |
| **Density-aware** | Filter bars respect the density setting and never overflow into scroll traps. |

### 4.7.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Facet + chip filtering on tables/lists | Filters that re-query on every keystroke without debounce |
| Saved filters for recurring triage | Filter bars on single-screen content that doesn't need narrowing |
| Status filters with the fixed vocabulary | Invented filter semantics per screen (§56.3) |

---

## 4.8 Forms

### 4.8.1 Purpose

**WHAT:** The structured data-entry surface, extended to the page level with long-form handling, autosave, and conditional fields (extends TG-2A §25). **WHY:** Forms are the most failure-prone surface (§25.1); the pattern standardizes how long, conditional, and draftable forms behave.

### 4.8.2 Anatomy (page-level)

| Element | Standard |
|---------|----------|
| Structure | Panels per concern (§2.13), H2/H3 titles, description ≤ 2 lines (§25.2) |
| Column rhythm | 12-col grid; single ≤ 600px, two 600–1000px, three only in advanced settings (§25.2) |
| Long forms | Grouped panels + sticky footer actions ("Save" always reachable, §46.2) |
| Conditional fields | Shown/hidden by parent value with a 200ms reveal; never disabled-flicker on load |
| Drafts | Save-as-draft affordance for consequential forms; drafts restored on return |

### 4.8.3 Autosave and drafts

| Rule | Detail |
|------|--------|
| Autosave applies to preference-like content; explicit Save for critical config (§4.3) |
| Autosave shows state: "Saving…" → "Saved" meta; failures roll back honestly (§52.4) |
| Drafts are versioned per user and labeled with their timestamp — never silently overwritten |
| Unsaved changes trigger a leave guard (save / discard / stay) — never silent loss |

### 4.8.4 Validation and feedback (extends §25.4)

| Rule | Detail |
|------|--------|
| Blur/submit validation, not per keystroke (§18.4) |
| Inline per-field errors + form-level banner for systemic failures (§25.4) |
| Errors preserve input and state; navigating back restores the form (§33.4) |
| Success is quiet: inline or toast (§34.2), never celebratory |

### 4.8.5 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Labeled, grouped, single-primary-action forms | Modal-per-field forms |
| Drafts + leave guards for consequential forms | Silent autosave that destroys drafts |
| Conditional fields that make the form simpler | Conditional fields that hide required configuration |

---

## 4.9 Reports

### 4.9.1 Purpose

**WHAT:** The reporting surface — report list, builder, viewer, scheduling, and export. **WHY:** Client-ready reporting is a core brand promise (TG-1A §4); reports must be honest, branded, and exportable with identical visual language to the product.

### 4.9.2 Anatomy

```
Report list:
  [New report]  · search · saved filters §4.7
  Card grid (§19) or table: title, status, schedule, owner, last generated

Report viewer:
  Header: title · date/range · [Export ▾] [Edit] [⋯]
  Sections: metric summary (§38.4) → tables (§20) → charts (§37/§2.30)
  Footer: generated-by · data sources · generation timestamp · disclaimer
```

| Element | Standard |
|---------|----------|
| Builder | Wizard (§4.4): scope → metrics → layout → schedule |
| Viewer | Print-ready; sections as panels; tables/charts identical to live product (§38.5) |
| Schedule | Time/range + delivery (email/webhook); scheduled runs notify via §30/§29; schedule UI per §2.8 |
| Export | PDF (print-ready), CSV/JSON (data truth); export naming is human-readable |
| Footer honesty | "Generated by TechFusion · data as of 2026-07-31 14:00 · sources: …" — never implied freshness |

### 4.9.3 Rules

| Rule | Detail |
|------|--------|
| **Numbers are sacred** | Reports quote real figures with units and precision per §39.3; fabricated data is a brand violation (TG-1A §14). |
| **Export == view** | The PDF reflects exactly what the viewer shows — no print-only redesign surprises. |
| **Schedules are visible** | Scheduled reports show their cadence and last/next run; failures notify (§29). |
| **Branding is calm** | Report covers follow TG-1B (logo/mark); the design system never invents report chrome. |
| **AI in reports is grounded** | AI summaries in reports carry sources + confidence (§2.25); a report AI claim without grounding is a defect. |

### 4.9.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Client-ready, exportable reporting | Reports that re-generate silently with stale data |
| Grounded AI summaries | AI-written report numbers without sources |
| Scheduled delivery with honest state | Schedules hidden in the builder |

---

## 4.10 Analytics

### 4.10.1 Purpose

**WHAT:** The exploration surface for trends, comparisons, and distributions — analytics dashboards and their controls. **WHY:** Professionals compare periods, spot anomalies, and prove performance; analytics must make comparison honest and drill-down fast.

### 4.10.2 Anatomy

| Element | Standard |
|---------|----------|
| Header | Title + range control (§2.8) + compare toggle (§2.30.2) + export |
| Trend area | Primary time-series chart(s) with the comparison period dashed (§2.30.4) |
| Breakdowns | Small-multiple charts (§2.30.7), bar rankings (§37.2) |
| Metric cards | Stat widgets with contextual deltas (§38.4) — direction is contextual, never "green = good" (§38.4) |
| Anomaly markers | Neutral event markers + AI insight widget with grounding (§2.30.4, §2.25) |
| Table duality | Every chart has a data-table alternative (§39.5, §2.30.6) |

### 4.10.3 Rules

| Rule | Detail |
|------|--------|
| **Comparison is explicit** | The comparison period is labeled ("vs. previous 30 days"); truncated axes are disclosed (§37.3). |
| **Anomalies are evidence-linked** | AI anomaly notes cite the readings (§2.26); speculation is labeled as such. |
| **Drill-down is preserved** | Clicking a point/segment carries the range + filter context into the detail. |
| **Precision discipline** | §39.3 precision rules apply in tooltips and tables; no false precision. |

### 4.10.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Period comparisons with explicit baselines | Comparisons against unstated baselines |
| Chart + table duality | Chart-only analytics with no data access |

---

## 4.11 Notifications

### 4.11.1 Purpose

**WHAT:** The notification center as a full pattern — panel, filters, preferences, and delivery parity (extends TG-2A §29). **WHY:** Notifications are the record of what happened; the pattern completes the center's machinery (filters, preferences, quiet hours).

### 4.11.2 Anatomy (extends TG-2A §29.2)

| Element | Standard |
|---------|----------|
| Access | Header bell + severity-aware count badge (§2.10) |
| Panel | 400px `elev-2` panel; grouped by day; item = status icon + message + source + relative time (§29.2) |
| Filters | All / Unread / Alerts tabs or chips; search within notifications |
| Bulk actions | "Mark all read" (only for a fully seen list); "Clear" with confirm (§31) for old items |
| Preferences | Which event classes notify (in-app/email/webhook); quiet hours; per-module toggles (§2.4) |
| Delivery parity | Push/email/webhook carry the same copy and severity language (§29.3) |
| Empty | Calm: "No notifications." — no illustration, no celebration (§29.2) |

### 4.11.3 Rules

| Rule | Detail |
|------|--------|
| **Every item is a link** | Each notification navigates to its context (§29.3) — an unactionable alert is noise. |
| **Severity honesty** | Severity follows §5.6; Critical is genuinely critical only. |
| **Batching** | Bursts batch ("12 devices went offline") with one expandable item (§29.3). |
| **Retention is stated** | Notifications persist per plan (30/90 days); the record is never silently truncated. |
| **Preferences are respected** | Quiet hours and per-class toggles are honored immediately (§4.3 instant switches). |

### 4.11.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Persistent alerts/events with a record | Transient confirmations (use toasts, §30) |
| A filterable, preference-driven center | Notification for every minor change (noise) |

---

## 4.12 Monitoring

### 4.12.1 Purpose

**WHAT:** The live-observation surfaces — monitoring consoles, live dashboards, real-time device views, alert streams. **WHY:** Continuous observation is the product's core (TG-1A §1); monitoring UI must be live-honest and readable under pressure.

### 4.12.2 Anatomy

| Element | Standard |
|---------|----------|
| Live strip | Real-time tiles: CPU, memory, temp, status — stat widgets with live flashes (§3.13) |
| Primary chart | Live time-series with "Live" indicator; pause → timestamped snapshot (§37.3) |
| Alert stream | Timeline (§2.22) or alert list with severity; acknowledgment and mute (§31 for consequential) |
| Thresholds | Configured in settings (§4.3); threshold lines on charts (§2.30.4) |
| Freshness | Every live surface states data age; staleness is never silent (§39.4) |

### 4.12.3 Rules

| Rule | Detail |
|------|--------|
| **Live is a claim** | "Live" is shown only when the data is actually streaming; paused/offline states are explicit (§39.4). |
| **Calm critical** | Critical conditions place calmly with icon + label (§5.6) — no flashing, no siren motion (§43.7). |
| **Values settle** | Live numbers ease 200ms and hold; no idle breathing (§3.13.3). |
| **Acknowledge/mute is reversible** | Acknowledgment is reversible with a record; muting is a preference (§4.3), not a silent state. |
| **Escalation is honest** | Escalation paths (to whom, when) are configured and visible, not implied. |
| **Last-known is labeled** | Offline devices render last-known values labeled last-known (§39.4, §4.21). |

### 4.12.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Live consoles with honest freshness | Fake "live" on stale data |
| Acknowledge/mute with audit trail | Silent auto-muting of alerts |

---

## 4.13 AI Chat

### 4.13.1 Purpose

**WHAT:** The conversational AI surface — a message thread with grounded assistant responses (extends TG-2A §40). **WHY:** AI chat is where the platform's intelligence is conversed with; every message must carry the grounding contract structurally (§2.25).

### 4.13.2 Anatomy

```
┌──────────────────────────────────────────────┐
│ TechFusion Assist          [context] [⋯]     │  header: AI identity + session context
│──────────────────────────────────────────────│
│ (user)  Why is WKS-014 overheating?          │  user message, right, neutral
│                                              │
│ (ai)    ○ Based on the logs, the GPU hit     │  assistant: AI Response block (§2.25)
│         91 °C at 14:02…[1]                   │   body + citations
│         Sources  [log-line] [sensor-read]    │   sources + confidence (§2.27–§2.28)
│         Confidence  ● High — 3 sources       │
│──────────────────────────────────────────────│
│  ⌕ Ask about devices, alerts, reports… [↗]   │  composer: input + send + attach
│  Suggested: Analyze WKS-014  ·  Today's alerts│   + model/context selector
└──────────────────────────────────────────────┘
```

### 4.13.3 Rules

| Rule | Detail |
|------|--------|
| **Grounded by structure** | Every assistant message is an AI Response block (§2.25) — sources + confidence ship with the message, not as an option. |
| **Streaming is steady** | Reserved layout, steady reveal, no theater (§2.25.6, §3.12). |
| **Context is explicit** | The session context (device, tenant, time) is visible in the header; the model + provider are disclosed in the footer (§40.7). |
| **Consequential actions confirm** | Chat suggestions that act (apply fix, disconnect) render the human-confirm CTA (§40.4). |
| **Regenerate and export** | Regenerate re-runs in context (§2.25.4); export produces a transcript with sources — an exported answer without sources is a defect. |
| **Error is honest** | Provider failures render §33 with retry; the assistant never silently fabricates a "can't connect" explanation (§40.5). |
| **No personality** | No emoji, no conversational filler, no "As an AI…" (TG-1A §15, §40.7). |

### 4.13.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Conversational investigation and triage | A chat that replaces structured forms for data entry |
| Grounded, sourced assistant answers | Ungrounded "chatbot" answers |
| Thread context with disclosed scope | A chat that silently forgets its context mid-session |

---

## 4.14 Knowledge Base

### 4.14.1 Purpose

**WHAT:** The internal documentation surface — searchable articles that also ground the AI. **WHY:** KB articles are the source-of-truth store the AI cites (§2.28); the surface must make knowledge findable and the citations real.

### 4.14.2 Anatomy

| Element | Standard |
|---------|----------|
| Browse | Category tree (§2.23) + article list + search (§2.7) |
| Article | Breadcrumb (§2.16) + title + meta (author, version, updated) + TOC + body + related articles |
| Body | `container-reading` (§7.4); markdown; code blocks in mono (§6.2) |
| AI integration | Articles are citable (§2.28); AI chat links to KB articles as sources (§4.13) |
| Feedback | "Was this helpful?" quiet control; comments/approval for enterprise drafts |
| Versioning | Articles version; drafts don't publish; "you're viewing v2, latest is v4" notice |

### 4.14.3 Rules

| Rule | Detail |
|------|--------|
| **Articles are citable** | Every substantive article has a stable URL that AI sources can reference (§2.28.6). |
| **Freshness is stated** | Article updated dates are visible; stale articles flag ("Last reviewed 6 months ago"). |
| **Search is the front door** | Searchable by keyword + category; no dead search states (§4.5). |
| **AI citations resolve** | A KB source chip opens the exact article — never a search page for it (§2.28.6). |

### 4.14.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Internal runbooks, procedures, policies | Docs buried where AI can't cite them |
| Versioned, reviewed articles | Publish-without-review knowledge bases |

---

## 4.15 Document Viewer

### 4.15.1 Purpose

**WHAT:** The in-product viewer for PDFs, logs, reports, and exportable documents. **WHY:** Professionals review evidence in context; a viewer must keep text accessible, searchable, and annotatable without leaving the product.

### 4.15.2 Anatomy

```
┌────────────────────────────────────────────────────────┐
│ toolbar: [‹] title · page 3 of 12 · ⌕ search · zoom ▾  │
│         · annotations · download · print               │
├───────────────┬────────────────────────────────────────┤
│ Sidebar       │  Document/content pane                  │
│ TOC / pages / │  text selectable, mono for logs,        │
│ annotations   │  search highlights, threshold lines     │
└───────────────┴────────────────────────────────────────┘
```

| Element | Standard |
|---------|----------|
| Content | Text-selectable (never image-only); logs in Plex Mono with line numbers (§6.2) |
| Toolbar | Page position, search, zoom (scale with reset), download, print |
| Sidebar | TOC / pages / annotations; collapsible |
| Annotations | Add note/highlight; annotations list with jump-to |
| Search | In-document search with match count and navigation (§2.7) |

### 4.15.3 Rules

| Rule | Detail |
|------|--------|
| **Text is data** | Documents render as text (selectable, searchable, readable by assistive tech) — image-only PDFs are a defect. |
| **Logs are instrument data** | Mono, tabular, line numbers, filter/highlight, copy (§2.1 mono semantics). |
| **Annotations are saved** | Annotations persist and link to the document version; never lost on reload. |
| **Print/export parity** | Print output matches the viewer's content and metadata. |
| **Accessibility** | Zoom doesn't break keyboard navigation; contrast is maintained; focus states visible (§41). |

### 4.15.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| PDF/log/report review in-product | Rendering documents as images |
| Annotatable evidence | Downloads as the only way to view |

---

## 4.16 Cybersecurity Modules

### 4.16.1 Purpose

**WHAT:** Security surfaces — risk posture, threat alerts, vulnerabilities, compliance, audit log, incidents. **WHY:** The brand promises "defensive security posture — proactive visibility into risk, not reactive alarmism" (TG-1A §1); security UI must report risk honestly without fear theater.

### 4.16.2 Anatomy

| Module | Core pattern |
|--------|--------------|
| Risk posture | Dashboard (§4.2) with risk score, exposure, coverage — stat widgets + AI insight (grounded) |
| Threat alerts | Alert table (§4.6) + timeline (§2.22); severity per §5.6 |
| Vulnerabilities | Table with filters (§4.7), severity, CVSS, remediation tracking |
| Compliance | Checklist/status panels; evidence-linked; exportable for audits (§4.9) |
| Audit log | Immutable timeline (§2.22 audit) — filterable, exportable |
| Incidents | Incident workspace: timeline + evidence + response + status |

### 4.16.3 Rules

| Rule | Detail |
|------|--------|
| **Honesty over alarm** | Severity follows the data (§5.6); no manufactured urgency; a critical only when genuinely critical (§5.6). |
| **Evidence chains** | Every finding links to evidence (log, alert, scan) — the verifiable interface (§3.2). |
| **Remediation is tracked** | Findings have owners, status, and deadlines — never a pile of unactionable warnings. |
| **AI findings are grounded** | AI analysis of risk carries sources + confidence (§2.25); an ungrounded security claim is the worst kind (§40.4). |
| **Compliance is exportable** | Audit/compliance views export for review (§4.9) with the same visual language. |
| **Calm critical** | Critical security states place calmly with icon + label; no pulsing red (§43.7). |

### 4.16.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Risk reporting with evidence | Fear-theater severity inflation |
| Tracked, owned remediation | Findings that cannot be acted on |

---

## 4.17 Error Handling

### 4.17.1 Purpose

**WHAT:** The system-level error pattern — global boundary, offline banner, retry strategy, partial failure, degraded mode (extends TG-2A §33). **WHY:** Errors are inevitable in distributed systems; the pattern defines how the whole page behaves when parts fail.

### 4.17.2 Anatomy

| Layer | Pattern |
|--------|---------|
| Field | Inline error, icon + text (§33.3) |
| Panel | In-panel banner + retry (§33.3) |
| Page | Non-destructive top banner; content preserved (§33.3) |
| Route/whole-app | Error boundary page: §33 pattern + return-home + retry |
| Global offline | Offline banner (§4.21) — persistent, non-blocking |

### 4.17.3 Rules

| Rule | Detail |
|------|--------|
| **Human first, technical second** | Plain-language message + collapsible "Technical details" with IDs (§33.4). |
| **Retry is idempotent and bounded** | One retry affordance; automatic retry only for idempotent reads with backoff; no infinite loops (§33.4). |
| **Partial failure is stated** | If 2 of 12 panels failed, the failures are marked; the working panels stay live — never a whole-page error for a partial failure. |
| **Input is preserved** | Errors never wipe entered values (§33.4). |
| **Error ≠ alert** | User-caused errors are inline feedback; system events are notifications (§33.4). |
| **Telemetry with consent** | Error details flow to the support pipeline; shown transparently in "Technical details." |

### 4.17.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Actionable, honest error states | Bare "Something went wrong" walls |
| Degraded mode with labeled data | A full-page error for one failed widget |

---

## 4.18 Success Flow

### 4.18.1 Purpose

**WHAT:** The completion pattern — results confirmed calmly, with a clear next step (extends TG-2A §34). **WHY:** A confirmed result builds trust; a celebrated result builds noise (TG-1A §5).

### 4.18.2 Anatomy

| Level | Expression |
|-------|-----------|
| In-flow | The UI itself changes (row appears, status flips to Go) — §34.2 |
| Confirmation | Inline check or toast with Undo where applicable (§34.2) |
| Completion | Completion view: icon + title ("Device connected") + result specifics + one next step ("View device" / "Done") — §34.2 |
| Never | Confetti, bounce, "Level up!", gamified rewards (TG-1A §24, §34.3) |

### 4.18.3 Rules

| Rule | Detail |
|------|--------|
| **Result, not process** | State the result with real figures: "3 of 3 devices connected" (§34.3). |
| **One next step** | Completion views end in one calm action — never a dead end (§34.3). |
| **Undo where reversible** | Success toasts carry Undo for reversible actions (§30.4, §52.5). |
| **Quiet defaults** | If the UI visibly changed, no toast is needed (§30.4). |
| **Numbers stay sacred** | Success copy quotes real figures; never inflated claims (§34.3). |

### 4.18.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Calm confirm + specific result + next step | Fireworks and "Congratulations!" |
| Inline success when the UI reflects it | Success toast duplicating a visible change |

---

## 4.19 Loading Flow

### 4.19.1 Purpose

**WHAT:** The page-level loading choreography — shell, skeleton, section refresh, background jobs (extends TG-2A §35). **WHY:** Loading is an honest statement of time (§35.1); the pattern defines how whole pages and their parts load.

### 4.19.2 Anatomy

| Scenario | Treatment |
|----------|-----------|
| First content | Skeleton layout (§36) matching final structure — §3.7 |
| Section refresh | Content stays; "Updating…" meta; values replace on arrival (§35.2) |
| Known-duration action | Button spinner + label, locked width (§17.4) |
| Long/queued job | Progress (§2.20) or phase label; job center for background work (§35.2) |
| Background sync | Muted footer/header status, never a modal (§35.2) |

### 4.19.3 Rules

| Rule | Detail |
|------|--------|
| **No ambiguous spinners** | Bounded waits only; cap + honest error (§35.4). |
| **No fake progress** | Percent maps to real work (§2.20.6). |
| **Optimistic where safe** | Reversible actions apply optimistically with visible in-flight and honest rollback (§52.4). |
| **Layout stability** | Loading preserves dimensions to prevent jump (§50.2). |
| **Reduced motion** | Skeletons static, spinners static-ring/pulse (§3.15). |

### 4.19.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Skeletons for first paint, spinners for in-flight | Indeterminate spinners as page placeholders |
| Honest phase progression | Fake bars; spinners that resolve to silent failure |

---

## 4.20 Empty States

### 4.20.1 Purpose

**WHAT:** The empty-surface pattern — every data surface's defined "nothing here yet" answer (extends TG-2A §32). **WHY:** An empty state is a teaching moment, never an absence (§32.1).

### 4.20.2 Empty state types

| Type | Anatomy |
|------|---------|
| Onboarding (no data yet) | Glyph-in-panel + title + one-line explainer + primary CTA (§32.3) |
| Filtered to zero | "No X match your filters" + Clear filters ghost button (§32.4) |
| Error-empty | "Couldn't load X" + retry (§33.3) |
| Permission-empty | "You don't have access" + who to contact — never a bare empty |
| Archived/retired | "Nothing active" + archived filter affordance |
| Paused flow | Status icon + "Paused" + resume action |

### 4.20.3 Rules

| Rule | Detail |
|------|--------|
| **Never empty, never dead** | A data surface always renders a defined empty state (§32.4). |
| **Teach, don't apologize** | "Install the agent to see live health here" beats "No devices." (§32.4). |
| **One CTA** | One primary action, one secondary ghost max (§32.4). |
| **Contextual grammar** | Distinguish "no data yet" from "no matches" (§32.4). |
| **Illustration gate** | Full illustrations only for onboarding/help; surface empties use the glyph-in-panel (§14.3). |
| **Accessibility** | Empty states are real content read by screen readers (§32.4). |

### 4.20.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| First-run, filtered-to-zero, paused flows | Replacing real skeletons with instant empties |
| One clear next step per empty | Instruction walls; marketing copy in empties |

---

## 4.21 Offline States

### 4.21.1 Purpose

**WHAT:** The disconnected/degraded pattern — user offline, device offline, agent offline, degraded data, and AI unavailability (extends TG-2A §39.4 staleness). **WHY:** A real-time intelligence product that quietly freezes is lying about the world (TG-2A §39.4); offline must be visible, calm, and honest.

### 4.21.2 The offline map

| Scenario | Pattern |
|----------|---------|
| User's connection lost | Persistent global banner: "You're offline — showing last-known data." Non-blocking; auto-clears on reconnect |
| Device/agent offline | Device status flips to Offline (icon + label, §5.6); last-known values labeled last-known (§39.4) |
| Degraded data | "Data as of 14:02" + Caution meta on affected surfaces (§39.4) |
| AI provider down | AI header status chip: honest provider health ("Fallback: …"); AI surfaces render §33 error + retry (§40.5) |
| Queue/reconnect | Queued actions show queued state; reconnect is automatic with visible status |

### 4.21.3 Rules

| Rule | Detail |
|------|--------|
| **Staleness is never silent** | Every affected surface states its data age (§39.4). |
| **Last-known is labeled** | Offline devices render last-known values *as* last-known — never as live (§39.4). |
| **Reads degrade; writes queue** | Read surfaces degrade to last-known with banners; writes queue with visible state, or are blocked with a reason. |
| **Banner is non-blocking** | The offline banner is persistent but never blocks the page (no modal hostage, §35.2). |
| **Reconnect is automatic + announced** | Reconnect happens automatically with backoff and announces the fresh state. |
| **AI never fabricates offline** | With no connectivity/grounding, the assistant says so (§40.5) — no canned "I'm having trouble" theater. |

### 4.21.4 When to use / when not to use

| Use | Don't use |
|-----|-----------|
| Honest degraded mode with labeled data | A frozen dashboard with no explanation |
| Automatic reconnect with status | Silent data corruption behind a "Live" label |

---

# PART 5 — DESIGN GOVERNANCE

---

## 5.1 Component Lifecycle

### 5.1.1 The philosophy

> **A component is a product with a lifecycle: it is proposed because a gap exists, matured because it is used, and retired because it is superseded. Governance is what keeps the library trustworthy (TG-2A §58 extended).**

### 5.1.2 The lifecycle states

| State | Meaning | Promotion gate |
|-------|---------|----------------|
| **Proposal** | A gap is documented; no component exists | Proposal issue (gap + sketch + §57 pre-check) |
| **Draft** | Spec in review; may be implemented experimentally | Draft spec + review session (§5.8) |
| **Candidate** | Spec approved; implemented; in limited use | Pass §57 checklist + a11y audit + visual regression |
| **Stable** | Public API; all states specified; both themes verified | Design Systems + Engineering sign-off (§5.5) |
| **Deprecated** | Superseded; replacement documented | Deprecation notice + migration guide (§5.3) |
| **Removed** | Deleted from the library | Major version only; migration required (§5.4) |

### 5.1.3 Lifecycle rules

| Rule | Detail |
|------|--------|
| **No component without a spec** | A component reaches Candidate only with the full standard: purpose, anatomy, variants, states, accessibility, UX rules, usage, anti-patterns (§5.6). |
| **Stable is earned** | Stable requires ≥ 2 real consumers, both themes, and a11y + perf verification — not time on the calendar. |
| **States are complete before stable** | Default/hover/focus/active/disabled/loading/error/empty all specified (TG-2A §16.2). |
| **Lifecycle is visible** | Docs mark each component's state (Draft/Candidate/Stable/Deprecated) so consumers know what to depend on. |
| **Retirement is explicit** | No component is deleted silently; every removal passes §5.3–§5.4. |

---

## 5.2 Versioning

### 5.2.1 The philosophy

> **The design system version is a contract with every consumer. Version numbers communicate risk of change; consumers pin deliberately and upgrade deliberately (TG-2A §55.2).**

### 5.2.2 The version scheme (Semantic Versioning for design)

| Version | Meaning | Examples |
|---------|---------|----------|
| **MAJOR** | Breaking changes: token removals, component API changes, identity-level visual change | 2.0.0 |
| **MINOR** | Additive: new components, new tokens, non-breaking additions | 1.4.0 |
| **PATCH** | Fixes: value corrections that don't change consumed output, documentation | 1.4.1 |

### 5.2.3 Versioning rules

| Rule | Detail |
|------|--------|
| **Breaking = MAJOR** | A change that requires consumer code or visual change is MAJOR (§5.4). |
| **Tokens version with the system** | Token registry versions in lockstep (§1.1.3); consumers pin the version. |
| **Changelog is mandatory** | Every release records: added, changed, deprecated, removed, with migration notes. |
| **Upgrade cadence** | Consumers may stay on a MAJOR; support window is declared (e.g., current + one MAJOR back). |
| **No silent changes** | A token value change is a PATCH/MINOR with a changelog entry and regression evidence (§1.14.4). |

---

## 5.3 Deprecation

### 5.3.1 The philosophy

> **Deprecation is the honest retirement of a component or token: consumers are told, a replacement is provided, and a timeline is set — no surprises, no orphans.**

### 5.3.2 The deprecation process

| Step | Requirement |
|------|-------------|
| 1. Announce | Changelog + docs flag the component/token `deprecated` with the replacement mapping |
| 2. Timeline | Deprecated status lasts ≥ 2 MINOR versions (or one MAJOR cycle) before removal |
| 3. Migration guide | Replacement mapping + example before/after for every deprecated API/token |
| 4. Consumers migrate | Migration is supported; no silent removal during the window |
| 5. Remove | Removal only in a MAJOR release; migration guide published in the same release |

### 5.3.3 Deprecation rules

| Rule | Detail |
|------|--------|
| **Deprecation is visible** | Deprecated docs render a banner; the registry keeps deprecated tokens flagged with their replacement (§1.14.5). |
| **Never deprecated without a replacement** | A removed capability without a successor is a product decision, not a deprecation. |
| **Exemptions** | Security or brand-critical issues may skip the timeline with an emergency MAJOR (documented). |

---

## 5.4 Breaking Changes

### 5.4.1 What counts as breaking

| Change | Breaking? |
|--------|-----------|
| Token removed or renamed | Yes — MAJOR |
| Token value changes consumed visual output | Yes (unless scoped PATCH with evidence) |
| Component API (props/names) removed or renamed | Yes — MAJOR |
| Component rendered output changes meaningfully | Yes — MAJOR |
| New component / new token (additive) | No — MINOR |
| Value correction that does not change output | No — PATCH |

### 5.4.2 Breaking change policy

| Rule | Detail |
|------|--------|
| **Deprecation first** | Breaking changes pass the deprecation window (§5.3) unless exempted. |
| **Migration required** | Every MAJOR ships a migration guide (§5.3.2). |
| **Evidence required** | Visual regression (both themes) + a11y audit accompany the change (TG-2A §58.12). |
| **Approval bar is higher** | Breaking changes require Design Systems + Product + Engineering + a11y sign-off (§5.5). |
| **Communication is early** | Breaking changes are announced at the start of the cycle, not at release. |

---

## 5.5 Approval Process

### 5.5.1 The philosophy

> **Approval is a gate, not a ritual: the system changes only through a documented, signed decision (TG-2A §58 extended).**

### 5.5.2 The approval flow

| Stage | Participants | Decision |
|-------|--------------|----------|
| Proposal | Author (designer or engineer) | File the issue/TDR with gap + rationale (§5.1.2) |
| Design review | Design Systems | Spec correctness, token usage, both-theme validity |
| Engineering review | Frontend Engineering | Feasibility, API design, performance budget |
| Accessibility review | Accessibility Lead | §6.2 checklist, reduced motion, SR behavior |
| Final gate | Design Systems + Product + Engineering + a11y Lead | Approve / Amend / Reject (recorded) |
| Release | Design Systems | Version bump (§5.2), changelog, regression evidence |

### 5.5.3 Rules

| Rule | Detail |
|------|--------|
| **Every change is recorded** | Approval records: what changed, why, who approved, version, evidence (§5.2.3). |
| **Amendments to this document** | Changes to TG-2A/TG-2X follow the signed amendment table (TG-2A §58) and this process. |
| **No backdoor changes** | A screen that deviates without approval is a defect, not a precedent (§16.4). |
| **Decisions are reversible** | A rejected proposal records the reason and the path to resubmission. |

---

## 5.6 Documentation Standards

### 5.6.1 The philosophy

> **A component's documentation is its contract — the same document that governs design, engineering, and AI vocabulary (TG-2A §56.3).**

### 5.6.2 The component documentation template

Every component (TG-2A and TG-2X) is documented with exactly:

| Section | Required content |
|---------|------------------|
| Purpose | WHAT it is; one line + WHY |
| Anatomy | ASCII anatomy + part table |
| Variants | Each variant, its use, its visual |
| States | Default, hover, focus, active, disabled, loading, error, empty |
| Accessibility | Roles, keyboard, focus, SR, reduced motion |
| UX Rules | Behavior contracts (tables) |
| Usage | Where it is used (patterns §4) |
| Anti-Patterns | When NOT to use |
| Lifecycle | Draft/Candidate/Stable/Deprecated (§5.1) |
| Changelog | Versioned entries (§5.2) |

### 5.6.3 Documentation rules

| Rule | Detail |
|------|--------|
| **Vocabulary is shared** | Docs use the product vocabulary (§56.3); a doc that coins a new term is a terminology change requiring review. |
| **Examples are real** | Code/spec examples reflect real components and real-shaped data (TG-1A §14). |
| **One document per component** | No parallel docs; the library is the single source. |
| **Screens map to patterns** | A screen references its pattern (§4); the pattern references its components. |

---

## 5.7 Contribution Rules

### 5.7.1 Who may contribute

| Contributor | Role |
|-------------|------|
| Designers | Propose new components/tokens/patterns; amend specs |
| Engineers | Propose new components/tokens; flag gaps; report deviations |
| Product | Request capabilities through the proposal process |
| AI/Content | Vocabulary and copy contributions (terminology review, §56.3) |

### 5.7.2 Contribution rules

| Rule | Detail |
|------|--------|
| **Gap-first** | A contribution starts from a documented gap, never from "wouldn't it be nice." |
| **No parallel systems** | A proposal that duplicates an existing component/token is rejected and redirected (§55.2). |
| **Full spec or nothing** | New components ship the full §5.6 template; partial specs stay in Draft. |
| **Tokens gate the work** | Contributions use tokens; new values go through governance (§1.14). |
| **Character preserved** | Contributions must pass the expansion test (TG-2A §55.3): character, vocabulary, five-second, trust, reduced-motion + contrast. |
| **Attribution** | Every contribution records its author and rationale. |

---

## 5.8 Review Workflow

### 5.8.1 The philosophy

> **Review is where the system stays honest: a rhythm of async review, a visible queue, and recorded decisions.**

### 5.8.2 The review workflow

| Step | Detail |
|------|--------|
| Queue | Proposals/Drafts/Candidates tracked in the design-system issue queue, triaged weekly |
| Async review | Design Systems reviews specs async; comments recorded on the proposal |
| Review session | Weekly: candidates and breaking changes (cadence; every change reviewed within 2 weeks) |
| Verification | Visual regression (both themes) + a11y audit on every Candidate/MAJOR |
| Decision | Approve / Amend / Reject with recorded reasons (§5.5.3) |
| Release | Batched per version; changelog per release (§5.2) |
| Retro | Lifecycle states reviewed quarterly: what stabilized, what's stuck, what must be deprecated (§5.1) |

### 5.8.3 Review rules

| Rule | Detail |
|------|--------|
| **Everything is reviewed before release** | No change reaches Stable or MAJOR without a recorded review. |
| **Both-theme and reduced-motion evidence** | Reviews require regression evidence in both themes and reduced-motion verification (§3.15). |
| **A11y is a reviewer, not an auditor** | Accessibility participates in review, not after design freeze (TG-2A §41.1). |
| **SLA on the queue** | Every proposal receives a decision or a stated status within two weeks. |

---

# PART 6 — QUALITY ASSURANCE

---

## 6.0 Introduction

These seven checklists are the **ship gates** for screens and components. TG-2A §57 is the design gate; this part specializes it per discipline. A screen/component passes only when every applicable checklist passes.

---

## 6.1 Design Review Checklist

| # | Check | Pass / Fail |
|---|-------|-------------|
| 1 | Primary signal readable in five seconds (§38.2) | ☐ |
| 2 | Exactly one primary action per surface (§8.3) | ☐ |
| 3 | All states designed: default/hover/focus/active/disabled/loading/error/empty (§16.2) | ☐ |
| 4 | Tokens used exclusively — no hard-coded values (§1.1.3) | ☐ |
| 5 | Components from the library — no page-local forks (§16.4) | ☐ |
| 6 | Both light and dark themes designed and verified (§5.7–§5.8) | ☐ |
| 7 | Color semantic, desaturated, never decorative (§4.6) | ☐ |
| 8 | Status redundant (icon + label + color), never color-alone (§41.4) | ☐ |
| 9 | Copy plain, specific, calm, verification-honest (§51.3) | ☐ |
| 10 | Naming matches the vocabulary (§56.3) | ☐ |
| 11 | Anti-patterns reviewed for the components used (§2) | ☐ |
| 12 | Expansion test passed (TG-2A §55.3) | ☐ |

---

## 6.2 Accessibility Checklist

| # | Check | Pass / Fail |
|---|-------|-------------|
| 1 | WCAG 2.2 AA contrast in both themes; text ≥ 4.5:1 (§41.3) | ☐ |
| 2 | Full keyboard parity; every workflow reachable without a mouse (§41.5) | ☐ |
| 3 | Focus visible everywhere; ring never removed (§41.5) | ☐ |
| 4 | Focus trapped/restored in overlays (modal, dialog, drawer, popover) (§26.2, §2.18) | ☐ |
| 5 | Semantic landmarks: one main, header/nav/footer; skip link (§41.5) | ☐ |
| 6 | Screen-reader truth: labels describe meaning; live regions correct (§41.6) | ☐ |
| 7 | Reduced motion honored with zero information loss (§3.15) | ☐ |
| 8 | Color never the sole carrier of meaning (§41.4) | ☐ |
| 9 | Touch targets ≥ 44px on mobile; ≥ 36px desktop icon-only (§41.8) | ☐ |
| 10 | Forms: labels associated, errors linked, autocomplete set (§25, §18.4) | ☐ |
| 11 | Charts: `role="img"` + data table alternative (§2.30.6) | ☐ |
| 12 | AI: grounded, sources focusable, announced once per block (§2.25.5) | ☐ |
| 13 | Automated axe scan clean + manual screen-reader pass on major flows (§41.2) | ☐ |

---

## 6.3 Performance Checklist

| # | Check | Pass / Fail |
|---|-------|-------------|
| 1 | FCP < 1.5s, LCP < 2.5s, TTI < 3.5s on mid-range/4G (§50.2) | ☐ |
| 2 | Route transition ≤ 400ms with motion; ≤ 100ms render (§50.2) | ☐ |
| 3 | Bundle ≤ 180KB gzipped per route; charts/AI/3D split (§50.2) | ☐ |
| 4 | Motion uses `opacity`/`transform` only (§43.4) | ☐ |
| 5 | No bulk backdrop-blur; one overlay only (§12.3) | ☐ |
| 6 | Images optimized, intrinsic dimensions, lazy below fold (§15.3) | ☐ |
| 7 | Fonts self-hosted, subset, preloaded (§6.2) | ☐ |
| 8 | Long lists virtualized; no 10,000-row DOM (§50.3) | ☐ |
| 9 | Charts throttled (≤ 1 render/sec), paused offscreen (§50.3) | ☐ |
| 10 | Layout stable during load — no jump (§50.2) | ☐ |

---

## 6.4 Responsive Checklist

| # | Check | Pass / Fail |
|---|-------|-------------|
| 1 | Tested at every breakpoint (< 640 / 640–1023 / 1024–1279 / 1280–1535 / ≥ 1536) (§45.4) | ☐ |
| 2 | Mobile priority order: primary signal → primary action → secondary (§46.2) | ☐ |
| 3 | Touch targets ≥ 44px; ≥ 8px gaps (§46.3) | ☐ |
| 4 | No hover-only content; hover-revealed has tap alternative (§28.3) | ☐ |
| 5 | Tables become card-tables on mobile; no default horizontal scroll (§46.4) | ☐ |
| 6 | Charts collapse to stat-card summaries below 480px (§37.3) | ☐ |
| 7 | Modals become bottom sheets/full-screen on mobile (§46.5) | ☐ |
| 8 | Toasts top full-width minus 16px on mobile (§30.2) | ☐ |
| 9 | Large screens: centered max-width; whitespace scales, elements don't (§49.2) | ☐ |
| 10 | Data density is a global preference, never per-screen (§48.3) | ☐ |

---

## 6.5 Motion Checklist

| # | Check | Pass / Fail |
|---|-------|-------------|
| 1 | Every animation explains a state change — none decorative (§42.2) | ☐ |
| 2 | Duration from the token scale; nothing over 400ms (§3.3) | ☐ |
| 3 | Easing from the approved curves; no bounce/spring (§3.4) | ☐ |
| 4 | Distance from the token scale; ≤ 16px travel (§43.3) | ☐ |
| 5 | Exit faster or equal to enter; reverse path (§3.2.2) | ☐ |
| 6 | Compositor-only properties (§3.16) | ☐ |
| 7 | Reduced-motion substitute defined and lossless (§3.15) | ☐ |
| 8 | Nothing flashes faster than 3Hz (§43.6) | ☐ |
| 9 | Loading/progress is honest — no fake progress (§3.7) | ☐ |
| 10 | AI motion calm: no typing theater, steady streaming (§3.12) | ☐ |
| 11 | Dashboard motion settles; no idle animation (§3.13) | ☐ |
| 12 | 60fps on a mid-range device during every transition (§3.16) | ☐ |

---

## 6.6 Visual Consistency Checklist

| # | Check | Pass / Fail |
|---|-------|-------------|
| 1 | 8pt grid and token spacing only (§7, §9) | ☐ |
| 2 | Radii, shadows, elevation from token scales (§10–§12) | ☐ |
| 3 | One surface language; no per-module visual styles (§3.3) | ☐ |
| 4 | One accent per surface; status colors semantic only (§3.3) | ☐ |
| 5 | Typography from the scale; tabular numerals for data (§6) | ☐ |
| 6 | Edge-first depth: border + shadow, never shadow alone (§11.3) | ☐ |
| 7 | Icons from the approved set; consistent stroke/size (§13) | ☐ |
| 8 | Terminology consistent with the vocabulary (§56.3) | ☐ |
| 9 | No forbidden aesthetics: neon, glow, glass, celebration (§1.4, TG-1A §24) | ☐ |
| 10 | No decorative color; no status color for decoration (§4.6) | ☐ |

---

## 6.7 Developer Handoff Checklist

| # | Check | Pass / Fail |
|---|-------|-------------|
| 1 | Implementation consumes semantic tokens only (§1.1.3) | ☐ |
| 2 | Components from `@techfusion/ui`; no local re-implementations (§16.4) | ☐ |
| 3 | All designed states implemented and tested (§6.1.3) | ☐ |
| 4 | Both themes verified in regression (§5.4.2) | ☐ |
| 5 | Keyboard complete; focus rings intact (§6.2.2–§6.2.3) | ☐ |
| 6 | Reduced motion honored (media query + user override) (§3.15) | ☐ |
| 7 | Empty/loading/error/offline states implemented — no silent blanks (§32–§35, §4.21) | ☐ |
| 8 | Motion uses tokens and allowed properties (§6.5) | ☐ |
| 9 | Component API follows naming conventions; states as properties (§56.2) | ☐ |
| 10 | Visual regression + a11y test evidence recorded (TG-2A §58.12) | ☐ |
| 11 | Changelog entry written (§5.2) | ☐ |
| 12 | Pattern/screen mapped to its documentation (§5.6.3) | ☐ |

---

## Appendices

### A. Coverage Matrix (final)

| Domain | Specified in |
|--------|--------------|
| Brand identity, voice, values | TG-1A |
| Design philosophy, principles, color, type, grid, layout, spacing, radius, shadow, elevation, icons | TG-2A Part A |
| Buttons, inputs, cards, tables, navigation, sidebar, header, footer, forms, modals, dropdowns, tooltips, notifications, toasts, dialogs, empty/error/success/loading states, skeletons | TG-2A Part B |
| Charts, dashboard, data-viz, AI components | TG-2A Part C |
| Accessibility | TG-2A Part D |
| Motion philosophy, duration, easing, transitions | TG-2A Part E |
| Responsive, performance, UX, interaction, micro-interactions | TG-2A Part F–G |
| Token philosophy, expansion, naming | TG-2A Part H |
| Border, opacity, z-index, size tokens; token registry, naming, governance, expansion | **TG-2X Part 1** |
| Textarea, checkbox, radio, switch, select, combobox, search, date picker, avatar, badge, chip, tag, panel, accordion, tabs, breadcrumb, pagination, drawer, popover, progress, stepper, timeline, tree view, file upload, AI response/citation/confidence/sources, dashboard widgets, chart extensions | **TG-2X Part 2** |
| Motion choreography: timing, hover, focus, loading, page/modal/drawer/toast/AI/dashboard/skeleton motion, reduced motion, performance | **TG-2X Part 3** |
| Enterprise UX patterns: auth, dashboard, settings, wizard, search, tables, filters, forms, reports, analytics, notifications, monitoring, AI chat, knowledge base, document viewer, cybersecurity, error/success/loading/empty/offline flows | **TG-2X Part 4** |
| Component lifecycle, versioning, deprecation, breaking changes, approval, documentation, contributions, review | **TG-2X Part 5** |
| Design, accessibility, performance, responsive, motion, visual consistency, developer handoff checklists | **TG-2X Part 6** |

### B. One-sentence Reference

- **Tokens:** One registry, four layers (primitive/semantic/component/theme), generated from one source, governed by the TDR gate — border, opacity, z-index, and size families complete the model.
- **Components:** The library is complete — 42 enterprise components, each with purpose/anatomy/variants/states/accessibility/UX rules/usage/anti-patterns, all composed from tokens.
- **Motion:** Fast, damped, directional, information-only — timing classes to 400ms max, token easing, per-surface choreography, reduced motion as a first-class lossless state.
- **Patterns:** Pages are instruments — 21 enterprise patterns assemble components into honest, five-second-comprehensible surfaces.
- **Governance:** Components live (propose → draft → candidate → stable → deprecated → removed); the system version-bumps; nothing changes unrecorded.
- **Quality:** Seven ship gates (design, accessibility, performance, responsive, motion, visual consistency, developer handoff) — a screen or component ships only when every applicable gate passes.

### C. Approval Sign-off

| Role | Decision | Signature | Date |
|------|----------|-----------|------|
| Design Systems | ☐ Approve ☐ Amend | | |
| Product Design | ☐ Approve ☐ Amend | | |
| Frontend Engineering | ☐ Approve ☐ Amend | | |
| Accessibility Lead | ☐ Approve ☐ Amend | | |
| Executive Sponsor | ☐ Approve ☐ Amend | | |

### Amendments

This document is the final extension of the TechFusion Design Language. Amendments are permitted only through the signed revision process (TG-2A §58, §5.5). Screens and components may not silently deviate while waiting for an amendment.

| Version | Date | Reason | Sections affected |
|---------|------|--------|-------------------|
| 1.0 | 2026-08-01 | Final design system extension — completes TG-2A | All |

---

*End of document. TG-2A + TG-2X together are the complete TechFusion Design Language — the instrument the professional looks through: calm, precise, honest, and always out of the way of the work.*

*End of TG-2X.*






