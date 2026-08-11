# 15 — Core Module Extensibility Contract

> Authoritative contract for how CORE MODULES must grow. Ratified by GOV-01
> (2026-08-11). Companion to `13_AI_TECH_LEAD_OPERATING_MODEL.md` (who may change
> what) and `AGENTS.md` (engineering constitution). This document defines the
> CONTRACT ONLY — no module extension is implemented by this document.

## 1. Core Principle

**Core modules are CAPABILITY PLATFORMS, not single-purpose pages.**

A core module is a durable product domain that must be able to absorb new
providers, engines, protocols, and data sources over time without a redesign.
The UI pages, endpoints, and storage tables in a core module are the current
surface of that platform — not the whole of it.

Core modules today include:

- Cybersecurity
- Network
- Monitoring / Alerts / Presence
- Remote Support
- Jobs / Automation (worker queue + scheduler)
- Inventory (hardware)
- Software & Drivers
- Device Enrollment / Identity / Credential lifecycle
- AI layer (providers, embeddings, RAG)
- Reporting
- Backup & Recovery
- Knowledge Base
- Billing / Entitlements

## 2. Layered Boundary Model

Every core module keeps the five boundaries distinct. Code does not cross
layers except through the interfaces each layer defines.

| Layer | Responsibility | May depend on |
|-------|----------------|---------------|
| UI | Render real data; compose user actions | Application/service layer only |
| Application/service | Business logic, orchestration, authz, org scoping | Provider/adapter + persistence |
| Provider/adapter | External capability (scanner, engine, AI provider, discovery protocol, delivery channel) behind a common interface | Nothing but its own contract |
| Persistence | Storage via `apps/api-gateway/prisma/schema.prisma` + migrations | — |
| Agent/runtime | On-device collection/execution behind a versioned agent contract | API contract, never DB |

No layer reaches into another layer's provider implementation. A new provider
is an adapter, not a fork of the service.

## 3. Module Principles (mandatory)

1. **Typed contracts.** Cross-boundary payloads are validated DTOs/shared types,
   not `any`. Device/agent contracts are versioned and additive.
2. **Provider/adapter boundaries.** Each external capability (scanner, engine,
   AI model, discovery source, delivery channel) sits behind a common interface
   with a replaceable implementation. Selection is by config, not by
   hard-coded branch.
3. **Replaceable implementations.** Swapping a provider must not require changes
   to service logic or schema. Provider selection and failover are module
   concerns, tested at the interface.
4. **Testable services.** Business logic is testable without the real provider
   (injected adapter/fake) and without the real network/agent.
5. **Evidence/provenance where applicable.** Findings, discoveries, and
   detections carry source, confidence, and timestamps. An assertion without
   provenance is weaker than an explicit UNKNOWN.
6. **Explicit UNKNOWN/PENDING states.** Absence of data must be representable
   (nullable, UNKNOWN status) and must never be rendered as a false negative or
   false positive.
7. **Capability detection.** The module detects and reports what the
   underlying runtime/provider can actually do, instead of assuming full
   capability.
8. **OS-aware implementation behind common contracts where practical.** Platform
   differences (Linux/Windows/other) live in adapters under a common contract,
   so the service layer stays platform-neutral.
9. **No fake fallback data.** Dev fallbacks are allowed only when explicitly
   marked as placeholders and never shipped as if real. Deterministic mock
   vectors are a documented exception, not a pattern (see `08` KB embeddings).
10. **Graceful partial capability.** A missing provider degrades the surface to
    a documented, honest state — never a fabricated one.
11. **Backwards-compatible expansion.** Extend with additive fields, optional
    params, superset contracts. Do not break shipped agent/API contracts.

## 4. Example Conceptual Boundaries

### Cybersecurity
```
Cybersecurity (capability platform)
  → scanner providers            (updates / firewall / ports / config / future engines)
  → detection / findings         (category, severity, status, details)
  → confidence / evidence        (source, scannedAt, artifact refs)
  → policy                       (thresholds, severity mapping, exclusions)
  → remediation                  (guidance, actions, rollback)
  → history                      (scans, findings lifecycle)
  → future engines               (EDR/AV signals, CVE feeds, threat intel)
```

### Network
```
Network (capability platform)
  → discovery providers          (ARP/ICMP today; SNMP/LLDP/mDNS future)
  → observations                (reachability, latency, dns, connectivity)
  → identity / classification   (vendor, device type, role)
  → topology                    (links, layers, layout data)
  → verification / confidence   (source, lastObservedAt, state)
  → history                     (scan lifecycle, change over time)
  → future protocols/providers  (wireless, cloud, API-based)
```

### Monitoring / Alerts / Presence
```
Monitoring (capability platform)
  → metric sources              (agent telemetry, integrations, synthetic probes)
  → evaluation engines          (threshold rules, presence bands, future ML)
  → notification providers      (in-app, webhook, email, future SMS/ITS M)
  → alert lifecycle             (open / ack / resolve, debounce, history)
  → presence derivation         (ONLINE / DEGRADED / OFFLINE / UNKNOWN)
```

### Remote Support
```
Remote Support (capability platform)
  → transport providers         (WebRTC signaling today; TURN/VNC/RDP future)
  → session lifecycle           (create, consent, join, end, audit)
  → control / viewing channels  (screen share, input, annotation)
  → recordings                  (metadata, storage, playback)
```

### Jobs / Automation
```
Jobs / Automation (capability platform)
  → queue / scheduler           (BullMQ + cron today; future schedulers)
  → job definitions             (typed payloads, idempotency keys)
  → executors                   (worker processors, agent-delegated actions)
  → state & history             (status, retries, correlation, outcomes)
  → future automation           (user-defined workflows, runbooks)
```

### Inventory / Software & Drivers
```
Inventory (capability platform)
  → discovery providers         (agent enumeration today; future AD/Intune/API)
  → catalog sources             (vendor catalogs, EOL/CVE feeds)
  → identity / classification   (device, software, driver, version)
  → drift / compliance          (missing, outdated, end-of-life)
```

### Device Enrollment / Identity
```
Device Enrollment (capability platform)
  → enrollment token lifecycle  (issue, single-use, expiry, revocation)
  → device identity             (fingerprint, installationId, credential version)
  → credential lifecycle        (issue, rotation, recovery, revocation)
  → link / re-link              (persistent reconnect → same Device; never by hostname)
  → presence truthfulness       (lastSeenAt set ONLY by verified heartbeat)
```

## 5. Growth Rules

- **Extend, don't fork.** New capability = new provider/adapter or additive
  contract under the module. It is not a new module with copied logic.
- **Single module per concern.** If a capability belongs to an existing core
  module's boundary, it lives there.
- **Migration discipline.** Schema growth follows `13_AI_TECH_LEAD_OPERATING_MODEL.md`
  §6 and `AGENTS.md` principle 10.
- **Record decisions.** Module boundary changes and new provider abstractions
  are recorded in `14_DECISION_LOG.md`.
- **Readiness reflects contract.** Feature readiness statuses in
  `08_FEATURE_READINESS_MATRIX.md` describe the current surface of each module,
  not the contracted platform ceiling.
