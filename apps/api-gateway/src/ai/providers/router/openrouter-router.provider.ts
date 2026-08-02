import OpenAI from 'openai';
import { AiProviderInterface, AiResponse, EmbedResponse } from '../../types/ai-provider.types';

export class OpenRouterRouterProvider implements AiProviderInterface {
  readonly name = 'OpenRouter'
  readonly priority = 3
  readonly costTier = 'free' as const
  readonly speedTier = 'medium' as const
  readonly supportsEmbedding = false
  private client: OpenAI | null = null
  private lastHealthCheck = 0
  private lastHealthResult = false

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
      })
    }
  }

  isConfigured(): boolean {
    return !!process.env.OPENROUTER_API_KEY
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false
    const now = Date.now()
    if (now - this.lastHealthCheck < 60_000) return this.lastHealthResult
    this.lastHealthCheck = now
    try {
      await this.client.chat.completions.create({
        model: 'meta-llama/llama-3.1-8b-instruct',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }, {
        headers: { 'HTTP-Referer': 'https://techfusion.ai', 'X-Title': 'TechFusion AI' },
      })
      this.lastHealthResult = true
      return true
    } catch {
      this.lastHealthResult = false
      return false
    }
  }

  async complete(prompt: string, systemPrompt?: string, _timeoutMs?: number): Promise<AiResponse> {
    const start = Date.now()
    try {
      const model = 'meta-llama/llama-3.1-8b-instruct'
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ]
      const response = await this.client!.chat.completions.create(
        { model, messages },
        { headers: { 'HTTP-Referer': 'https://techfusion.ai', 'X-Title': 'TechFusion AI' } },
      )
      const content = response.choices?.[0]?.message?.content || ''
      const tokensUsed = (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0)
      return {
        content,
        provider: this.name,
        model,
        tokensUsed,
        latencyMs: Date.now() - start,
        costEstimateUsd: 0,
        fallbackUsed: false,
        attemptCount: 1,
      }
    } catch (error) {
      throw new Error(`OpenRouter completion failed: ${(error as Error).message}`)
    }
  }

  async embed(_text: string): Promise<EmbedResponse> {
    throw new Error('OpenRouter does not support embeddings')
  }
}
