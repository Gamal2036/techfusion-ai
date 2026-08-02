# TechFusion-AI — Command Center Visual Direction & 4DX Spatial Experience (DASH-VIS-01)

> **Document ID:** DASH-VIS-01
> **Type:** Visual Architecture / Spatial UX / 4DX Experience Contract
> **Phase:** PRODUCT EXECUTION
> **Mode:** DESIGN SPECIFICATION — NO PRODUCTION IMPLEMENTATION
> **Priority:** HIGH
> **Date:** 2026-08-02
> **Owner:** Engineering Execution Governance
> **Baseline:** DASH-01 (2026-08-01), DASH-02 (2026-08-02), DASH-DATA-01 (2026-08-02), AUTH-CERT-01 (frozen), TG-1A / TG-2A / TG-2X / TG-3 / TG-CORE
> **Status:** SPECIFICATION COMPLETE — DIRECTION APPROVED FOR DASH-IMPL-01 / DASH-IMPL-02

---

## 0. Document Contract

This document is **authoritative for DASH-IMPL-01 and DASH-IMPL-02** and a **design specification only**.

**Hard constraints (violating any of these is a governance event, not an opportunity):**

| Constraint | Rule |
|---|---|
| **Production Dashboard code** | NOT modified. Do NOT rebuild or edit production Dashboard implementation. |
| **Authentication** | CERTIFIED & FROZEN (AUTH-CERT-01, baseline AUTH-02X-R2-H1). Referenced, never copied or touched. |
| **Backend / APIs / Database** | NOT modified. `GET /dashboard/summary` contract (DASH-DATA-01) is implementation truth. |
| **DASH-DATA-01 contracts** | NOT modified. This spec designs *on top of* the delivered summary contract. |
| **Preservation contract** | DASH-01 §22 governs: no git reset/clean/stash/rebase/merge/commit/unlink of the sacred working tree. |
| **Design authority** | TG-CORE §3: visual decisions are applied from TG-1A / TG-2A / TG-2X / TG-3 / AUTH-VIS — never invented. |
| **Zero fabrication** | Every visual element either reports real state or is decorative-and-isolated. Nothing shines unless it is true. |

**Truth anchors used throughout** (short names):

- **DASH-01** = `docs/dashboard/DASH-01_CURRENT_DASHBOARD_ANALYSIS.md`
- **DASH-02** = `docs/dashboard/DASH-02_COMMAND_CENTER_BLUEPRINT.md`
- **DASH-DATA-01** = `docs/dashboard/DASH-DATA-01_REAL_DATA_INTEGRITY_REPORT.md`
- **Bible** = `TF_AUTH-VIS-01C_VISUAL_ARCHITECTURE_BIBLE.md`
- **Vision** = `TF_AUTH-VIS-01B_AUTHENTICATION_EXPERIENCE_VISION.md`
- **R2** = `TF_AUTH-02X-R2_SPATIAL_INTELLIGENCE_REPORT.md`
- **AUTH-CERT-01** = `docs/certifications/AUTH-CERT-01_AUTHENTICATION_CERTIFICATION.md`
- **TG-1A / TG-2A / TG-2X / TG-3 / TG-CORE** = design governance documents in `docs/TG-*`

---

## 1. Executive Vision

The TechFusion Command Center is the operational entry surface of the product: the place a professional reads the state of the systems they are accountable for and acts. It inherits the certified Authentication universe — the Luminous Instrument, the Calibration Edge, the Command Horizon, the Quiet Signal Flow — and evolves it into a **distributed operational environment**: **The Signal Field**.

**The governing idea in one sentence:**

> **The Command Center is a quiet field of real instruments. Nothing glows unless something is true — and when something is true, it is actionable.** (DASH-02 §18 identity statement, made authoritative here)

The selected signature — **THE SIGNAL FIELD** — makes the fleet itself the composition. Every node is a real device or real event from the DASH-DATA-01 contract; every route is a real relationship; every pulse is a real state change. The environment recedes to its hum; the information layer takes command (Bible :471 — *"the fleet's state resolving into view, the operator's world rendered whole"*).

**4DX, for TechFusion, is not about making the page move.** It is about making the system feel present:

- **Depth** communicates hierarchy.
- **Motion** communicates change.
- **Light** communicates state.
- **The Signal Field** communicates infrastructure.
- **Data** communicates truth.
- **Interaction** communicates control.

The result feels alive because the **system** is alive — not because the interface is constantly animated.

The Command Center is **operational, data-driven, spatial, intelligent, calm, dense-but-readable, enterprise-grade, responsive, accessible, state-aware, and actionable**. It must communicate: CONTROL, INTELLIGENCE, INFRASTRUCTURE, DEPTH, PRECISION, AWARENESS, RESPONSIVENESS, CALM POWER. It must **never** be chaotic, game-like, cyberpunk, neon-heavy, decorative, overanimated, or difficult to read.

---

## 2. TechFusion 4DX Definition

4DX is a spatial-experience framework **re-expressed for an enterprise web operations product**. It is not a license to animate; it is a discipline for making real state legible through depth, motion, and environment.

### Dimension 1 — INFORMATION
Real operational data. The DASH-DATA-01 summary contract, `/devices`, `/alerts`, `/audit/logs`, WS `/metrics` events. No fake telemetry, no fabricated nodes, no synthesized activity. Information is the first dimension because it is the only one that is *allowed to be bright*.

### Dimension 2 — DEPTH
Spatial hierarchy and layered interfaces. The environment is a continuous volume (Z0–Z5, §15) in which data is always the deepest citizen (Bible :237). Depth is communicated by scale, edge, blur, opacity, border intensity, lighting, and movement — never by aggressive perspective alone.

### Dimension 3 — MOTION
Meaningful, state-driven movement. Motion answers a question ("what changed?") or it is removed (Bible :344–348). Durations 50–300 ms per TG-2A; easing `ease-signal`; stillness is the default (TG-2A §42).

### Dimension 4 — ENVIRONMENTAL RESPONSE
The environment subtly responds to: system state, attention, alerts, operations, user focus, pointer presence, navigation, and data changes. Each response is bounded, local, and truthful. The environment is "infrastructure already running — not a hero animation" (R2 :62).

### What 4DX explicitly is NOT
- Constant animation
- Cinematic effects everywhere
- Fake physics
- Aggressive perspective
- WebGL everywhere
- Gaming HUD design
- Neon lighting, holograms, glowing borders

### 4DX acceptance test (every decision must pass)
1. Does this element report a real state, route to real work, or perform a real action?
2. If it moves: what question does the motion answer?
3. If it shines: what truth is it communicating?
4. Would the surface still be correct and legible with all effects removed?
5. Does it survive `prefers-reduced-motion` without losing information?

If an element fails (1) and is not decorative-and-isolated, it is removed.

---

## 3. Experience Principles

The Command Center obeys the eight TG-3 principles (Consistency, Clarity, Purpose, Accessibility, Performance, Maintainability, Predictability, Professionalism) plus the following surface-specific principles:

| # | Principle | Command Center meaning |
|---|---|---|
| P1 | **Truth over spectacle** | Every metric is a real count, a real mean, or an honest `null`. Every empty, stale, and error state is explicit. UNKNOWN never reads as OPERATIONAL. (TG-1A "real data or nothing"; Bible :510) |
| P2 | **One focal depth per moment** | Attention or data, never both competing. A screen with everything glowing is a screen with nothing glowing. (Bible :239) |
| P3 | **Stillness is the default** | Zero ambient loop on the data plane. Ambient motion only in the decorative Infrastructure/Atmosphere planes, at or below the bible restraint budget (idle ≈ 0–1 slow flows). (DASH-02 §19) |
| P4 | **Depth from layering, not glow** | Panel separation via matte layering, crisp calibration edges, and surface tint — not drop-shadow glow or glassmorphism. (Bible :240) |
| P5 | **Color reserved for meaning** | Semantic colors mean semantic state. Nothing decorative uses success/warning/danger/critical. Cyan (`optic`) stays reserved for AI. (TG-2A §5; Bible :516) |
| P6 | **Redundancy always** | Light never carries meaning alone. Geometry + iconography + copy + contrast confirm every status. (Bible :316; TG-2A §41.4) |
| P7 | **Calibration = believed** | Exact real numbers, precise labels, real refresh stamps, crisp edges. An instrument is believed because it is calibrated, not because it is big. (Bible :188) |
| P8 | **The surface never lies about absence** | NO DATA is intentionally dormant, never broken. UNKNOWN is a distinct render state, never a green state wearing a gray coat. (DASH-02 §7 honesty rules) |
| P9 | **Data dominates decoration** | The Operational Data Plane outranks every decorative plane in legibility. Decorative planes are `aria-hidden`, `pointer-events-none`, and never carry critical meaning. |
| P10 | **Engineered, not playful** | Micro-physics are restrained (1–2 px), durations are short, easing never bounces. The UI reads as machined, never bouncy. |

### 3.1 Sound & Haptic Policy
Web 4DX does **not** require sound.

- **Default: NO SOUND.** No automatic audio, no alert tones, no ambient beds.
- Sound is not planned for the Web Command Center. If it is ever considered, it requires an explicit product decision, an opt-in, and a reduced-sound policy.
- Haptic behavior is considered only for future native/mobile contexts.
- The Web Command Center remains visual and interactive. All state is conveyed through geometry, iconography, copy, and light — never through audio.

---

## 4. Six-Layer 4DX Stack

The experience is composed of six coordinated layers, from deepest to most intentional. Each layer has a defined Purpose, Visual behavior, Motion behavior, State behavior, Performance constraints, and Accessibility behavior. The layers are **distances in one continuous space** (Bible :225), not disconnected overlays.

### L0 — ATMOSPHERE
| Aspect | Specification |
|---|---|
| **Purpose** | Deepest visual environment; ambient depth that is felt, rarely looked at. |
| **Visual** | Dark precision surface (`--background` ≈ `222 47% 6%`), two broad radial tonal washes from `--surface-selected` / `--surface-interactive` at ≤ 4–6% alpha, one faint primary illumination pool at ≤ 5% alpha. No texture noise, no animated gradient, no mesh. Near-invisible during normal operation. |
| **Motion** | None. Static by definition. |
| **State** | Static regardless of system state. It is a material, not a status. |
| **Performance** | Two static gradients; GPU-composited once. Zero animation cost. |
| **Accessibility** | `aria-hidden="true"`, decorative-only. Removed below `lg` for content clarity. |

### L1 — THE SIGNAL FIELD
| Aspect | Specification |
|---|---|
| **Purpose** | Primary Command Center signature. Spatial network representing operational presence. |
| **Visual** | CSS + one layered SVG constellation behind the data plane: real fleet nodes, real relationship routes, calibration baseline, sparse receding topology fragments. Node illumination = real state (§6). |
| **Motion** | Event-driven only. Directional pulses on real state changes (device online, alert, job start). Idle travel on decorative infrastructure routes only (≤ 2 slow flows, 8s/12s/16s grammar from R2 :96). No idle node shimmer. |
| **State** | IDLE / ACTIVE / ATTENTION / DEGRADED / CRITICAL / NO_DATA / UNKNOWN per §6. |
| **Performance** | CSS transforms + opacity only; ≤ ~48 rendered nodes (real fleet, capped, remainder aggregated); no per-frame JS; zero WebGL. |
| **Accessibility** | Entire layer `aria-hidden`, `pointer-events-none`, SVG `focusable="false"`. All meaning duplicated in the data plane. Reduced motion → fully static composition, `display:none` below `lg`. |

### L2 — INFRASTRUCTURE PLANE
| Aspect | Specification |
|---|---|
| **Purpose** | Structural intelligence: the environment's "machinery" — topology lines, calibration grid, system paths. |
| **Visual** | Dot grid + engineering frame + ticked calibration baseline (InfrastructureField grammar, R2 :94), 2–3 receding rectilinear routes at `--border` / 10 alpha, registration marks. |
| **Motion** | One or two slow dashes (8–16 s) on routes that report *real* operational flow (e.g., an active backup targeting devices). Otherwise static. |
| **State** | No independent state; it carries the Command Horizon boundary (§12). |
| **Performance** | Single static SVG + 0–2 stroke-dash animations. |
| **Accessibility** | `aria-hidden`, decorative, `focusable="false"`. |

