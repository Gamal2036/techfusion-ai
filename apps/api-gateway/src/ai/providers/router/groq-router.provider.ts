import Groq from 'groq-sdk';
import { AiProviderInterface, AiResponse, EmbedResponse } from '../../types/ai-provider.types';

export class GroqRouterProvider implements AiProviderInterface {
  readonly name = 'Groq'
  readonly priority = 4
  readonly costTier = 'free' as const
  readonly speedTier = 'ultrafast' as const
  readonly supportsEmbedding = false
  private client: Groq | null = null

  constructor() {
    const apiKey = process.env.GROQ_API_KEY
    if (apiKey) {
      this.client = new Groq({ apiKey })
    }
  }

  isConfigured(): boolean {
    return !!process.env.GROQ_API_KEY
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.chat.completions.create({
        model: 'llama-3.1-70b-versatile',
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
      const model = 'llama-3.1-70b-versatile'
      const messages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ]
      const response = await this.client!.chat.completions.create({ model, messages })
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
      throw new Error(`Groq completion failed: ${(error as Error).message}`)
    }
  }

  async embed(_text: string): Promise<EmbedResponse> {
    throw new Error('Groq does not support embeddings')
  }
}
