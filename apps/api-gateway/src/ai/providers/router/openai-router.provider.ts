import OpenAI from 'openai';
import { AiProviderInterface, AiResponse, EmbedResponse } from '../../types/ai-provider.types';

export class OpenAiRouterProvider implements AiProviderInterface {
  readonly name = 'OpenAI'
  readonly priority = 2
  readonly costTier = 'low' as const
  readonly speedTier = 'fast' as const
  readonly supportsEmbedding = true
  private client: OpenAI | null = null

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (apiKey) {
      this.client = new OpenAI({ apiKey })
    }
  }

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY
  }

  async isAvailable(): Promise<boolean> {
    if (!this.client) return false
    try {
      await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
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
      const model = 'gpt-4o-mini'
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
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
        costEstimateUsd: tokensUsed * 0.00000015,
        fallbackUsed: false,
        attemptCount: 1,
      }
    } catch (error) {
      throw new Error(`OpenAI completion failed: ${(error as Error).message}`)
    }
  }

  async embed(text: string): Promise<EmbedResponse> {
    try {
      const response = await this.client!.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      })
      return {
        embedding: response.data[0].embedding,
        provider: this.name,
        model: response.model,
        dimension: response.data[0].embedding.length,
      }
    } catch (error) {
      throw new Error(`OpenAI embedding failed: ${(error as Error).message}`)
    }
  }
}