### L3 — OPERATIONAL DATA PLANE
| Aspect | Specification |
|---|---|
| **Purpose** | Where truth lives. The most legible layer. Modules: Operational State, Attention Rail, Fleet, Security, Operations, Activity, Quick Commands. |
| **Visual** | Highest contrast, crisp calibration edges, shared material family (§26). Modules read as one environment, not disconnected cards. |
| **Motion** | State-change only: changed cells fade 300 ms; rows update 200 ms; new attention items enter once. No mount churn, no idle loops. |
| **State** | Per module: loading / empty / data / stale / error, each with a defined presentation. |
| **Performance** | Budget-gated (§34). Rerenders minimized via immutable summary snapshots and memoized derivation. |
| **Accessibility** | Semantic landmarks, single `h1`, full keyboard path, `role="status"`/`aria-live="polite"` for the state banner. |

### L4 — INTERACTION PLANE
| Aspect | Specification |
|---|---|
| **Purpose** | Controls one step nearer than data. Buttons, commands, ack actions, navigation. |
| **Visual** | Elevated Command Surface material (§26). Micro-3D hover on primary actions only (console behavior, R2 :60 — "2D carries intent, 3D carries context"). |
| **Motion** | Press = 1 px compression (`ease-signal`, 100–150 ms); hover = 1–2 px rise + localized edge illumination; focus = `--ring` + calibration edge. |
| **State** | Normal / hover / focus / active / disabled / loading, all with distinct non-color-only cues. |
| **Performance** | CSS transform/opacity only; two passive pointer listeners max on the shell; no per-pixel JS. |
| **Accessibility** | Visible `:focus-visible` ring everywhere; touch targets ≥ 44 px; no hover-only information; keyboard parity for every interaction. |

### L5 — ATTENTION PLANE
| Aspect | Specification |
|---|---|
| **Purpose** | The only bright layer. Bounded, localized illumination when attention exists; quiet when clear. |
| **Visual** | Attention Rail + operational state edge + localized light pools (≤ `primary/0.13`, or semantic tint for severity). Critical state uses persistent placement + `aria-live` — never motion alone (TG-2A :2362). |
| **Motion** | New item: single fade/slide 200–300 ms; bounded pulse ≤ 3 iterations only on first arrival; critical edge brighten 400 ms then held quietly. No flashing, no full-screen effects, nothing > 3 Hz. |
| **State** | INFO / WARNING / DEGRADED / CRITICAL / UNKNOWN per §10. |
| **Performance** | Attention motion is finite and bounded; ≤ 3-iteration pulses; removed under reduced motion. |
| **Accessibility** | Severity never color-only: geometry + icon + copy + contrast. Reduced motion → static highlight only. |

**Layer discipline:** L3 always outranks L0–L2 in legibility. L5 is the only layer allowed to exceed L3 in brightness, and only while attention exists.

---

## 5. Signal Field Architecture

### 5.1 Definition
The Signal Field is a **spatial network representing operational presence**. It is the visual signature of the Command Center and the direct evolution of Authentication's one-luminous-core (Command Core) into a **distributed network of instruments** (Vision :146 — "the center of a network of instruments").

### 5.2 What exists in the field (and only this)
Every element of the field maps to a real datum:

| Field element | Real source (DASH-DATA-01 / DASH-01) |
|---|---|
| **Node — active device** | Device with `lastSeenAt` within the online threshold (`isDeviceOnline`, device-presence contract) |
| **Node — dormant device** | Enrolled device offline by the same contract |
| **Node — fleet cluster** | Aggregation of device count when fleet exceeds render cap (~48) |
| **Route — real relationship** | Only where a true relationship exists (e.g., devices targeted by an active backup job, a device with an unresolved alert) |
| **Pulse — real event** | WS `/metrics` `alerts`/`metrics` event; summary change; device online/offline transition; job state change |
| **Attention mark** | Node with unresolved alert / open critical-high finding / failed operation |
| **Coverage halo** | Scan coverage from `security.scanCoverage` (scanned vs unscanned online) |
| **Calibration baseline** | The Command Horizon evolution (§12); structural, not data |

### 5.3 Hard rules
1. **No fake telemetry.** A node exists only if a device exists. No random "activity" pretending to be infrastructure.
2. **No fabricated topology.** Routes are drawn only from real relationships, or are decorative-and-isolated infrastructure geometry (never mistaken for data).
3. **Light equals state.** A bright node is a true signal. Dormant nodes are dim. Nothing pulses unless a real event just occurred.
4. **Capped render.** Render ≤ 48 nodes; the remaining fleet is aggregated into 1–2 cluster glyphs with exact counts. Never exceed the performance budget.
5. **Empty fleet → no constellation.** When `fleet.total === 0`, the field renders NO_DATA as an intentionally dormant horizon — no nodes, no implied infrastructure (DASH-02 §16).
6. **Reduced motion → static composition.** All movement removed; the field reads as a still, premium composition (R2 :150).
7. **Below `lg`:** the field collapses to a horizon line; zero node rendering (DASH-02 §23).

### 5.4 Geometry language
- Nodes: small rotated-square frames + ring + center dot (Command Core grammar, scaled to 8–16 px) — **no icons, no "brain" graphics**.
- Active node: thin primary ring (0.5–0.7 alpha) + quiet center dot.
- Dormant node: `--border`-tone frame, no fill, no ring.
- Clusters: compact stacked glyph with a real count label (text, not decoration).
- Routes: 1 px `--border`-tone rectilinear paths (right-angle-only, per R2); a route brightens only when a real event travels it.

### 5.5 Data relationship contract
The field is derived from the composed summary snapshot + WS events. It is **presentation derivation, not aggregation** — all numbers it implies come from the summary contract; the client never invents a node, a count, or a state. Node state derivation reuses the same pure helpers as the data plane (`isDeviceOnline`, `classifyFreshness`) so the visual never disagrees with the numbers beside it.

---

## 6. Signal Field States

Seven states. Each defines Geometry, Illumination, Signal behavior, Motion, Data relationship, and Reduced-motion equivalent. States are driven by the operational state machine (DASH-02 §7 R0–R4, delivered in DASH-DATA-01) plus the UNKNOWN render state.

| State | Geometry | Illumination | Signal behavior | Motion | Data relationship | Reduced-motion equivalent |
|---|---|---|---|---|---|---|
| **IDLE** | Constellation present, all nodes at base geometry | Nodes at dim base (≤ 0.35 alpha ring; frames `--border`-tone) | None travelling; routes static or 1 slow idle dash | Zero or one 8–16 s route dash; no node motion | Matches `OPERATIONAL`; everything within tolerance | Static constellation, dim |
| **ACTIVE** | Nodes for recently-active devices sharpen slightly; active device count implied | 1–2 recently-updated nodes lift to 0.6 alpha | A real `metrics` event emits one directional pulse along the node's route, then settles | Single 300 ms pulse per changed node; settled | New telemetry nudges `lastSeenAt`; online devices hold ACTIVE | Static; the updated node stays at 0.6 alpha |
| **ATTENTION** | Attention marks appear on nodes with alerts/findings/offline status; rail is the primary carrier | Bounded local pools ≤ `primary/0.10` on affected nodes; no global brighten | One pulse per new attention item, ≤ 3 iterations, then quiet | Arrival 200–300 ms; pulse bounded | `alerts.bySeverity` (warning/low), offline devices, running/pending ops | Static marks; illumination held |
| **DEGRADED** | Edge of the state banner and rail take a calibration break (warning treatment); field geometry unchanged | Localized `warning`-tone tint on affected regions only; never full-screen | Failed-op routes show a short break, then freeze | One 300 ms confirm per failure; no looping | `failedLast24h` (backup/scan), >50% offline, high severity | Static warning edges + text reasons |
| **CRITICAL** | State banner edge + rail width react (DOM-state-driven geometry); attention node marked | `critical`-tone localized illumination on affected node + banner edge; restrained, never a red alarm | A single deliberate pulse at first arrival (≤ 3 iterations) | 400 ms edge brighten, held quietly | `critical` alerts / critical findings / all-devices-offline | Static critical edge + text |
| **NO_DATA** | No constellation; only a dormant calibration horizon + quiet empty geometry | Nothing luminous except the horizon calibration tick | None | None | `fleet.total === 0`; onboarding dominates (§38) | Identical (already static) |
| **UNKNOWN** | Field retreats to neutral, ambiguous geometry (no implied health) | No green, no blue confidence; neutral dim | None; no false pulses | None | Summary endpoint failure; render state, not a derivation (§39) | Identical (already static) |

**Critical rule:** UNKNOWN must never resemble OPERATIONAL. NO_DATA must feel intentionally dormant rather than broken. Light is state; when state is unknown, the field shows no confident light.

---

## 7. Infrastructure Plane

The Infrastructure Plane creates **spatial intelligence** without becoming a network-map replacement.

- **Content:** receding dot grid, engineering frame, ticked calibration baseline, 2–3 rectilinear system paths, corner registration marks. Inherits InfrastructureField grammar (R2 :94).
- **Behavior:** It is the *setting*. It does not report operational data. It implies "a system standing ready" (Bible :140).
- **Reactive exception:** a path may carry a slow dash only while a real operation flows (e.g., backup run active) — the "quiet signal flow" generalization (DASH-02 §16). It must never look like animated fake traffic.
- **Boundary:** no topology graph, no map, no nodes-with-labels in this plane. Nodes belong to the Signal Field; structure belongs here.
- **Performance:** one static SVG + 0–2 dash animations, transform/opacity only.
- **Accessibility:** `aria-hidden`, `pointer-events-none`, `focusable="false"`, static under reduced motion, hidden below `lg`.

---

## 8. Operational Data Plane

The most important layer: **real information must dominate decorative effects.** Design language for the eight modules such that each feels part of ONE environment.

### 8.1 Shared grammar (one environment)
- **Section frame:** `GlassPanel intensity="light"` (`rounded-xl`, `border-border`, `bg-surface-subtle/60`, `shadow-card`) — the single module material, refined by the Calibration Edge treatment (§27).
- **Section header:** overline label (`text-overline`, 11px, +0.08em, uppercase, `text-text-muted`) + `text-heading` title + optional live badge + optional "as of" stamp. A calibration tick precedes each header.
- **Rhythm:** `sp-6` section gaps, `sp-4` inner padding, 12-col grid, gutters 24 px (TG-2A §7/§9).
- **Content row:** labels `text-body-sm`, values `text-body`/`text-heading` with `tabular-nums`, metadata `text-caption` muted.
- **Avoid:** identical rectangles everywhere, generic disconnected cards, dashboard-template aesthetics. Differentiation comes from **data shape** (distribution bars, segmented rails, compact device clusters), not from decorative card dressing.

### 8.2 Module visual language (contract detail in §50)

| Module | Visual language |
|---|---|
| **Command Header** | Shell frame (Topbar lineage): org identity, role, clock, last-refresh stamp, primary commands. Sits on the Command Horizon boundary (§12). |
| **Operational State** | The one headline element: state chip + reason line + primary counts. Highest contrast block on the surface (§19). |
| **Attention Rail** | A unified, deduplicated, prioritized list of attention items with severity geometry + icon + copy (§20). |
| **Fleet Intelligence** | Segmented operational indicators (online/offline/live/recent/stale distribution), compact device rows/clusters (§21). |
| **Security Intelligence** | Severity distribution bars, scan-coverage segment, worst-verified-risk chip, scan-age stamp (§22). No fake score. |
| **Operations** | Unified operation rows: backups/scans/reports with running/pending/failed/completed states (§23). |
| **Activity** | Audit timeline, Owner/Admin only, honest absence state (§24). |
| **Quick Commands** | Compact command surface with icons + badges, role-filtered (§25). |

---

## 9. Interaction Plane

Spatial response to pointer, keyboard, hover, selection, press, navigation, expansion, filtering, refresh.

| Interaction | Response | Constraint |
|---|---|---|
| Pointer presence | Shell-level parallax on decorative planes only (reuse `--tf-px`/`--tf-py` grammar; rotation ≤ ±0.7°, parallax ≤ 6 px). Never on data. | Decorative planes only; `pointer-events-none`; removed under reduced motion. |
| Hover | 1–2 px elevation + localized edge illumination on interactive surfaces. No card tilting, no cursor-following, no perspective tricks. | Primary actions only for micro-3D; affordance, never sole carrier of info (TG-3 §12). |
| Keyboard focus | `:focus-visible` ring (`--ring` 2px) + calibration edge on panels/rails; logical tab order; focus never trapped. | Mandatory on every interactive element. |
| Selection | Unmistakable selected state (edge + tint + text), never color-only. | Selection survives sort/filter predictably. |
| Press | 1 px compression on the pressed surface, `ease-signal` 100–150 ms. | Engineered, not bouncy. |
| Navigation | Shared transition language (§17), ≤ 200 ms, direction + depth. | No cinematic transitions. |
| Expansion | Panels expand with height/opacity 200–300 ms; content only, no mount churn (TG-2A :2401). | `aria-expanded` where collapsible. |
| Filtering | Active filters visible, countable, removable (TG-3 §12). | URL-sync where relevant. |
| Refresh | "Last refreshed" stamp updates; only *changed* cells fade 300 ms. | No full-table re-animation (DASH-02 §19). |

