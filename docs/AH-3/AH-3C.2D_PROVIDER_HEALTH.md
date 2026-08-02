# AH-3C.2D — Provider Health Matrix

**Project:** Tech Fusion AI
**Phase:** AH-3C.2D — Device Runtime Integration & AI Multi-Provider Orchestration
**Date:** 2026-07-22

---

## Provider Health Matrix

| Provider | API Key | Endpoint | Model | Streaming | Chat Completion | Timeout | Auth | Rate Limits | Availability |
|----------|---------|----------|-------|-----------|-----------------|---------|------|-------------|-------------|
| **Groq** | ✅ Populated | `api.groq.com` | `llama-3.1-70b-versatile` | ✅ SSE streaming | ✅ | 30s | API Key header | Free tier: 30 RPM | ✅ Available |
| **Gemini** | ✅ Populated | `generativelanguage.googleapis.com` | `gemini-1.5-flash` | ✅ SSE streaming | ✅ | 30s | API Key | Free tier: 15 RPM | ✅ Available |
| **OpenRouter** | ✅ Populated | `openrouter.ai/api/v1` | `meta-llama/llama-3.1-8b-instruct:free` | ✅ SSE streaming | ✅ | 30s | Bearer token | Free tier: 20 RPM | ✅ Available |
| **Anthropic** | ❌ Empty | `api.anthropic.com` | `claude-sonnet-4-20250514` | ✅ SDK streaming | ✅ | 30s | API Key header | Tier-based | ⚠️ Not configured |
| **OpenAI** | ❌ Empty | `api.openai.com` | `gpt-4o` | ✅ SDK streaming | ✅ | 30s | Bearer token | Tier-based | ⚠️ Not configured |
| **Ollama** | N/A (local) | `localhost:11434` | `llama3` | ✅ HTTP streaming | ✅ | 30s | None (local) | None | ✅ Available |

---

## Active Provider Count

| Category | Count |
|----------|-------|
| Configured & Available | 4 (Groq, Gemini, OpenRouter, Ollama) |
| Configured but Not Available | 0 |
| Not Configured | 2 (Anthropic, OpenAI) |
| **Total** | **6** |

---

## Embedding Provider Matrix

| Provider | Embedding Model | Status | Dimension |
|----------|----------------|--------|-----------|
| **Gemini** | `text-embedding-004` | ✅ Fixed (was `embedding-001` → 404) | 768 |
| **OpenAI** | `text-embedding-3-small` | ⚠️ Not configured | 1536 |
| **Ollama** | `nomic-embed-text` | ✅ Available | 768 |
| **Groq** | N/A | ❌ Not supported | N/A |
| **OpenRouter** | N/A | ❌ Not supported | N/A |
| **Anthropic** | N/A | ❌ Not supported | N/A |

---

## Embedding Fix Applied

**Issue:** Gemini router provider used `embedding-001` model which returned 404.
**Fix:** Changed to `text-embedding-004` (current Gemini embedding model).
**Files:** `apps/api-gateway/src/ai/providers/router/gemini-router.provider.ts`, `apps/api-gateway/src/ai/providers/gemini.provider.ts`

---

## Streaming Architecture

| Provider | Stream Implementation | Token Delivery |
|----------|----------------------|----------------|
| Groq | OpenAI SDK `stream: true` | Delta chunks |
| Gemini | Google Generative AI `sendMessageStream` | Text chunks |
| OpenRouter | OpenAI SDK `stream: true` | Delta chunks |
| Ollama | HTTP fetch + JSON line parsing | Message chunks |
| Anthropic | Anthropic SDK `stream: true` | Content block deltas |
| OpenAI | OpenAI SDK `stream: true` | Delta chunks |

---

## Failover Order (Smart Strategy)

```
Request → Groq (ultrafast, free)
  ↓ fail
→ Gemini (fast, free)
  ↓ fail
→ OpenRouter (medium, free)
  ↓ fail
→ Anthropic (medium, high cost) [if configured]
  ↓ fail
→ OpenAI (fast, low cost) [if configured]
  ↓ fail
→ Ollama (slow, free, local)
  ↓ fail
→ Error: All providers failed
```

---

## Report Path

`docs/AH-3/AH-3C.2D_PROVIDER_HEALTH.md`

---

## Status

**PROVIDER HEALTH: VERIFIED** — 4 providers active, embedding model fixed, streaming validated.
