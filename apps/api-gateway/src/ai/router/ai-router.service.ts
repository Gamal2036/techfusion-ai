import { Injectable } from '@nestjs/common';
import { AiProviderInterface, AiResponse, EmbedResponse, ProviderStatus, RouterStats, RouterStrategy } from '../types/ai-provider.types';
import { CircuitBreaker } from './circuit-breaker';
import { AnthropicRouterProvider } from '../providers/router/anthropic-router.provider';
import { OpenAiRouterProvider } from '../providers/router/openai-router.provider';
import { GeminiRouterProvider } from '../providers/router/gemini-router.provider';
import { GroqRouterProvider } from '../providers/router/groq-router.provider';
import { OpenRouterRouterProvider } from '../providers/router/openrouter-router.provider';
import { OllamaRouterProvider } from '../providers/router/ollama-router.provider';

interface OrgRouterStats {
  totalRequests: number;
  successes: number;
  totalLatency: number;
  totalCost: number;
  providerUsage: Record<string, number>;
}

function emptyStats(): OrgRouterStats {
  return {
    totalRequests: 0,
    successes: 0,
    totalLatency: 0,
    totalCost: 0,
    providerUsage: {},
  };
}

@Injectable()
export class AiRouterService {
  private providers: AiProviderInterface[]
  private circuitBreaker: CircuitBreaker
  private runtimeStrategies = new Map<string, RouterStrategy>()
  private stats = new Map<string, OrgRouterStats>()

  constructor() {
    const threshold = parseInt(process.env.AI_CIRCUIT_BREAKER_THRESHOLD || '3', 10)
    const resetMs = parseInt(process.env.AI_CIRCUIT_BREAKER_RESET_MS || '600000', 10)
    this.circuitBreaker = new CircuitBreaker(threshold, resetMs)
    this.providers = [
      new GroqRouterProvider(),
      new GeminiRouterProvider(),
      new OpenRouterRouterProvider(),
      new AnthropicRouterProvider(),
      new OpenAiRouterProvider(),
      new OllamaRouterProvider(),
    ]
  }

  private getActiveStrategy(orgId: string): string {
    return this.runtimeStrategies.get(orgId) || process.env.AI_ROUTER_STRATEGY || 'smart'
  }

  private getOrgStats(orgId: string): OrgRouterStats {
    if (!this.stats.has(orgId)) {
      this.stats.set(orgId, emptyStats())
    }
    return this.stats.get(orgId)!
  }

  private async selectProviders(orgId: string, strategy: string): Promise<AiProviderInterface[]> {
    const configured = this.providers.filter(p => p.isConfigured())
    const notBlocked = configured.filter(p => !this.circuitBreaker.isOpen(p.name))

    switch (strategy) {
      case 'fast':
        return notBlocked.sort((a, b) => a.priority - b.priority).filter(p => p.speedTier !== 'slow')
      case 'quality':
        return notBlocked.sort((a, b) => {
          const qualityOrder = { Gemini: 0, OpenRouter: 1, Groq: 2, OpenAI: 3, Anthropic: 4, Ollama: 5 }
          return (qualityOrder[a.name as keyof typeof qualityOrder] ?? 6) - (qualityOrder[b.name as keyof typeof qualityOrder] ?? 6)
        })
      case 'local':
        return notBlocked.filter(p => p.name === 'Ollama')
      case 'cost-first':
        return notBlocked.sort((a, b) => {
          const order = { free: 0, low: 1, medium: 2, high: 3 }
          return order[a.costTier] - order[b.costTier]
        })
      case 'speed-first':
        return notBlocked.sort((a, b) => {
          const order = { ultrafast: 0, fast: 1, medium: 2, slow: 3 }
          return order[a.speedTier] - order[b.speedTier]
        })
      case 'round-robin': {
        if (notBlocked.length === 0) return []
        const idx = this.getOrgStats(orgId).totalRequests % notBlocked.length
        return [...notBlocked.slice(idx), ...notBlocked.slice(0, idx)]
      }
      case 'smart':
      default:
        return notBlocked.sort((a, b) => a.priority - b.priority)
    }
  }

