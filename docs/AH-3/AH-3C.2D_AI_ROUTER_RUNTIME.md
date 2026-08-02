# AH-3C.2D — AI Router Runtime

**Project:** Tech Fusion AI
**Phase:** AH-3C.2D — Device Runtime Integration & AI Multi-Provider Orchestration
**Date:** 2026-07-22

---

## Architecture

```
Frontend: POST /ai/troubleshoot (SSE streaming)
  → TroubleshootingController
    → AiOrchestratorService.complete(orgId, opts)
      → loadProviders(orgId) → DB (per-org) or fallback
        → Provider chain: Groq → Gemini → OpenRouter → Anthropic → OpenAI → Ollama
      → Provider.complete() with onStream callback
      → SSE events: token, done, citations, error
```

---

## Provider Priority (Production)

| Priority | Provider | Env Key | Cost | Speed | Embedding | Status |
|----------|----------|---------|------|-------|-----------|--------|
| 1 | **Groq** | `GROQ_API_KEY` | Free | Ultrafast | No | Configured |
| 2 | **Gemini** | `GEMINI_API_KEY` | Free | Fast | Yes (text-embedding-004) | Configured |
| 3 | **OpenRouter** | `OPENROUTER_API_KEY` | Free | Medium | No | Configured |
| 4 | Anthropic | `ANTHROPIC_API_KEY` | High | Medium | No | Not configured |
| 5 | OpenAI | `OPENAI_API_KEY` | Low | Fast | Yes | Not configured |
| 6 | Ollama | (local) | Free | Slow | Yes (nomic-embed-text) | Local fallback |

---

## Router Strategies

| Strategy | Behavior |
|----------|----------|
| `smart` (default) | Priority order: Groq → Gemini → OpenRouter → Anthropic → OpenAI → Ollama |
| `fast` | Same as smart but excludes `slow` tier (removes Ollama) |
| `quality` | Gemini → OpenRouter → Groq → OpenAI → Anthropic → Ollama |
| `local` | Ollama only |
| `cost-first` | Free providers first, then low, medium, high |
| `speed-first` | Ultrafast → fast → medium → slow |
| `round-robin` | Rotate through configured providers |

---

## Circuit Breaker

| Parameter | Value |
|-----------|-------|
| Threshold | 3 failures |
| Reset duration | 10 minutes (600000ms) |
| States | Closed → Open → Half-Open → Closed |
| Half-open probe | Allows single test request after reset |

---

## Failover Flow

```
1. Resolve strategy → ordered provider list
2. Filter: isConfigured() && !circuitBreaker.isOpen()
3. For each provider:
   a. Race: provider.complete() vs timeout (30s default)
   b. On success: recordSuccess(), return result
   c. On failure: recordFailure(), log error, continue to next
   d. If circuit opens: skip provider
4. If all fail: throw aggregated error
```

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `GROQ_API_KEY` | none | Groq API authentication |
| `GEMINI_API_KEY` | none | Gemini API authentication |
| `OPENROUTER_API_KEY` | none | OpenRouter API authentication |
| `ANTHROPIC_API_KEY` | none | Anthropic API authentication |
| `OPENAI_API_KEY` | none | OpenAI API authentication |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3` | Ollama model name |
| `AI_ROUTER_STRATEGY` | `smart` | Selection strategy |
| `AI_ROUTER_TIMEOUT_MS` | `30000` | Per-request timeout |
| `AI_FALLBACK_ENABLED` | `true` | Enable sequential failover |
| `AI_CIRCUIT_BREAKER_THRESHOLD` | `3` | Failures before circuit opens |
| `AI_CIRCUIT_BREAKER_RESET_MS` | `600000` | Circuit open duration |

---

## Changes Applied

1. **Provider priority reordered:** Groq(1) → Gemini(2) → OpenRouter(3) → Anthropic(4) → OpenAI(5) → Ollama(6)
2. **New strategies added:** `fast`, `quality`, `local`
3. **Circuit breaker enhanced:** Half-open probing after reset
4. **Embedding timeout added:** `Promise.race` wrapper in `embed()` method
5. **Ollama demoted:** Local fallback only, never first priority

---

## Report Path

`docs/AH-3/AH-3C.2D_AI_ROUTER_RUNTIME.md`

---

## Status

**AI ROUTER: PRODUCTION-READY** — Provider priority corrected, strategies implemented, failover verified.
