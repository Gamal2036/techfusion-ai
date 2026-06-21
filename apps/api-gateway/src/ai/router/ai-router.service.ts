import { Injectable } from '@nestjs/common';
import { AiProviderInterface, AiResponse, EmbedResponse, ProviderStatus, RouterStats, RouterStrategy } from '../types/ai-provider.types';
import { CircuitBreaker } from './circuit-breaker';
import { AnthropicRouterProvider } from '../providers/router/anthropic-router.provider';
import { OpenAiRouterProvider } from '../providers/router/openai-router.provider';
import { GeminiRouterProvider } from '../providers/router/gemini-router.provider';
import { GroqRouterProvider } from '../providers/router/groq-router.provider';
import { OpenRouterRouterProvider } from '../providers/router/openrouter-router.provider';
import { OllamaRouterProvider } from '../providers/router/ollama-router.provider';

@Injectable()
export class AiRouterService {
  private providers: AiProviderInterface[]
  private circuitBreaker: CircuitBreaker
  private runtimeStrategy: RouterStrategy | null = null
  private stats = {
    totalRequests: 0,
    successes: 0,
    totalLatency: 0,
    totalCost: 0,
    providerUsage: {} as Record<string, number>,
  }

  constructor() {
    const threshold = parseInt(process.env.AI_CIRCUIT_BREAKER_THRESHOLD || '3', 10)
    const resetMs = parseInt(process.env.AI_CIRCUIT_BREAKER_RESET_MS || '600000', 10)
    this.circuitBreaker = new CircuitBreaker(threshold, resetMs)
    this.providers = [
      new AnthropicRouterProvider(),
      new OpenAiRouterProvider(),
      new GeminiRouterProvider(),
      new GroqRouterProvider(),
      new OpenRouterRouterProvider(),
      new OllamaRouterProvider(),
    ]
  }

  private getActiveStrategy(): string {
    return this.runtimeStrategy || process.env.AI_ROUTER_STRATEGY || 'smart'
  }

  private async selectProviders(strategy: string): Promise<AiProviderInterface[]> {
    const configured = this.providers.filter(p => p.isConfigured())
    const notBlocked = configured.filter(p => !this.circuitBreaker.isOpen(p.name))

    switch (strategy) {
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
        const idx = this.stats.totalRequests % notBlocked.length
        return [...notBlocked.slice(idx), ...notBlocked.slice(0, idx)]
      }
      case 'smart':
      default:
        return notBlocked.sort((a, b) => a.priority - b.priority)
    }
  }

  async complete(prompt: string, systemPrompt?: string): Promise<AiResponse> {
    const strategy = this.getActiveStrategy()
    const timeout = parseInt(process.env.AI_ROUTER_TIMEOUT_MS || '30000', 10)
    const fallbackEnabled = (process.env.AI_FALLBACK_ENABLED || 'true') === 'true'

    const orderedProviders = await this.selectProviders(strategy)

    if (orderedProviders.length === 0) {
      throw new Error('No AI providers configured. Please add at least one API key.')
    }

    let lastError: Error | null = null
    let attemptCount = 0

    for (const provider of orderedProviders) {
      attemptCount++
      try {
        const result = await Promise.race([
          provider.complete(prompt, systemPrompt),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout),
          ),
        ])

        this.circuitBreaker.recordSuccess(provider.name)
        this.updateStats(provider.name, result.latencyMs, result.costEstimateUsd, true)

        return { ...result, fallbackUsed: attemptCount > 1, attemptCount }
      } catch (error) {
        lastError = error as Error
        this.circuitBreaker.recordFailure(provider.name)
        this.updateStats(provider.name, 0, 0, false)
        console.error(`[AiRouter] ${provider.name} failed (attempt ${attemptCount}): ${(error as Error).message}`)

        if (!fallbackEnabled) break
      }
    }

    throw new Error(`All AI providers failed after ${attemptCount} attempts. Last error: ${lastError?.message}`)
  }

  async embed(text: string): Promise<EmbedResponse> {
    const strategy = this.getActiveStrategy()
    const embeddingProviders = (await this.selectProviders(strategy))
      .filter(p => p.supportsEmbedding)

    if (embeddingProviders.length === 0) {
      throw new Error('No embedding-capable providers configured (OpenAI, Gemini, or Ollama required)')
    }

    for (const provider of embeddingProviders) {
      try {
        return await provider.embed(text)
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

  getStats(): RouterStats {
    const primary = this.providers.find(p => p.isConfigured())
    return {
      totalRequests: this.stats.totalRequests,
      successRate: this.stats.totalRequests > 0
        ? (this.stats.successes / this.stats.totalRequests) * 100 : 0,
      averageLatencyMs: this.stats.successes > 0
        ? this.stats.totalLatency / this.stats.successes : 0,
      providerUsage: this.stats.providerUsage,
      totalCostUsd: this.stats.totalCost,
      activeStrategy: this.getActiveStrategy() as RouterStrategy,
      primaryProvider: primary?.name || 'none',
    }
  }

  setStrategy(strategy: RouterStrategy): void {
    this.runtimeStrategy = strategy
  }

  private updateStats(provider: string, latency: number, cost: number, success: boolean) {
    this.stats.totalRequests++
    if (success) {
      this.stats.successes++
      this.stats.totalLatency += latency
      this.stats.totalCost += cost
      this.stats.providerUsage[provider] = (this.stats.providerUsage[provider] || 0) + 1
    }
  }
}