  async complete(orgId: string, prompt: string, systemPrompt?: string): Promise<AiResponse> {
    const strategy = this.getActiveStrategy(orgId)
    const timeout = parseInt(process.env.AI_ROUTER_TIMEOUT_MS || '30000', 10)
    const fallbackEnabled = (process.env.AI_FALLBACK_ENABLED || 'true') === 'true'

    const orderedProviders = await this.selectProviders(orgId, strategy)
    console.log(`[AI_ROUTE_START] orgId=${orgId} strategy=${strategy} providers=${orderedProviders.map(p => p.name).join(',')} timeout=${timeout}ms`)

    if (orderedProviders.length === 0) {
      throw new Error('No AI providers configured. Please add at least one API key.')
    }

    let lastError: Error | null = null
    let attemptCount = 0
    const routeStart = Date.now()

    for (const provider of orderedProviders) {
      attemptCount++
      const providerStart = Date.now()
      console.log(`[AI_PROVIDER_ATTEMPT] orgId=${orgId} provider=${provider.name} priority=${provider.priority} attempt=${attemptCount}/${orderedProviders.length}`)

      try {
        const result = await Promise.race([
          provider.complete(prompt, systemPrompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout),
          ),
        ])

        const providerMs = Date.now() - providerStart
        const totalMs = Date.now() - routeStart
        this.circuitBreaker.recordSuccess(provider.name)
        this.updateStats(orgId, provider.name, result.latencyMs, result.costEstimateUsd, true)

        console.log(`[AI_PROVIDER_SUCCESS] orgId=${orgId} provider=${provider.name} model=${result.model} providerMs=${providerMs} totalMs=${totalMs} tokens=${result.tokensUsed} fallbackUsed=${attemptCount > 1}`)

        return { ...result, fallbackUsed: attemptCount > 1, attemptCount }
      } catch (error) {
        const providerMs = Date.now() - providerStart
        lastError = error as Error
        this.circuitBreaker.recordFailure(provider.name)
        this.updateStats(orgId, provider.name, 0, 0, false)
        console.log(`[AI_PROVIDER_FAIL] orgId=${orgId} provider=${provider.name} reason=${(error as Error).message} providerMs=${providerMs}`)

        if (!fallbackEnabled) break
      }
    }

    const totalMs = Date.now() - routeStart
    console.log(`[AI_ROUTE_COMPLETE] orgId=${orgId} status=ALL_FAILED totalMs=${totalMs} attempts=${attemptCount} lastError=${lastError?.message}`)
    throw new Error(`All AI providers failed after ${attemptCount} attempts. Last error: ${lastError?.message}`)
  }

  async embed(orgId: string, text: string): Promise<EmbedResponse> {
    const strategy = this.getActiveStrategy(orgId)
    const timeout = parseInt(process.env.AI_ROUTER_TIMEOUT_MS || '30000', 10)
    const embeddingProviders = (await this.selectProviders(orgId, strategy))
      .filter(p => p.supportsEmbedding)

    if (embeddingProviders.length === 0) {
      throw new Error('No embedding-capable providers configured (OpenAI, Gemini, or Ollama required)')
    }

    for (const provider of embeddingProviders) {
      try {
        const result = await Promise.race([
          provider.embed(text),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Embedding timeout after ${timeout}ms`)), timeout),
          ),
        ])
        return result
      } catch (error) {
        this.circuitBreaker.recordFailure(provider.name)
        console.error(`[AiRouter] Embedding failed for ${provider.name}: ${(error as Error).message}`)
      }
    }
    throw new Error('All embedding providers failed')
  }

  async getProvidersStatus(): Promise<ProviderStatus[]> {
    return Promise.all(
      this.providers.map(async (p) => {
        const cb = this.circuitBreaker.getStatus(p.name)
        let available = false
        let latencyMs: number | null = null

        if (p.isConfigured() && !cb.open) {
          const start = Date.now()
          try {
            available = await p.isAvailable()
            latencyMs = Date.now() - start
          } catch {
            available = false
          }
        }

        return {
          name: p.name,
          configured: p.isConfigured(),
          available,
          latencyMs,
          costTier: p.costTier,
          speedTier: p.speedTier,
          circuitOpen: cb.open,
          failureCount: cb.failures,
          lastError: null,
        }
      }),
    )
  }

  getStats(orgId: string): RouterStats {
    const stats = this.getOrgStats(orgId)
    const primary = this.providers.find(p => p.isConfigured())
    return {
      totalRequests: stats.totalRequests,
      successRate: stats.totalRequests > 0
        ? (stats.successes / stats.totalRequests) * 100 : 0,
      averageLatencyMs: stats.successes > 0
        ? stats.totalLatency / stats.successes : 0,
      providerUsage: stats.providerUsage,
      totalCostUsd: stats.totalCost,
      activeStrategy: this.getActiveStrategy(orgId) as RouterStrategy,
      primaryProvider: primary?.name || 'none',
    }
  }

  setStrategy(orgId: string, strategy: RouterStrategy): void {
    this.runtimeStrategies.set(orgId, strategy)
  }

  private updateStats(orgId: string, provider: string, latency: number, cost: number, success: boolean) {
    const stats = this.getOrgStats(orgId)
    stats.totalRequests++
    if (success) {
      stats.successes++
      stats.totalLatency += latency
      stats.totalCost += cost
      stats.providerUsage[provider] = (stats.providerUsage[provider] || 0) + 1
    }
  }
}
