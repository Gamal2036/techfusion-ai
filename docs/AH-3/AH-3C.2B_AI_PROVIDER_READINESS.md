# AH-3C.2B — AI Provider Readiness Matrix

**Project:** Tech Fusion AI
**Phase:** AH-3C.2B
**Date:** 2026-07-21

---

## AI Architecture Overview

```
Frontend: POST /ai/troubleshoot (SSE streaming)
  → TroubleshootingController
    → AI Orchestrator.complete()
      → KB Service (query for context)
      → Device Service (device context)
      → Provider Router (selects provider)
        → Provider Adapter (Anthropic/OpenAI/Gemini/Groq/OpenRouter/Ollama)
          → HTTP request to AI API
            → Streaming response
              → SSE events: token, done, citations, error
```

---

## Provider Readiness Matrix

| Provider | Adapter Exists | Required Env Var | Config Detected | Model Configured | Runtime Tested | Status |
|----------|---------------|-------------------|-----------------|------------------|---------------|--------|
| Anthropic | Yes | `ANTHROPIC_API_KEY` | No | No | No | **NOT CONFIGURED** |
| OpenAI | Yes | `OPENAI_API_KEY` | No | No | No | **NOT CONFIGURED** |
| Gemini | Yes | `GEMINI_API_KEY` | No | No | No | **NOT CONFIGURED** |
| Groq | Yes | `GROQ_API_KEY` | No | No | No | **NOT CONFIGURED** |
| OpenRouter | Yes | `OPENROUTER_API_KEY` | No | No | No | **NOT CONFIGURED** |
| Ollama | Yes | None (local) | **Yes** (port 11434) | Unknown | No | **POTENTIALLY AVAILABLE** |

---

## Provider Details

### Anthropic (Claude)
- **Adapter file:** `apps/api-gateway/src/ai/router/providers/anthropic.provider.ts`
- **Required:** `ANTHROPIC_API_KEY`
- **Models:** claude-3-sonnet, claude-3-haiku
- **Pricing:** Input $3/M, Output $15/M (Sonnet); Input $0.25/M, Output $1.25/M (Haiku)
- **Status:** Not configured

### OpenAI (GPT)
- **Adapter file:** `apps/api-gateway/src/ai/router/providers/openai.provider.ts`
- **Required:** `OPENAI_API_KEY`
- **Models:** gpt-4o, gpt-4o-mini
- **Pricing:** Input $2.50/M, Output $10/M (gpt-4o); Input $0.15/M, Output $0.60/M (mini)
- **Status:** Not configured

### Google Gemini
- **Adapter file:** `apps/api-gateway/src/ai/router/providers/gemini.provider.ts`
- **Required:** `GEMINI_API_KEY`
- **Models:** gemini-pro, gemini-flash
- **Status:** Not configured

### Groq
- **Adapter file:** `apps/api-gateway/src/ai/router/providers/groq.provider.ts`
- **Required:** `GROQ_API_KEY`
- **Models:** mixtral-8x7b, llama2-70b
- **Status:** Not configured

### OpenRouter
- **Adapter file:** `apps/api-gateway/src/ai/router/providers/openrouter.provider.ts`
- **Required:** `OPENROUTER_API_KEY`
- **Models:** Various (routes to multiple providers)
- **Status:** Not configured

### Ollama (Local)
- **Adapter file:** `apps/api-gateway/src/ai/router/providers/ollama.provider.ts`
- **Required:** None (connects to local server)
- **Default URL:** `http://localhost:11434`
- **Models:** Depends on installed models
- **Status:** Server detected at `localhost:11434`
- **Note:** Ollama is running in the environment. If the Ollama provider is enabled in the router config, AI Chat could potentially work with local models.

---

## Circuit Breaker Status

The AI router implements a circuit breaker pattern:
- **State:** Closed (normal), Open (failing), Half-Open (testing recovery)
- **Failure threshold:** Configurable per provider
- **Recovery timeout:** Configurable
- **Current state:** All providers show as offline (no API keys)

---

## Router Strategy

Available strategies:
1. **Round-Robin** — Cycles through available providers
2. **Lowest-Latency** — Picks fastest responding provider
3. **Least-Cost** — Picks cheapest provider
4. **Priority** — Uses configured priority order
5. **Fallback** — Uses primary, falls back to secondary on failure

Current strategy: Configurable via `PUT /ai/router/strategy`

---

## Chat Flow Requirements

### For AI Chat to Work:
1. At least one provider API key must be configured as environment variable
2. The provider must be enabled in the router
3. The router must have a valid model configured
4. The circuit breaker must not be open

### Environment Variables Needed (minimum):
```
# Option 1: OpenAI (most common)
OPENAI_API_KEY=sk-...

# Option 2: Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Option 3: Ollama (local, no key needed)
# Already running at localhost:11434
# Need to enable Ollama provider in router config
```

---

## Frontend AI Chat Features

| Feature | Implementation | Status |
|---------|---------------|--------|
| Chat interface | React component with message bubbles | Complete |
| SSE streaming | ReadableStream with token-by-token display | Complete |
| Typewriter effect | 15ms per character for non-streaming | Complete |
| Device selector | Dropdown populated by useDeviceList | Complete |
| Suggested prompts | Static list in UI | Complete |
| Citations display | Shown when KB articles referenced | Complete |
| Error boundary | ChatErrorBoundary class component | Complete |
| Abort/cancel | AbortController with cancel button | Complete |
| Clear/reset | Clears message state | Complete |
| Conversation persistence | **Not implemented** | Missing |

---

## Recommended V1 AI Provider Choice

**Primary:** Ollama (local, no API key needed)
- Already running in the environment
- No cost
- No API key management
- Good for alpha/beta testing
- Privacy-preserving (data stays local)

**Fallback:** OpenAI GPT-4o-mini
- Low cost ($0.15/M input)
- Good quality for IT troubleshooting
- Widely available

**Production:** Anthropic Claude 3 Haiku
- Best cost/performance ratio
- Strong at technical content
- Good safety features