**Rules:** NO aggressive card tilting, NO mouse-following gimmicks, NO excessive perspective. Interaction is "2D carries intent, 3D carries context" (R2 :60).

---

## 10. Attention Plane

Attention exists **above** ambient visual activity. Distinct behavior per severity — never color alone. Combine geometry, iconography, position, motion, copy, and contrast.

| Level | Geometry | Icon | Position | Motion | Copy | Contrast |
|---|---|---|---|---|---|---|
| **INFO** | Calibration chip (radius-sm) | Info-circle (`signal`) | Native location, rail lower order | None or 150 ms settle | "All clear — no items require attention" or informational item | Normal body contrast |
| **WARNING** | Warning chip + edge tick | Triangle (`caution`) | Rail, above info | 200 ms single arrival | Reason text + age ("3 high-severity findings · 12m ago") | Elevated emphasis |
| **DEGRADED** | Calibration break (edge segment in warning) | Triangle + count | Rail + state banner reason | 300 ms confirm, no loop | Failure reasons with destination links | Warning tint + text |
| **CRITICAL** | Octagon icon + persistent edge + `role`/`aria-live` placement | Octagon (`critical`) | Top of rail + state banner | 400 ms edge brighten, held quietly; no red alarm, no flash | Actionable What/Why/Next copy (TG-3 §11) | Highest local contrast |
| **UNKNOWN** | Neutral mark, no confident geometry | Help/unknown glyph | Rail "status unavailable" position | None | "Attention status unavailable" + Retry | Muted, distinctly non-healthy |

**Redundancy law (P6):** severity is always icon + text (+ color). Never a colored dot alone (TG-2A §41.4; DASH-02 §24). Attention never uses continuous pulsing (TG-2A :2362, :2370).

---

## 11. Command Center Composition

The page is an **operational composition**, not a header + grid of cards.

### 11.1 Primary composition (1920 × 1080)
```
┌────────────────────────────────────────────────────────────────────────┐
│ COMMAND HORIZON boundary (shell baseline: Topbar calibration rail)      │
│ CommandHeader — org · role · clock · last-refresh · primary commands    │
├────────────────────────────────────────────────────────────────────────┤
│ OPERATIONAL STATE — state chip · reason line · total/online/offline     │
│ (Signal Field sits behind this band as its distributed glow)            │
├───────────────┬──────────────────────────────────────┬─────────────────┤
│ ATTENTION     │ FLEET INTELLIGENCE                    │ OPERATIONS      │
│ RAIL          │ (segments + compact device clusters)  │ (backups/scans/ │
│ (L2 · ~320px) ├──────────────────────────────────────┤ reports rows)   │
│ critical      │ SECURITY INTELLIGENCE                 ├─────────────────┤
│ high          │ (severity bars · coverage · risk)     │ QUICK COMMANDS  │
│ offline/fail  ├──────────────────────────────────────┤ (compact grid)  │
│ no-alert state│ ACTIVITY (Owner/Admin) timeline       │                 │
└───────────────┴──────────────────────────────────────┴─────────────────┘
```

### 11.2 Visual hierarchy (top to bottom)
1. **Operational State** — the answer to "is my environment healthy right now?" (highest contrast, ~1 s comprehension).
2. **Attention Rail** — "what needs me now?" (the only bright layer when items exist).
3. **Fleet Intelligence** — "which devices are active?" (the fleet as field).
4. **Security Intelligence** — "are there security issues?" (truthful counts, no fake score).
5. **Operations** — "are jobs running or failing?" (unified operation rows).
6. **Activity** — "what changed recently?" (Owner/Admin only).
7. **Quick Commands** — "what should I do next?" (routing rail).

### 11.3 Layout laws
- One primary signal per surface (Bible :582): the Operational State + Attention combination.
- ~9-panel cap on the dashboard surface (TG-2A :2611); the Command Center uses 8 modules + Signal Field layer.
- Every module either reports state, routes to the owning specialist surface, or performs one real supported action (DASH-02 §3 interaction contract).
- Modules differentiate by data shape, not card dressing.

---

## 12. Command Horizon Evolution

Authentication established the Command Horizon (R2 :134 — the cross-side ground line at `top-[54%]` with primary gradient center, diamond, and asymmetric ticks). The Command Center inherits it by **generalization, not duplication** (R2 :241 motif generalization; DASH-02 §18).

### 12.1 New role
The Command Horizon becomes **the spatial boundary between system state and operational intelligence**:

- **Above the horizon (system state):** CommandHeader, refresh truth, session identity — the calibrated instrument frame.
- **Below the horizon (operational intelligence):** the Signal Field + data planes — the readout of the machine.
- The horizon line itself is the **calibration baseline** the Signal Field and the module edges align to.

### 12.2 Behavior across the Command Center
- **Shell:** a hairline calibration rail runs across the Topbar baseline and the Sidebar ground line — 1 px `--border`-tone with the primary-gradient center, center diamond, and asymmetric ticks (the R2 grammar, at shell scale).
- **Command Center page:** the Signal Field's calibration baseline reuses the same center-diamond + tick grammar behind the Operational State band.
- **Navigation continuity:** the same horizon rail persists on specialist pages, giving the "deeper into the same room" effect (Bible :464, :481).
- **Reduced motion / mobile:** static hairline; ticks retained as identity; no 3D.
- **Copy discipline:** the horizon is never a literal copy of the auth scene — auth's is a *threshold* (one luminous core, "the only ceremony", Bible :484); the Command Center's is a *working baseline* (distributed field, matter-of-fact).

---

## 13. Data Reactivity

Real data changes the environment. Each response is local, bounded, and truthful.

| Real event (source) | Environment response |
|---|---|
| Device comes online (WS `metrics` / summary) | Signal node enters ACTIVE state: ring lift 0.6, one 300 ms directional pulse, then settle; the fleet count updates (300 ms changed-cell fade). |
| Device offline | Node becomes dormant: ring dims, frame returns to `--border`-tone; row in fleet marked offline; if fleet > 0, an informational attention item appears (DASH-02 §8). |
| New alert (WS `alerts`) | Attention plane activates locally: new rail item enters 200–300 ms; node attention mark + bounded pulse ≤ 3 iterations; rail edge localized illumination. |
| Critical alert / critical finding | State banner edge takes the CRITICAL geometry; `aria-live` polite/assertive per DASH-02 §24; restrained 400 ms edge brighten held quietly. Never a red alarm. |
| Backup running (summary `operations.backups.running`) | An operational route in the Infrastructure plane carries a slow dash; the Operations row shows indeterminate progress on that item only. No global spinner. |
| Backup completed (summary) | Brief completion confirmation: check glyph + 300 ms single-pass settle ("quiet confirmation", Bible :415). Stillness returns. |
| Backup failed (24 h) | Row marked (attention color + text); attention item; failure route shows a short break then freezes. No celebratory motion. |
| Security finding critical/high | Security region receives controlled emphasis: severity bar cell highlights 300 ms; worst-risk chip updates; routes to Cybersecurity. |
| No data (fleet = 0) | Environment becomes intentionally quiet: NO_DATA field (dormant horizon), onboarding dominant (§38). |
| Unknown (summary failure) | Environment becomes quiet and explicitly unknown: UNKNOWN state, retry, never healthy (§39). |
| Data refresh | Only changed cells fade 300 ms; "Last refreshed HH:MM" updates; no table re-animation (DASH-02 §19). |

**Rule:** every reaction is anchored to a named contract field. If the field is absent, there is no reaction.

---

## 14. Reactive Lighting

Lighting is information. Five lighting registers, all restrained, localized, never decorative neon.

| Register | Trigger | Treatment |
|---|---|---|
| **Ambient** | Always (base) | Two tonal washes ≤ 5% alpha + faint primary horizon illumination. Never changes with data. |
| **Focus** | Pointer/keyboard focus on an interactive surface | Localized light pool behind the focused control (≤ `primary/0.07`), following the auth "answer light" grammar (R2 :130). |
| **Attention** | New attention item | Localized pool on the rail item + its Signal node (≤ `primary/0.10`, or semantic tint for severity). Bounded, 2–3 pulses max. |
| **Critical** | Critical state | Restrained `critical`-tone illumination on the banner edge + affected node only. Held quietly. No screen flash, no full-screen wash, nothing > 3 Hz. |
| **Operation** | Operation running/completing | Running: subtle route dash (not a glow). Completing: 300 ms single-pass confirmation light on the completed row. |
| **Completion** | Job completed | Brief confirmation light (check + settle), then stillness. |

**Lighting laws (Bible :298, :317; TG-2A :516):** light answers a question; the environment is unlit by default; color as decoration is forbidden; surfaces absorb, data emits.

---

## 15. Depth Model

A consistent depth scale across the Command Center. Depth is communicated through scale, blur, shadow, opacity, border intensity, lighting, and movement — **not perspective distortion alone**.

| Level | Name | Communication | Example |
|---|---|---|---|
| **Z0** | Environment | Deepest matte surface, lowest contrast, no border | Atmosphere washes, background |
| **Z1** | Infrastructure | Receding grid + calibration baseline at ~10% border alpha, no shadow | Infrastructure plane, Signal Field base |
| **Z2** | Passive intelligence | Slightly raised surface tint, hairline border | Signal Field nodes, background module frames |
| **Z3** | Operational modules | `surface-subtle`/`surface-muted` + `border` + `shadow-card`; crisp edges | Fleet / Security / Operations / Activity modules |
| **Z4** | Active interaction | Elevated surface, `shadow-elevated`, 1–2 px rise, focus ring | Buttons, commands, hover states |
| **Z5** | Attention / overlay | The only layer allowed above everything; localized illumination + high contrast | Attention rail items, critical edge, dialogs/command palette |

**Depth rules:**
- Separation by edge + surface tint, not glow (Bible :240).
- Only Z4/Z5 may exceed data-plane contrast, and only momentarily.
- Parallax moves Z0–Z2 (decorative) only; Z3+ never moves for effect.
- One focal depth per moment (Bible :239): Z5 bright, everything else dims slightly; or Z3 dominant, Z5 quiet.

---

## 16. Micro-Physics

Restrained interaction physics. The UI must feel **engineered, not bouncy, not playful**.

| Behavior | Spec | When |
|---|---|---|
| Button compression | 1 px Y displacement on `:active`, `ease-signal` 100 ms | All pressable controls |
| Surface response | 1–2 px micro-elevation + edge illumination on hover | Interactive surfaces only |
| Micro elevation | `shadow-elevated` on the hovered/selected surface | Interactive modules, primary actions |
| Signal attraction | A node/route pulse subtly accelerates toward a just-changed element (one pass) | Real state-change events only |
| Spring settling | Overshoot ≤ 2 px, or none; settle 150–200 ms | Panel expansion, toast, rail item arrival |
| Controlled inertia | None by default; only scroll on lists, native | — |

**Forbidden physics:** elastic/bounce easing curves (TG-2A :2309), magnetic elements, card tilting, cursor-following, physics that imply playfulness. Micro-physics exist only where interaction benefits from "the machine answering" — never as entertainment.

---

## 17. Navigation Continuity

Transitions from Command Center into Devices, Security, Jobs, Network, Reports, and Remote Support must feel like **moving deeper into the same TechFusion environment**.

### 17.1 Shared transition language
| Property | Spec |
|---|---|
| **Direction** | Deeper (content resolves toward the user); never sideways "page slide" theatrics. Implemented as the existing layout `AnimatePresence` fade/slide (0.2 s) — preserved, not replaced. |
| **Depth** | The shell horizon rail persists; the destination page inherits the same calibration baseline, materials, and vocabulary. Only data density changes. |
| **Duration** | ≤ 200 ms; single-pass; no entrance choreography on data modules. |
| **Context preservation** | Shell (Sidebar, Topbar, horizon rail) never re-renders or jumps; scroll position of the shell is stable; focus follows content. |
| **Reduced motion** | Fade-only ≤ 80 ms or instant (TG-2X :3339). |

