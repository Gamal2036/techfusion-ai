import Anthropic from '@anthropic-ai/sdk';
import { AiProviderInterface, AiResponse, EmbedResponse } from '../../types/ai-provider.types';

export class AnthropicRouterProvider implements AiProviderInterface {
  readonly name = 'Anthropic'
  readonly priority = 1
  readonly costTier = 'high' as const
  readonly speedTier = 'medium' as const
  readonly supportsEmbedding = false
  private client: Anthropic | null = null

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      this.client = new Anthropic({ apiKey })
    }
  }

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return true
    } catch {
      return false
    }
  }

  async complete(prompt: string, systemPrompt?: string, _timeoutMs?: number): Promise<AiResponse> {
    const start = Date.now()
    try {
      const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
      const response = await this.client!.messages.create({
        model,
        system: systemPrompt,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const content = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('')
      const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      return {
        content,
        provider: this.name,
        model,
        tokensUsed,
        latencyMs: Date.now() - start,
        costEstimateUsd: tokensUsed * 0.000015,
        fallbackUsed: false,
        attemptCount: 1,
      }
    } catch (error) {
      throw new Error(`Anthropic completion failed: ${(error as Error).message}`)
    }
  }

  async embed(_text: string): Promise<EmbedResponse> {
    throw new Error('Anthropic does not support embeddings')
  }
}