### 17.2 Continuity carriers
1. **Command Horizon rail** on the shell (§12) — the same baseline everywhere.
2. **Material family** (§26) — identical surfaces, one product universe.
3. **Calibration edge** (§27) — same machined geometry on every surface.
4. **Typography/light** (§28, §30) — same voice, same semantic light.
5. **Shared vocabulary** — module titles and labels match specialist pages (no renaming).

### 17.3 Explicit non-goals
No cinematic page transitions, no view transitions that obscure the screen's state, no per-page signature animations, no scroll-triggered motion on persistent chrome (TG-2A :2401–2403). "The threshold is the only ceremony" (Bible :484).

---

## 18. System State Environment

Environmental response per system state. Each state has a distinct environmental signature so a professional reads state from the room, not just from one banner.

| State | Environmental signature |
|---|---|
| **OPERATIONAL** | Calm constellation, dim illumination, stillness. The field "holds its breath" — confident, quiet. |
| **ATTENTION** | Localized pools on affected nodes; rail is the only bright element; the rest dims 5–10% so attention lands once. |
| **DEGRADED** | Warning calibration breaks on banner edge + affected regions; field unchanged elsewhere; no global tint. |
| **CRITICAL** | Banner edge + affected node take critical geometry; localized illumination held quietly; `aria-live` active. The room narrows focus to one truth. |
| **NO DATA** | Intentionally dormant: no constellation, quiet horizon, onboarding teaches. Felt as "ready, waiting" — never broken. |
| **UNKNOWN** | Neutral retreat: no confident light anywhere; banner shows UNKNOWN + Retry; distinctly non-healthy. |

**Critical rules (DASH-02 §7 honesty):**
- UNKNOWN must never resemble OPERATIONAL.
- NO DATA must feel intentionally dormant rather than broken.
- Stale data freezes the last confirmed state with a stale note — never re-derives on empty inputs, never pretends fresh.

---

## 19. Operational State Hero

The highest-priority Command Center information: **system state within approximately one second**.

| Property | Spec |
|---|---|
| **Placement** | Top of the content column, directly under the Command Header; full-width band; the Signal Field's calibration baseline sits behind its lower edge. |
| **Typography** | State label at `text-display` (28px/1.3, 600), reason line at `text-body`; counts at `text-heading-lg` with `tabular-nums`. No giant marketing headline. |
| **Status geometry** | A state chip (radius-sm, calibration tick) + an edge segment that reacts to derived state (DOM-state-driven CSS, no JS frames). |
| **Signal Field relationship** | The band is the "reading" of the field: the constellation behind it resolves into the stated truth. |
| **Supporting metrics** | Total / Online / Offline, last-refresh stamp (`generatedAt`), per DASH-DATA-01 `fleet`. |
| **Attention relationship** | Reason list ("2 critical alerts · 1 failed backup") is the auditable bridge to the Attention Rail; each reason is a route to the owning page. |
| **Loading** | Skeleton banner + count skeletons. |
| **Empty** | NO DATA + "Connect a device to begin" (onboarding dominates). |
| **Error** | UNKNOWN + Retry; never a fake healthy. |
| **Reduced motion** | Static chip + edge; no pulse. |

The hero is an **operational reading**, not a marketing statement. One glance answers: *Is my environment healthy right now?*

---

## 20. Attention Rail

A high-information attention surface: prioritized, compact, actionable, scannable, state-aware.

### 20.1 Composition
- Left column (desktop, ~320 px) or top strip (tablet/mobile, DASH-02 §23).
- Items from DASH-02 §11 attention model: unacknowledged alerts (severity, device, message, age), open critical/high findings, failed backup runs (24 h), offline devices (fleet > 0), failed scans (24 h). Max 8–12 items.
- Dedupe key `(kind, sourceId)`; ordering severity then age; every item maps to exactly one owning page.

### 20.2 Row anatomy
`severity geometry` + `icon` + `message (truncated)` + `age stamp` + `ack action (alerts)` → click routes to owner.

### 20.3 States
| State | Presentation |
|---|---|
| **Loading** | Skeleton rows |
| **Clear** | Positive confirmation: "All clear — no items require attention" (text + icon; never silent emptiness) |
| **Items** | Severity-ordered actionable rows with explicit age |
| **Unavailable** | "Attention status unavailable" + Retry (WS failure falls back to REST per socket-client contract) |
| **Stale** | Items show age; > 30 min unrefreshed → stale note |

### 20.4 Constraints
- Not a notification feed: no endless scroll, no silent dismissals, max 8–12, each item actionable or routed.
- Acknowledge alert performs `POST /alerts/:id/acknowledge` and removes it immediately.
- No-alert state is always rendered as positive confirmation.

---

## 21. Fleet Intelligence

Represent real total / online / offline / freshness / recent devices without generic stat cards.

### 21.1 Preferred representation
1. **Segmented operational indicator** — a single continuous segment bar: live (≤60 s) / recent (≤5 min) / stale (>5 min) / unavailable bands (real `freshness` counts), with the online count as the leading value. This is one truthful, compact "fleet as a field" reading.
2. **Compact spatial device group** — small grid of device glyphs (recent devices) using presence styling, each row/name linked to `/dashboard/device-health/[id]`.
3. **Count readout** — total / online / offline as precise `tabular-nums` values beside the segment (redundancy with the visual).

### 21.2 Rules
- Uses `isDeviceOnline` / `classifyFreshness` from `lib/device-presence.ts` **unchanged** (contract).
- No client-side `round(online/total*100)` "health" surrogate on home (DASH-02 §8); fleet health stays on Device Health.
- Offline devices (fleet > 0) surface in the Attention Rail as informational items — never fabricated "risk".
- Empty: "No devices connected" + Connect command (→ onboarding). Error: "Unable to load fleet" + Retry.
- Accessibility: segment has a visible numeric equivalent and `aria-label` describing the bands; never color-only.

---

## 22. Security Intelligence

Use the real DASH-DATA-01 contract. Truthful fleet security status — **no fake score, no generic shield percentage, no fabricated posture rating** (DASH-02 §9).

| Data | Representation |
|---|---|
| Open findings (critical/high/medium/low/total) | Severity distribution bars (chart-series/state colors reserved for meaning); counts as `tabular-nums` |
| Worst verified risk | A chip reading `critical` / `high` / `medium` / `low` / "No risk data" (`worstRiskLevel`, null → honest absent state) |
| Scan coverage | Coverage segment (`scannedDevices / onlineDevices`, `coveragePercent` truthful 0, null only when no online devices); "X of Y online devices scanned" |
| Last scan | Age stamp (`latestScanAgesDays` → "Last scan: Nd ago"; beyond ~7-day threshold → `STALE — rescan recommended`, threshold configurable per DASH-02 OD-5) |
| Unscanned online devices | Explicit line "N online devices never scanned" → routes to Cybersecurity |

**Rules:**
- No averaged security score, no shield percentage, no posture grade.
- Severity counts are sums of real open `SecurityFinding` rows.
- Empty: "No security scans have run" + route to Cybersecurity to trigger one. Error: "Security data unavailable" + Retry.
- Command Center routes to Cybersecurity; it does not run scans (ownership, DASH-02 §14).

---

## 23. Operations

A unified operational language for backups, security scans, and reports across running / pending / failed / completed.

| State | Visual |
|---|---|
| **Running** | Indeterminate progress on that item only (thin segment), a slow route dash in the Infrastructure plane; explicitly "Running…" text. No global spinner, no constant animation elsewhere. |
| **Pending** | "Pending" label + muted queue position; calm. |
| **Failed (24 h)** | Failure mark (attention color + text) + age; surfaced to the Attention Rail; no celebratory or alarmist motion. |
| **Completed** | Quiet confirmation (check + 300 ms single pass) then stillness; "Completed X ago". |

**Module anatomy (one unified row family):**
- Backups: running count · failed (24 h) · last completed (name + time) · next scheduled.
- Scans: running · failed (24 h).
- Reports: generating · failed · generated last 30 days.
- Each row routes to its owning page (Backup / Cybersecurity / Reports).
- Empty: "No backup jobs configured" / "No reports yet" + route. Error: "Operations status unavailable" + Retry.
- Near-realtime only while a run is active (5 s, mirroring `useBackupRuns`); otherwise on-demand + focus refresh (DASH-02 §22).

---

## 24. Activity

Follows DASH-02 ownership rules (§12). **No fabricated universal activity stream.**

- **Source:** real `AuditLog` via `GET /audit/logs` (Owner/Admin) — last 10 rows mapped to human labels; fallback `GET /admin/dashboard` → `recentActivity`.
- **Permission:** Owner/Admin only. For Technician/Viewer the module is **omitted entirely** (clean role-based scope, never a degraded error).
- **Permission/absence state (Owner/Admin, no rows):** "No system activity recorded yet" (empty state that teaches).
- **Error:** "Activity unavailable" + Retry. **Stale:** timestamps + "as of X".
- **Prohibition:** no fake timestamps, no synthesized events, no mixing device-list changes into a universal feed.
- **Row anatomy:** action label · actor · target hint · timestamp; click routes when target is resolvable.

---

## 25. Quick Commands

Quick Commands are **operational controls**, not shortcut cards.

| Property | Spec |
|---|---|
| **Surface** | Compact command surface (radius-md, elevation Z4): icon (16 px, `lucide-react`) + label + optional real badge (e.g., unresolved alerts count). Grid or column; role-filtered. |
| **Icon behavior** | Icons support meaning; a live badge is a real count, never decoration. |
| **Focus** | Visible `:focus-visible` ring + edge illumination; full keyboard operability (Tab/Enter). |
| **Hover** | 1–2 px rise + edge illumination; no tilt. |
| **Keyboard** | Every command reachable by keyboard; ⌘K palette remains the power path. |
| **Permission states** | Per command (most: all roles; Team/Enrollment-style: Owner/Admin). Hidden, not disabled-with-excuse. |
| **Confirmation** | No destructive command on home (DASH-02 §13 policy). Commands that route to specialist pages carry their own confirmation there. Acknowledge alert performs the ack action and confirms via toast. |

**Command set (DASH-02 §13):** Connect Device, View Alerts (badge = unresolved count), Open Cybersecurity, New Backup Job, Run Network Discovery, Generate Report, Ask AI Assistant, Invite Teammate (Owner/Admin), Acknowledge alert (API action).

---

## 26. Material System

Every TechFusion material has a **functional reason**. Avoid excessive glassmorphism; backdrop blur is overlay-only, never a base surface treatment (TG-2A :735).

| Material | Definition | Functional reason |
|---|---|---|
| **Operational Glass** | Existing `GlassPanel`/`glass-card`: `rounded-xl`, `border-border`, `bg-surface-subtle/60`, `shadow-card`. **Refined:** matte tint, hairline border, no strong blur by default (backdrop-blur ≤ `sm` on desktop only). | Standard module surface; transparency only where layering aids scanning. |
| **Precision Surface** | `surface-muted` / `surface-subtle` + calibration tick header. | Section frames for Fleet / Security / Operations / Activity; the "machined" readout beds. |
| **Signal Surface** | Very subtle primary-tint overlay (≤ 5%) used only behind live signal geometry. | Signal Field base; implies infrastructure without glow. |
| **Infrastructure Surface** | `--border`-tone grid + ticked baseline on `background`. | The setting; never competes with data. |
| **Attention Surface** | Slightly elevated surface + localized illumination (≤ `primary/0.13` or semantic tint); edge reaction. | The only bright surface; exists only when attention exists. |
| **Elevated Command Surface** | `surface-elevated` + `shadow-elevated` + focus ring. | Interactive controls, commands, primary actions. |

**Material laws (Bible §5, :258–264):** matte, machined, "as though it could be machined, tested, and shipped." Forbidden: glossy chrome, cheap/startup glass, neon plastic, holographic foil, ice/crystal, glass-for-prettiness.

---

## 27. Borders & Geometry

TechFusion must have **recognizable geometry** — not standard rounded SaaS cards.

### 27.1 Corner radius hierarchy (from TG-2X)
| Token | Value | Use |
|---|---|---|
| `radius-sm` | 4 px | Status chips, tags, dense data, calibration ticks, alert bars |
| `radius-md` | 8 px | Buttons, inputs, list rows, table cells, command surfaces |
| `radius-lg` | 12 px | Modules/panels, command palette (TG-2A :650) |
| `radius-xl` | 16 px | Large modals only |

### 27.2 Border intensity
- `border-subtle` — resting module edge.
- `border` — module frame, section dividers.
- `border-strong` — hover/focus-active edges.
- `border-interactive` + `--ring` (2 px) — focus.
- Active edge: a 2 px calibration edge on the left of the current module/section (DOM-state-driven).

### 27.3 Calibration marks & section geometry
- Every section header is preceded by a **calibration tick** (small L-shaped mark or 2 px × 6 px tick in `border-strong`/`primary`).
- Modules carry **corner registration marks** (2 px L-marks at two corners) — machined, not decorative-glow.
- The Operational State band and Attention Rail share a **calibration baseline** derived from the Command Horizon.
- **Signal connectors:** where a module relates to the Signal Field, a hairline connector (1 px, `border-subtle`) implies the link; it brightens only on real events.

---

## 28. Typography

Highly readable first; futuristic display fonts are forbidden for body data (TG-1A §13; TG-2A §6).

| Role | Spec |
|---|---|
| **System state** | `text-display` (28px/1.3, weight 600, `-0.02em`) — state label |
| **Page identity** | `text-heading-lg` (20px) — "Command Center" |
| **Section labels** | `text-overline` (11px/1.4, weight 600, `+0.08em`, uppercase) — calibration ticks + headers |
| **Metric values** | `text-heading`/`text-heading-lg` with `tabular-nums` |
| **Operational metadata** | `text-body-sm` (13px) secondary |
| **Timestamps** | `text-caption` (12px) muted, monospace per TG-2A :436–444 |
| **Device names** | `text-body` semibold, monospace variant for hostnames/IPs |
| **Status labels** | `text-body-sm` semibold, always with icon (never color-only) |
| **Commands** | `text-body` medium |
| **Technical identifiers** | `font-mono` (`font-family-mono`), `text-caption`/`text-body-sm` |

**Rules:** Inter is the single family (TG-2X :303). Mono reserved for telemetry, IPs, timestamps, identifiers. Numerals always `tabular-nums`. Numbers are sacred (TG-1A §14): exact, units correct, never distorted. Mobile: one step down per TG-2A §6.4.

---

## 29. Iconography

Precise, consistent, technical, minimal.

| Property | Spec |
|---|---|
| **Set** | `lucide-react` (already in use) — stroked, 1.5–2 px weight, 45° corners (TG-2A §13). |
| **Sizes** | 16 px UI / 20 px contextual / 24 px chrome. |
| **Status icons** | Filled only for status: success = check/go, warning = triangle/caution, critical = octagon/critical, info = info-circle/signal (TG-2A :1602–1607). |
| **Support** | Icons support meaning; never icon-only status where accessibility requires text. Icons never carry meaning alone (TG-2A :756). |
| **Signal Field** | No icons in the field; geometry only (frames/rings/anchors). |
| **Empty states** | 32×32 px glyph-in-panel (TG-2A §32); illustrations forbidden in dashboard chrome. |

---

## 30. Semantic Light / Color

Specification-level recommendations only — **do NOT redefine global theme tokens yet** (implementation token work is a DASH-IMPL decision gated by this direction).

| Token intent | Existing token | Use |
|---|---|---|
| Neutral / base | `--background`, `--card`, `--surface-subtle/muted/elevated`, `--border-subtle/strong`, `--text-primary/secondary/muted` | The entire surface; matte, dark default |
| Active / brand | `--primary` (signal blue family) | Active nodes, focus, links, primary actions, calibration ticks |
| Success / operational | `--success` (desaturated go) | OPERATIONAL state, online, completed ops |
| Warning | `--warning` (caution) | DEGRADED, warnings, failed-with-note |
| Degraded | `--warning` derivative / `surface-interactive` | DEGRADED state, calibration breaks |
| Critical | `--danger` / `--critical` (destructive) | CRITICAL state, critical findings/alerts |
| Unknown | Neutral gray `offline`-tone; **no semantic color** | UNKNOWN state — never green, never confident blue |
| Information | `--info` / `--primary` | Informational items, coverage segments |

**Rules (TG-2A §5; Bible :516):**
- Color reserved for meaning; nothing decorative uses semantic colors.
- Avoid rainbow dashboards: at most one prominent semantic color per moment (one focal depth).
- Severity colors appear in severity contexts only.
- Contrast: all text ≥ 4.5:1, UI components ≥ 3:1, measured (WCAG 2.2 AA).
- Cyan (`optic`) remains reserved for AI surfaces; it is not used for Command Center status.

---

## 31. Data Visualization

Charts are **not** required for Command Center V1. Do not add charts simply because this is a Dashboard (DASH-02 §25; TG-2A §37).

### 31.1 V1 visualization inventory (all small and truthful)
| Visualization | Answers | Data |
|---|---|---|
| Fleet freshness segment | "How fresh is my fleet?" | `fleet.freshness` bands (live/recent/stale/unavailable) |
| Severity distribution bars | "How many findings per severity?" | `security.openFindings.*` |
| Scan coverage segment | "What fraction of online devices are scanned?" | `security.scanCoverage` |
| Operation progress (item-level) | "Is this job done?" | `operations.*` running/pending/completed |
| Sparklines | Only with real historical data — **deferred** (no V1 history contract) | — |

### 31.2 Rules
- **Prefer line > bar > pie**; never 3D charts; never pie-by-default (TG-2A :1915).
- Honest axes, explicit units, last-known values, no truncated-baseline exaggeration (TG-2A §39).
- No decorative donuts, no fake trends, no synthetic deltas (D02 remediation is law).
- Chart colors: `signal` as primary series; `go/caution/critical` reserved for states; categorical color is a chart concern, never per-tag decoration (TG-2X :1619–1632).
- Every visualization has an accessible text/table equivalent (data table or `aria-label` summary).
- Anything beyond the inventory is code-split/lazy-loaded or deferred to specialist pages.

---

## 32. Accessibility

4DX must degrade gracefully. WCAG 2.2 AA is the floor (TG-3 §14).

| Requirement | Contract |
|---|---|
| **Keyboard** | Every element Tab-reachable; no traps; Escape closes overlays; ⌘K palette unchanged; logical focus order. |
| **Visible focus** | `:focus-visible` ring (`--ring` 2 px) on everything; calibration-edge focus on panels/rails. |
| **ARIA** | `role="status"`/`aria-live="polite"` for state banner; `aria-live="assertive"` reserved for CRITICAL changes only; `aria-expanded` on collapsibles; `aria-current` on nav. |
| **No color-only status** | Geometry + icon + copy + contrast + color (§10, §20). |
| **Screen readers** | State banner reads "Environment: Attention Required — 2 critical alerts, 1 failed backup"; counts are labeled numbers, not glyphs. |
| **Decorative layers** | `aria-hidden`, `pointer-events-none`, SVG `focusable="false"`; never intercept keyboard/pointer. |
| **Realtime updates** | WS additions announced politely once; updates not re-announced; dedupe avoids announcement storms (DASH-02 §24). |
| **Touch targets** | ≥ 44×44 px at all breakpoints. |
| **Reduced motion** | Complete degradation per §33. |
| **Contrast** | Text ≥ 4.5:1, large text ≥ 3:1, UI ≥ 3:1; measured, not assumed (AUTH-CERT-01 transparency note applies). |

---

## 33. Reduced Motion

`prefers-reduced-motion: reduce` is **REQUIRED** and complete.

| Effect | Reduced-motion equivalent |
|---|---|
| Parallax | Disabled; pointer vars zeroed; pointer hook attaches no listeners (R2 :153). |
| Continuous signal travel | Disabled; field reads as a static composition. |
| Depth transitions | Disabled; surfaces render at final state. |
| Non-essential spring motion | Disabled. |
| Scan sweeps | Disabled. |
| Attention pulses | Static highlight only (≤ 80 ms fade or none). |
| Count-up / AnimatedNumber | Static final values (existing `useReducedMotion` gate). |
| Data-change fades | Fade-only ≤ 80 ms or instant (TG-2X :3339). |
| Route transitions | Fade-only ≤ 80 ms or instant. |

**Retained under reduced motion (nothing lost):** all information, state differentiation (via geometry/icon/copy/contrast, not motion), hierarchy, interaction, and identity.

---

## 34. Performance Contract

**RELEASE CRITICAL.** The interface must remain fast. Budgets from DASH-02 §25 and TG-3 §13, made binding:

| Item | Budget / rule |
|---|---|
| Animation count | Idle: 0–1 slow ambient flow (decorative planes only). Attention: bounded, finite. Nothing > 3 Hz, no loops (TG-2A :2370). |
| Pointer listeners | ≤ 2 passive listeners on the shell; none on data modules. |
| DOM nodes | Bounded by the ~9-panel cap; no hidden render storms. |
| SVG complexity | ≤ ~48 field nodes; low-count paths; no per-frame JS. |
| Blur/filter usage | Overlay-only at elev-2+; never a base surface treatment (TG-2A :735). |
| **Recharts** | Not in Command Center V1 core; code-split if ever approved. |
| **Framer Motion** | Scoped to state transitions; no entrance choreography on data modules; existing layout transition preserved. |
| **Three.js / WebGL** | **NOT part of Command Center V1.** Feature-specific to NetworkMap only; if ever needed, lazy-load via `next/dynamic` + `ssr:false`. |
| **requestAnimationFrame** | Only where absolutely necessary (count-up on ≤ 4 headline numbers, reduced-motion-gated; pointer parallax driver on decorative planes only). |
| Polling | Exactly 1 surface poller (summary, visible-only) + 1 conditional backup poller + 1 WS subscription (DASH-02 §25). Paused when hidden (D10). |
| Rerenders | Immutable summary snapshots; `useMemo`/`useCallback`; derived state memoized. |
| Request count | First meaningful paint: 2–3 requests (summary, session, audit-if-owner). |
| Bundle impact | No experience adds > 60 KB gz new JS; dashboard entry ≤ ~300 KB gz (DASH-02 §25). |
| CPU idle | ≤ 10% during idle polling (TG-3 §13). |
| Memory | No growth over a 30-minute active session (TG-3 §13). |

**Rule:** prefer event-driven animation over continuous animation. CSS transforms/opacity only. No layout-property animation.

---

## 35. Low-Power Mode

A graceful low-power experience preserving Data, Hierarchy, Interaction, and Identity while reducing ambient motion, blur, parallax, and signal animation.

**Triggers:**
- `prefers-reduced-motion` (always honored)
- Small mobile device (handled by responsive tiering §36)
- Low visual viewport
- Future explicit performance mode (a documented hook point, not a V1 feature)

**Behavior in low-power mode:**
- Ambient/decorative animation removed (Signal Field becomes a static composition or horizon line).
- Blur reduced/removed (backdrop-blur → none on modules; overlay blur retained only where contrast requires).
- Parallax disabled.
- Signal animation: static marks retained, travel removed; attention/state still conveyed by geometry/icon/copy/light.
- All data, hierarchy, interaction, and identity preserved.

---

## 36. Responsive 4DX

Separate experiences per breakpoint. **Mobile never attempts to reproduce the desktop Signal Field.** Identity survives through geometry, localized signals, depth, and state transitions.

| Viewport | Experience |
|---|---|
| **1920+** | Full spatial environment: full constellation, wide grid (`container-wide` 1600 px for command surfaces, TG-2A :514), attention rail left, operations/commands right. Dense but readable; calibration edges keep scanning fast. |
| **1440** | Default design target. Same composition, slightly narrower gutters. Full constellation. |
| **1280** | Two-column main; attention rail collapses to a top strip under the state band; modules stack in 2 columns. Field reduced to a calibration horizon + reduced constellation. |
| **1024** | Single-column stack; attention strip above the fold; device table → card/row list; field = horizon line only (no node rendering, DASH-02 §23). |
| **768** | Full single-column; Quick Commands collapse to a horizontal scroll row; Activity moves behind "View all"; header condensed (org name only). |
| **390** | Data-first: Operational state + Attention at top; essential fleet counts; primary commands (Connect Device, View Alerts); **security/operations/activity deferred** behind "View all" routes to specialist pages. Never fake desktop density. |
| **320** | Same as 390, tighter; state reasons truncated with "View" routing; touch targets ≥ 44 px. |

**Rules:** no horizontal scroll at any supported width; function parity (presentation degrades, capability never does); pointer and touch both first-class; identity retained via calibration horizon + localized signals + depth, never via a shrunken desktop.

---

## 37. Loading Experience

Truthful loading states — no generic spinner-everywhere (TG-2A §38; X :3312 "faceplate waiting for its readings").

| State | Presentation |
|---|---|
| Module loading | Structural skeleton ("faceplate"): still shapes, quiet sweep, nothing strobing. Use existing `Skeleton` composables (auto-static under reduced motion). |
| Signal Field loading | Dormant signal topology: dim calibration horizon + empty node anchors at base alpha — infrastructure present, readings not yet arrived. **Never imply data before data arrives.** |
| Localized initialization | Per-module skeletons with overline placeholders ("Reconciling device states…" — says what is happening, claims nothing, TG-3 §11). |
| Route loading | Existing per-route `loading.tsx` skeletons (D09 adds the two missing ones). |

**Rules:** never claim success before it occurs; skeleton shapes match final geometry (no layout shift on resolve); no spinning loaders as the primary pattern.

---

## 38. Empty / No Data Experience

NO DATA is a legitimate system state. It is designed intentionally, never filled with fake metrics (TG-3 §11 empty-state rules).

| Situation | Presentation |
|---|---|
| No devices | DASH-01 `OnboardingFlow` dominates (preserved real flow); Signal Field NO_DATA (dormant horizon, no constellation); banner "Connect a device to begin". |
| No alerts | Attention rail: "All clear — no items require attention." |
| No scans | Security: "No security scans have run" + route to Cybersecurity. |
| No backups | Operations: "No backup jobs configured" + route to Backup. |
| No reports | Operations: "No reports yet". |
| No activity | Activity: "No system activity recorded yet" (Owner/Admin). |
| No team data | Team count renders "—" (honest null, DASH-03/DASH-DATA-01 law). |

**Empty-state anatomy (per module):** 32×32 px glyph-in-panel + title + description that teaches + one primary action. No celebratory confetti; no fabricated zeros presented as facts (real zeros are fine and truthful).

---

## 39. Unknown / Failure Experience

Critical: if the summary endpoint fails, the Command Center must **never appear healthy** (DASH-02 §7).

| State | Presentation |
|---|---|
| **UNKNOWN (summary endpoint failure)** | State banner shows UNKNOWN + Retry; Signal Field retreats to neutral; security/operations modules show "data unavailable" + Retry. No green, no confident blue, no derived numbers. |
| **Data unavailable (module-level)** | Module shows its explicit unavailable state + Retry, matching its own data contract. |
| **Retry behavior** | Manual Retry always present; polling backoff per D10 (exponential backoff to a cap, reset on success); visible "Retrying…" with calm copy. |
| **Partial failure** | Available modules render their real data; failed modules render unavailable individually. Never a whole-page error for one failed module. |
| **Stale state** | See §40. |

**Honesty rules:** UNKNOWN is a render state, never a derivation output; no fallback fabrication (`|| 1`, `?? 0` on counts, `?? 100` on health — all forbidden); no stale data rewritten as fresh.

---

## 40. Stale Data Experience

Uses `generatedAt` and real timestamps. No silent stale state; no over-alerting for minor age differences.

| Situation | Presentation |
|---|---|
| Fresh (within refresh budget) | "Last refreshed HH:MM" updates normally; no note. |
| Stale beyond budget | Banner shows "Data may be stale — last updated Xm ago"; **the last confirmed state is frozen** (not re-derived on empty inputs, never rewritten as healthy). |
| Module-level staleness | Devices > 5 min → offline per contract (labeled); scan age beyond ~7 days → "STALE — rescan recommended"; jobs show "last run X ago". |
| Minor age differences | No alert; the stamp speaks for itself (calm, precise — never alarmist). |

---

## 41. Signature Moments

**Eight** carefully selected signature moments (5–8 allowed; we define 8). Each is subtle, recognizable, and state-driven — never cinematic.

| # | Moment | Trigger | Behavior |
|---|---|---|---|
| 1 | **Command Center initialization** | Page mounts after auth | Signal Field resolves from dormant horizon into constellation (~0.5 s, staged `tf-resolve`-style opacity 50 ms offsets, R2 :61/:76); skeleton faceplates settle into real modules; calm arrival. |
| 2 | **Operational state resolution** | Summary resolves / state changes | The state chip + edge settle to the derived state (R0–R4); one deliberate 300–400 ms settle; the field's calibration baseline aligns with the banner. |
| 3 | **New critical attention** | WS critical alert / critical finding | Attention rail item enters; banner edge takes critical geometry; `aria-live` announces once; restrained 400 ms edge brighten held quietly. |
| 4 | **Device coming online** | WS `metrics` / presence transition | A dormant node rises to ACTIVE with one 300 ms directional pulse; the fleet segment updates; quiet confirmation. |
| 5 | **Operation starting** | Backup/scan/report run begins | Operational route dash begins; the specific row shows indeterminate progress; "Running…" text. No global fanfare. |
| 6 | **Operation completing** | Job completed | Check + 300 ms single-pass confirmation on the row; stillness returns (Bible :415 "quiet confirmation"). |
| 7 | **Opening specialist surface** | Navigate to Devices/Security/Jobs/etc. | The shell horizon rail persists; content resolves deeper (≤ 200 ms); same materials and vocabulary. Context preserved. |
| 8 | **Returning to Command Center** | Navigate back | Calm resume: the field and modules render at their known, last-confirmed state; no replay of initialization if data is fresh (skip the entrance when data is already loaded). |

**Rule:** each moment is a single, legible gesture (Bible :482); motion count stays within the restraint budget; all eight degrade to static equivalents under reduced motion.

---

## 42. No-Go Design Patterns

**Explicitly forbidden:**

- Cyberpunk HUD overload
- Matrix rain
- Random particles
- Fake network traffic
- Constant glowing borders
- Rainbow gradients
- Over-glassmorphism (floating glass cards on bright gradients, Bible :240)
- Excessive blur (blur as a base surface treatment, TG-2A :735)
- Aggressive perspective
- Large rotating 3D objects
- Cards following cursor
- Fake holograms
- Constant pulsing (anything > 3 Hz, TG-2A :2370)
- Automatic sound
- Decorative telemetry (fake activity pretending to be infrastructure)
- Three.js simply for visual spectacle
- Neon / glow / hologram / sci-fi chrome (TG-1A §24; TG-2A §1.4)
- "Urgency theater": flashing alerts, fake red states, alarmist copy (TG-1A §24)
- Gamification: badges, streaks, leaderboards, "level-up" (TG-1A §24)
- Celebration noise / confetti (TG-2A :2706)
- Mascots or cartoon illustration in dashboard chrome (TG-2A §32)
- Color-only status (always geometry + icon + copy + contrast)

**QA gate:** any of these present in an implementation is a Visual Gate / Accessibility Gate finding (TG-2X :4630).

---

## 43. Visual Direction A — "THE SIGNAL FIELD · OPERATIONAL CONSTELLATION"

The distributed evolution of DASH-02's selected signature (Candidate B) into full 4DX.

- **Composition:** The fleet is the composition. A quiet constellation of real device nodes occupies the mid-depth behind the data planes; the Operational State band reads as its calibration reading; modules are machined instruments arranged on the same baseline.
- **Spatial hierarchy:** Z0 atmosphere → Z1 infrastructure grid → **Signal Field (Z2, distributed presence)** → Z3 modules → Z4 controls → Z5 attention.
- **Signal Field behavior:** Nodes = real devices; routes = real relationships; pulses = real events (§5–§6). The field is the data story made visible — nothing shines unless it is true.
- **Material system:** Operational Glass + Precision Surface + Signal Surface (subtle primary-tint base for the field). No glassmorphism.
- **Motion:** Event-driven only; idle = 0–1 slow decorative flow; attention bounded.
- **Data density:** Highest; designed for the professional at 1440–1920.
- **Operational clarity:** High — state, attention, and fleet are each a distinct reading.
- **Performance:** CSS/SVG; ≤ 48 nodes; no WebGL.
- **Accessibility:** Decorative-isolated field; full data duplication; reduced-motion static.
- **Brand strength:** Distinct, unmistakable fleet/operations identity; continuity by generalization from the auth Command Core.

**Honest weakness:** requires discipline to avoid drifting into "dashboard-of-dashboards" visuals or fake topology; node-count caps must be enforced.

---

## 44. Visual Direction B — "THE CALIBRATION CONSOLE · INSTRUMENT BENCH"

The Command Horizon generalized into a full machined console bench.

- **Composition:** The page reads as one instrument panel: every module sits on a shared calibration rail like instruments on a bench; the Signal Field reduces to a background motif behind the header/horizon.
- **Spatial hierarchy:** Everything aligns to ticked baselines; modules are rectangular machined instruments with registration marks.
- **Signal Field behavior:** Constrained to the header band and Attention Rail edge; nodes appear only within module context (not a full constellation).
- **Material system:** Precision Surface + Elevated Command Surface dominate; less Signal Surface.
- **Motion:** Even more restrained — few ambient flows; horizon ticks are static.
- **Data density:** High, but modules dominate (less "field" presence).
- **Operational clarity:** High — very legible instrument layout.
- **Performance:** Excellent (static geometry, minimal animation).
- **Accessibility:** Excellent (fewer decorative layers).
- **Brand strength:** Medium-high continuity with Authentication, but risks reading as "Authentication with more cards" — the distinct fleet identity is weakened (DASH-02 §17 Candidate A weakness).

---

## 45. Visual Direction C — "THE ATTENTION CORRIDOR · SPATIAL CONSOLE"

The environment is organized as a receding corridor along an attention axis.

- **Composition:** A north–south attention axis structures the page; data modules recede on both sides; the Signal Field appears as corridor-side signal runs.
- **Spatial hierarchy:** Attention is the architectural spine (left/north rail); depth recedes along the axis.
- **Signal Field behavior:** Signal flows travel the corridor axis; node clusters align to attention levels.
- **Material system:** Operational Glass + Attention Surface emphasis.
- **Motion:** More directional (corridor flows); still bounded, but a stronger ambient axis exists.
- **Data density:** Medium — the corridor consumes horizontal space.
- **Operational clarity:** Good — attention-first matches the mission's priority order.
- **Performance:** Good — moderate visuals.
- **Accessibility:** Good.
- **Brand strength:** Medium — memorable interaction, weaker visual identity; at mobile widths the corridor collapses and identity is lost (DASH-02 §17 Candidate C weakness). Solves layout, not brand.

---

## 46. Direction Score Matrix

Scored /100 across ten weighted dimensions (max 10 each, total 100). Scores are honest per the stated weaknesses; nothing is inflated.

| Dimension | A · Signal Field | B · Calibration Console | C · Attention Corridor |
|---|---|---|---|
| TechFusion identity | 9 | 7 | 6 |
| Enterprise credibility | 9 | 9 | 8 |
| 4DX quality | 9 | 7 | 8 |
| Operational clarity | 8 | 8 | 8 |
| Information density | 9 | 8 | 8 |
| Performance | 8 | 9 | 8 |
| Accessibility | 8 | 9 | 8 |
| Responsive scalability | 8 | 9 | 7 |
| Maintainability | 8 | 9 | 7 |
| Innovation | 9 | 6 | 7 |
| **Total** | **85** | **81** | **75** |

**Reading the matrix:** B is the safest (highest performance/accessibility/maintainability) but weakest on distinct identity and innovation — it is "Authentication with more cards" risk. C is memorable but solves layout, not brand. A wins on identity, 4DX quality, density, and innovation — the exact dimensions the Command Center exists to claim — with acceptable (budgeted) costs in performance/accessibility that the Performance Contract (§34) and Accessibility Contract (§32) explicitly cover.

---

## 47. Selected Direction

### **Selected: Direction A — THE SIGNAL FIELD · OPERATIONAL CONSTELLATION**

**Why (evidence-based):**
1. **Operational meaning first.** DASH-02 already weighed the candidates and selected The Signal Field (§18) for exactly this reason: a fleet platform's truth is *distributed*, and the field makes the fleet itself the composition. This spec evolves it into full 4DX — it does not replace the decision.
2. **Brand continuity without copying.** Same material grammar and light discipline as certified Authentication, but the one-core geometry becomes a field (R2 :241 motif generalization; DASH-02 §18). Unmistakably related, unmistakably a different space in the same universe.
3. **Truth by structure.** A node exists only if a device exists; a pulse only fires on a real event; a route only brightens on a real flow. The zero-fake law is satisfied *structurally*, not just by policy.
4. **Performance is tractable.** CSS/SVG only, ≤ 48 nodes, zero WebGL — the field is bounded by real fleet size and capped for render (§34).
5. **Accessibility is clean.** The field is decorative-and-isolated with full data duplication; reduced motion renders it static (§5, §33).
6. **Scalable.** Works from 320 px (horizon line) to 1920+ (full constellation); state-driven via DOM state, not JS frames.

**Identity statement (authoritative for DASH-IMPL-01/02):**
> **The Command Center is a quiet field of instruments. Nothing glows unless something is true — and when something is true, it is actionable.** (DASH-02 §18, confirmed and made binding)

**Adopted architecture (from Direction A):**
- Six-layer stack L0–L5 (§4), depth Z0–Z5 (§15).
- Signal Field architecture §5–§6 with seven states.
- Material system §26, geometry §27, type §28, icon §29, light §30, data viz §31.
- Eight signature moments §41.
- Performance contract §34, accessibility §32, reduced motion §33, low-power §35, responsive §36.

---

## 48. Desktop Blueprint

### 48.1 1920 × 1080
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Command Header  [TF logo] Org · Role · Plan      Clock · Last refreshed 14:32  │
│ ════════ Command Horizon calibration rail (topbar baseline) ════════════════ │
├──────────────────────────────────────────────────────────────────────────────┤
│ OPERATIONAL STATE  ● OPERATIONAL  24 total · 22 online · 2 offline          │
│                    "1 failed backup (24h) · 1 offline device"   [Refresh]    │
│      ── calibration baseline + Signal Field constellation glow ──            │
├───────────────┬────────────────────────────────────────────┬────────────────┤
│ ATTENTION     │ FLEET INTELLIGENCE                          │ OPERATIONS     │
│ 4 items       │ [live|recent|stale|unavailable] segment     │ Backups: 1 run │
│ ▸ critical    │  22 live · 1 recent · 1 stale               │  · 1 failed 24h│
│ ▸ high        │ devices  WKS-014 · WKS-012 · …              │  · last 09:12  │
│ ▸ offline     ├────────────────────────────────────────────┤ Scans · Reports│
│ ▸ failed bkp  │ SECURITY INTELLIGENCE                       ├────────────────┤
│               │ critical ▓ 0  high ▓ 1  med ▓ 3  low ▓ 5    │ QUICK COMMANDS │
│ All clear     │ Coverage ▓▓▓ 92% (22/24 online scanned)     │ Connect Device │
│ (no-alert)    │ Worst risk: HIGH · Last scan 2d ago         │ View Alerts 4  │
│               │ 2 online devices never scanned → Cybersecurity│ New Backup Job│
│               ├────────────────────────────────────────────┤ Generate Report│
│               │ ACTIVITY (Owner/Admin) — 4 recent events    │ Ask AI         │
└───────────────┴────────────────────────────────────────────┴────────────────┘
Signal Field: full constellation (≤ 48 nodes) behind state band + modules
```

- **Spatial layers:** sidebar (existing shell) + content column (fluid, ≤ 1600 px command canvas) + Signal Field at Z2 behind Z3 modules; attention at Z5.
- **Attention priority:** state → attention → fleet → security → operations → activity → commands.
- **Navigation relationship:** Sidebar unchanged; horizon rail persists across the shell; modules route to their owner pages.

### 48.2 1440 × 900
- Same composition, narrower gutters (`sp-6` → `sp-5` where needed), same module order.
- Attention rail ~300 px; two-column main retained; full constellation retained.
- This is the **default design target**; all tokens tuned at 1440, verified at 1920.

---

## 49. Mobile Blueprint

### 49.1 390 × 844
```
┌──────────────────────────────┐
│ Header (org name only)  …     │
│ ── Command Horizon cue ──     │
│ OPERATIONAL STATE             │  ← first above the fold
│   ● OPERATIONAL · 24 total    │
│   "1 failed backup (24h)"     │
│ ─────────────────────────────│
│ ATTENTION (top strip)         │  ← second above the fold
│   4 items → "View all alerts" │
│ ─────────────────────────────│
│ FLEET ESSENTIALS              │  ← essential counts
│   live ▓▓▓ 22 · online 22     │
│   Recently active (2 rows)    │
│ ─────────────────────────────│
│ SECURITY ESSENTIALS           │
│   high 1 · coverage 92% → View│
│ ─────────────────────────────│
│ OPERATIONS                    │
│   1 running · 1 failed → View │
│ ─────────────────────────────│
│ QUICK COMMANDS (horizontal)   │
│   [Connect] [Alerts] [Scan]   │
│ [View all activity] (Owner)   │
└──────────────────────────────┘
```

### 49.2 320-class
Same priority order, tighter spacing; state reasons truncated with "View" routing; touch targets ≥ 44 px; no horizontal scroll.

**Priority order (both):** Operational state → Attention → Fleet essentials → Security essentials → Operations → Commands. **Everything else deferred/collapsed** behind "View all" routes to specialist pages (never hidden from capability, never replaced by fake summaries; DASH-02 §23). Signal Field = horizon cue only; no node rendering.

---

## 50. Component Visual Contracts

For each V1 component: Purpose / Geometry / Material / Depth / Motion / Interaction / Loading / Empty / Error / Stale / Reduced motion / Mobile.

### 50.1 CommandHeader
- **Purpose:** Identify environment, session context, refresh truth.
- **Geometry:** Shell frame; `h-14` header + horizon calibration rail; title, org, role, clock, "Last refreshed HH:MM".
- **Material:** Elevated Command Surface / `background/80` + hairline border.
- **Depth:** Z4 (shell chrome above content).
- **Motion:** None (session data is static; clock ticks per minute).
- **Interaction:** Org switcher (existing), primary commands, refresh.
- **Loading:** Skeleton header block.
- **Empty:** Never (session always available post-auth).
- **Error:** Session failure → dashboard `error.tsx` boundary.
- **Stale:** "Last refreshed" text advances; no metric staleness here.
- **Reduced motion:** Identical (no motion).
- **Mobile:** Condensed (org name only); commands move into quick-command row.

### 50.2 OperationalState
- **Purpose:** Answer "is my environment healthy right now?" in one glance.
- **Geometry:** Full-width band; state chip (radius-sm) + reason line + counts + calibration edge segment (state-reactive).
- **Material:** Precision Surface + Attention Surface edge.
- **Depth:** Z3 (data) with the Signal Field baseline behind it.
- **Motion:** One deliberate settle on state change (300–400 ms); critical edge 400 ms held quietly; no loops.
- **Interaction:** Reason items route to owner pages; manual refresh.
- **Loading:** Skeleton banner + count skeletons.
- **Empty:** NO DATA + "Connect a device to begin" (onboarding dominates).
- **Error:** UNKNOWN + Retry; never fake healthy.
- **Stale:** "Data may be stale — last updated Xm ago", last confirmed state frozen.
- **Reduced motion:** Static chip + edge; no pulse.
- **Mobile:** Above the fold; reasons truncated with "View".

### 50.3 AttentionRail
- **Purpose:** Unified, deduplicated, actionable attention feed.
- **Geometry:** Column (~320 px desktop) / top strip (tablet/mobile); items = severity geometry + icon + message + age + ack.
- **Material:** Attention Surface + Precision Surface; localized illumination on items.
- **Depth:** Z5 (only bright layer when items exist).
- **Motion:** New item fade/slide 200–300 ms; bounded pulse ≤ 3 iterations; no looping.
- **Interaction:** Acknowledge alert (`POST /alerts/:id/acknowledge`); row click → owner page; dismiss via navigation.
- **Loading:** Skeleton rows.
- **Empty:** "All clear — no items require attention" (always rendered).
- **Error:** "Attention status unavailable" + Retry.
- **Stale:** Item ages; > 30 min unrefreshed → stale note.
- **Reduced motion:** Static items + static highlight; no pulse.
- **Mobile:** Pinned under header; "View all alerts" routing.

### 50.4 FleetIntelligence
- **Purpose:** Represent total/online/offline, freshness, recently active.
- **Geometry:** Segmented freshness indicator + compact device rows/clusters.
- **Material:** Precision Surface module.
- **Depth:** Z3.
- **Motion:** Changed cells fade 300 ms; row updates 200 ms; no idle animation.
- **Interaction:** Counts → `/dashboard/device-health`; rows → `/dashboard/device-health/[id]`; Connect → onboarding.
- **Loading:** Skeleton table/segments.
- **Empty:** "No devices connected" + Connect.
- **Error:** "Unable to load fleet" + Retry.
- **Stale:** Devices beyond 5 min labeled offline (contract); per-panel refresh stamp.
- **Reduced motion:** Static segments.
- **Mobile:** Essential counts + 2 recently-active rows; table → card rows.

### 50.5 SecurityIntelligence
- **Purpose:** Truthful fleet security status — no fake score.
- **Geometry:** Severity distribution bars + coverage segment + worst-risk chip + scan-age stamp.
- **Material:** Precision Surface module.
- **Depth:** Z3.
- **Motion:** Changed cell highlight 300 ms; emphasis on critical/high finding regions; no loop.
- **Interaction:** Severity counts → Cybersecurity; coverage/unscanned → Cybersecurity.
- **Loading:** Skeleton panel.
- **Empty:** "No security scans have run" + route to trigger.
- **Error:** "Security data unavailable" + Retry.
- **Stale:** Scan age stamp; beyond ~7 days → "STALE — rescan recommended".
- **Reduced motion:** Static bars.
- **Mobile:** Essential summary + "View" routing; detail deferred.

### 50.6 Operations
- **Purpose:** Summarize backup/scan/report job state; never edits jobs.
- **Geometry:** Unified operation rows (running/pending/failed/completed).
- **Material:** Precision Surface module.
- **Depth:** Z3.
- **Motion:** Running = indeterminate progress on that item + route dash; completed = quiet check + 300 ms single pass; no global animation.
- **Interaction:** Rows → Backup / Cybersecurity / Reports; "New Backup Job" / "Generate Report" routing.
- **Loading:** Skeleton rows.
- **Empty:** "No backup jobs configured" / "No reports yet" + routes.
- **Error:** "Operations status unavailable" + Retry.
- **Stale:** "last run X ago".
- **Reduced motion:** Static labels ("Running…", check icon).
- **Mobile:** Essential rows + "View" routing.

### 50.7 ActivityTimeline
- **Purpose:** Truthful recent-change history (Owner/Admin only).
- **Geometry:** Timeline rows: action label · actor · target hint · timestamp.
- **Material:** Precision Surface module.
- **Depth:** Z3.
- **Motion:** None; rows update on refetch.
- **Interaction:** Rows route when target resolvable.
- **Loading:** Skeleton rows.
- **Empty:** "No system activity recorded yet".
- **Error:** "Activity unavailable" + Retry; 403 → module omitted (never shown as error).
- **Stale:** Timestamps + "as of X".
- **Reduced motion:** Identical.
- **Mobile:** Moved behind "View all activity".

### 50.8 QuickCommands
- **Purpose:** Useful work or direct routing; operational controls.
- **Geometry:** Compact command surface (radius-md): icon + label + live badge.
- **Material:** Elevated Command Surface.
- **Depth:** Z4.
- **Motion:** Hover 1–2 px rise + edge illumination; press 1 px; no tilt.
- **Interaction:** Per command (§25); ack action performs real API call + toast.
- **Loading:** Skeleton tiles.
- **Empty:** Commands always render.
- **Error:** n/a (navigation); badges inherit parent freshness.
- **Stale:** Badges inherit parent freshness.
- **Reduced motion:** Static.
- **Mobile:** Horizontal scroll row with primary commands.

### 50.9 SignalField
- **Purpose:** Spatial signature — operational presence as a field of real instruments.
- **Geometry:** CSS + SVG constellation; nodes (frames/rings/dots), routes, calibration baseline, clusters; ≤ 48 nodes.
- **Material:** Signal Surface (subtle primary-tint base) over Infrastructure Surface.
- **Depth:** Z2 (decorative, behind Z3).
- **Motion:** Event-driven pulses only (§6); 0–1 idle decorative flow; bounded.
- **Interaction:** None (decorative-isolated; `pointer-events-none`).
- **Loading:** Dormant topology (anchors at base alpha, no readings).
- **Empty:** NO_DATA horizon; no constellation.
- **Error:** UNKNOWN → neutral retreat, no confident light.
- **Stale:** Inherits parent state; frozen field.
- **Reduced motion:** Fully static composition; zero movement.
- **Mobile:** Horizon line only (< 1024 px); hidden below `lg` beyond the cue.

---

## 51. Implementation Guidance

Implementation primitives only — **no production components are defined here.**

| Primitive | Recommendation | Rationale |
|---|---|---|
| CSS custom properties | Add a scoped `--cc-*` / `--sf-*` namespace for the Command Center + Signal Field (mirroring auth's sanctioned `--tf-*`, R2 :123), consumed via existing Tailwind theme mapping. | Keeps global tokens intact; scoped spatial variables; DASH-IMPL token work is gated by this direction. |
| CSS transforms | All depth, parallax, micro-elevation, and press states as transforms (`translateZ`, `translate`, `scale`) on GPU-friendly properties. | GPU-composited; no layout thrash. |
| SVG | One layered Signal Field + Infrastructure plane as static inline SVGs (node geometry from real fleet state). | Bounded path counts; no per-frame JS. |
| `framer-motion` | Scoped to the existing shell route transition (unchanged) and finite single-pass entrance/state changes; `useReducedMotion()` gates all JS motion. | No entrance choreography on data modules. |
| `ResizeObserver` | Measure the shell/canvas to tier the Signal Field (full constellation → horizon → cue). | Clean breakpoint-driven degradation. |
| `IntersectionObserver` | Pause attention/field motion for off-screen decorative layers; reveal deferred mobile modules. | Performance + reduced work. |
| `requestAnimationFrame` | Only for the count-up (≤ 4 headline numbers, reduced-motion-gated) and the decorative pointer-parallax driver; both mirror existing patterns. | Nothing else needs frames. |
| Polling | Composed `useCommandCenterData()` (summary visible-only 30 s + conditional backup + 1 WS) per DASH-02 §21; no home device poller if summary covers fleet. | Exactly one surface poller. |
| Derivation | Pure `lib/command-state.ts` state derivation (unit-tested) — no React inside. | Reusable, honest, testable. |

**Boundaries:** no new heavy dependencies (TG-CORE §6); `three`/`recharts` not in the V1 entry (DASH-02 §25); no global CSS changes beyond scoped additions; no changes to frozen auth or `device-presence`.

---

## 52. Performance QA Targets

Future QA targets for DASH-QA-01 (measure, then certify):

| Target | Specification |
|---|---|
| Navigation responsiveness | Route transitions ≤ 200 ms; input → visual feedback ≤ 100 ms; INP < 200 ms worst interaction. |
| Initial render | LCP ≤ 2.5 s; first meaningful paint 2–3 requests; first interaction ≤ 1 s (TG-3 §13). |
| Animation smoothness | ≤ 60 fps, no frame > 16.7 ms on mid-range hardware. |
| CPU idle | ≤ 10% CPU during idle polling (visible tab). |
| Memory stability | No growth over a 30-minute active session. |
| Hidden-tab behavior | All pollers paused on `document.hidden`; resume + refresh on visibility return; exponential backoff on failure (D10). |
| Reduced-motion behavior | Zero animation when `prefers-reduced-motion`; all information retained; no listeners attached to pointer driver. |
| Mobile behavior | No horizontal scroll (320–390); touch targets ≥ 44 px; deferred modules reachable in one extra tap (TG-3 §15). |
| No animation-induced layout shifts | Skeletons match final geometry; CLS 0 from animation. |
| No hydration errors | Zero hydration warnings on hard refresh (auth baseline parity). |
| No console errors | Zero console errors/warnings during idle + interaction passes. |

---

## 53. Authentication Relationship

Authentication and the Command Center are **two spaces inside the same product universe**.

| | Authentication (frozen) | Command Center |
|---|---|---|
| **Role in the product** | Entry / calibration environment — "the threshold is the only ceremony" (Bible :484). | Operational intelligence environment — "the information layer takes command; the environment recedes to its hum" (Bible :471). |
| **Core geometry** | One luminous Command Core — a single threshold of command. | A distributed Signal Field — the network of instruments (Vision :146). |
| **Shared (inherited, not copied)** | Luminous Instrument matte discipline · Calibration Edge · Command Horizon grammar · Quiet Signal Flow restraint · same materials, light, and vocabulary (Bible :481). | Same. |
| **Evolution mechanism** | — | Motif generalization (R2 :241): carry Command Core + Calibration Edge + Command Horizon onto the shell and generalize the core into a field. |
| **Continuity carriers** | — | Shell horizon rail, calibration ticks/registration marks, tabular-numeral typography, semantic light, shared module vocabulary. |
| **Relationship feeling** | "Assume command." | "The system is running. Here is its state." |

**Originality law (Bible :528–562):** TechFusion never copies its own surfaces literally. The Command Center studies the principles and builds its own expression — same physics (matte ground, luminous truth, calibration edge), different instrument.

---

## 54. TG-3 Target

**Target: TG-3 ≥ 95** (pass threshold 85; TG-CORE §10 targets 95+).

Without sacrificing truth, accessibility, performance, or maintainability. Category emphasis for the Command Center (per TG-3 §19 — surface-agnostic framework, dashboard emphasis): data density and performance budgets dominate; honesty rules govern every warning and alert; visual hierarchy and information architecture (8–10 point categories) carry the operational-clarity claim; Innovation (3) is earned by the Signal Field as a *truthful* 4DX signature — never by decoration.

**Certification path:** DASH-IMPL-01/02 → automated QA (axe, contrast, keyboard) → manual QA (DASH-QA-01) → Design Certification (mirroring AUTH-CERT-01) → frozen.

---

## 55. Risks

| Risk | Mitigation |
|---|---|
| **Signal Field drifts into decoration** (fake topology, "dashboard-of-dashboards") | §5.3 hard rules (nodes = real devices only, capped 48, no fabricated routes); Visual Gate enforces TG-2X :4630. |
| **Field performance cost at large fleets** | Render cap 48 + cluster aggregation; CSS/SVG only; zero WebGL; idle 0–1 flows. |
| **Reduced-motion loss of identity** | Static composition retains geometry, illumination, hierarchy — field reads as a still, premium instrument (§33). |
| **Mobile attempts desktop density** | Responsive tiering (§36): horizon cue only below `lg`; data-first priorities (§49); deferred modules behind "View all". |
| **Scope creep into heavy visualization / 3D** | Data viz inventory §31; Three.js forbidden for home (§34); lazy-load rule. |
| **Design authority conflicts (new visual decisions)** | Every token/geometry decision derives from TG-2A/TG-2X/AUTH-VIS; conflicts are governance events (TG-CORE §3). |
| **Regressing specialist pages via shared hooks** | Coordinated change in DASH-IMPL-01; existing test suites gate; DASH-QA-01 verifies all pages. |
| **Auth baseline disturbance** | Preservation contract (DASH-01 §22); no modification of frozen surfaces; shell changes coordinated. |
| **Fabricated data sneaking into "visual" work** | Zero-fabrication law applies to the visual layer: the field implies no number the summary did not provide. |

---

## 56. Final Recommendation

**Adopt THE SIGNAL FIELD · OPERATIONAL CONSTELLATION (Direction A) as the authoritative visual direction** for DASH-IMPL-01 and DASH-IMPL-02, per the 4DX stack, Signal Field architecture and states, depth model, material/geometry/type/light systems, eight signature moments, and the performance/accessibility/reduced-motion contracts defined in this specification.

**Handoff commitments for implementers:**
1. **DASH-IMPL-01 (Foundation):** Command Header, Operational State, composed `useCommandCenterData`, a11y contract (D07), loading states (D09), polling hygiene (D10), onboarding stabilization (D11), pure `command-state.ts` + tests, performance baseline. Consumes this direction for the shell/horizon and state band.
2. **DASH-IMPL-02 (Modules + Field):** Attention Rail, Fleet, Security, Operations, Activity (Owner/Admin), Quick Commands, and the Signal Field visual layer (from §5–§6) behind reduced-motion/decoration isolation.
3. **DASH-QA-01 (QA):** Performance QA targets §52, responsive matrix, a11y audit, reduced-motion verification, D12 runtime check.
4. **DASH-CERT-01 (Certification):** TG-3 ≥ 95, mirroring AUTH-CERT-01.

**Do not:** modify production Dashboard, Authentication, backend, APIs, database, or DASH-DATA-01 contracts. This is a specification; implementation follows in scoped missions.

---

### FINAL RESPONSE

- **Three proposed visual directions:**
  1. **A — THE SIGNAL FIELD · OPERATIONAL CONSTELLATION** (distributed fleet field; the selected DASH-02 signature evolved into full 4DX)
  2. **B — THE CALIBRATION CONSOLE · INSTRUMENT BENCH** (Command Horizon generalized into a machined instrument panel; strongest continuity, weakest distinct identity)
  3. **C — THE ATTENTION CORRIDOR · SPATIAL CONSOLE** (attention-axis spatial layout; memorable interaction, weaker brand identity)
- **Selected direction:** **Direction A — THE SIGNAL FIELD · OPERATIONAL CONSTELLATION** (score 85/100 vs B 81, C 75).
- **Selected 4DX architecture:** Six-layer stack (L0 Atmosphere · L1 Signal Field · L2 Infrastructure · L3 Operational Data · L4 Interaction · L5 Attention); depth scale Z0–Z5; event-driven motion grammar; five reactive-lighting registers; data-reactivity contract (§13); state-driven Signal Field (§6).
- **Signal Field strategy:** CSS/SVG constellation of real fleet instruments — nodes = real devices (≤ 48 rendered, remainder aggregated), routes = real relationships, pulses = real events; seven states (IDLE/ACTIVE/ATTENTION/DEGRADED/CRITICAL/NO_DATA/UNKNOWN); decorative-isolated and static under reduced motion; horizon-line only below `lg`.
- **Number of signature moments:** **8** (§41).
- **Desktop strategy:** 1920 × 1080 and 1440 × 900 operational compositions (§48): state band + attention rail + two-column intelligence + operations/commands, full constellation, default design target 1440.
- **Mobile strategy:** Data-first priority — Operational state → Attention → Fleet essentials → Security essentials → Operations → Commands; everything else deferred behind "View all"; horizon cue only; 390 and 320 blueprints (§49).
- **Performance strategy:** No WebGL/Three.js on home; no Recharts in V1 core; exactly one surface poller + conditional backup poller + one WS subscription; CSS/SVG transform/opacity only; event-driven over continuous animation; budgets in §34/§52.
- **Accessibility strategy:** WCAG 2.2 AA; complete reduced-motion degradation (static equivalents, nothing lost); keyboard-complete; no color-only status (geometry + icon + copy + contrast); decorative layers isolated (§32–§33).
- **Expected TG-3 target:** **≥ 95** without sacrificing truth, accessibility, performance, or maintainability.
- **Authentication files modified:** **NONE**
- **Dashboard production files modified:** **NONE**
- **Backend modified:** **NONE**
- **Documentation created:** `docs/dashboard/DASH-VIS-01_4DX_VISUAL_DIRECTION.md`
- **Recommended next mission:** **DASH-IMPL-01 — Command Center Foundation** (frontend; consumes this direction; prerequisite DASH-DATA-01 already delivered), followed by **DASH-IMPL-02 — Operational Intelligence Modules + Signal Field**.

---

### FINAL STATUS

> **DASH-VIS-01 COMPLETE — 4DX DIRECTION APPROVED FOR IMPLEMENTATION**

---

## Preservation Contract

- **Authentication:** referenced only. Modified: **NONE**.
- **Dashboard production implementation:** not edited. Modified: **NONE**.
- **Backend / API / Database / DASH-DATA-01 contracts:** not edited. Modified: **NONE**.
- **Git state:** no reset/clean/stash/rebase/merge/commit/unlink performed. Read-only inspection only.
- **Documentation created:** `docs/dashboard/DASH-VIS-01_4DX_VISUAL_DIRECTION.md`.
- If any implementation change was accidentally made during this mission, it must be reported and reverted before continuing. None occurred.

---

## FINAL PRINCIPLE

> **TECHFUSION 4DX IS NOT ABOUT MAKING THE PAGE MOVE.**
> **IT IS ABOUT MAKING THE SYSTEM FEEL PRESENT.**
>
> Depth communicates hierarchy.
> Motion communicates change.
> Light communicates state.
> The Signal Field communicates infrastructure.
> Data communicates truth.
> Interaction communicates control.
>
> The result should feel alive because the SYSTEM is alive —
> not because the interface is constantly animated.

---

*End of DASH-VIS-01. Design specification only — no production code, no Authentication, and no backend were modified. Verified read-only compliance.*
