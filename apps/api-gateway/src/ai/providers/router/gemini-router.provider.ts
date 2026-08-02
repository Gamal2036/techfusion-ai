import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiProviderInterface, AiResponse, EmbedResponse } from '../../types/ai-provider.types';

export class GeminiRouterProvider implements AiProviderInterface {
  readonly name = 'Gemini'
  readonly priority = 2
  readonly costTier = 'free' as const
  readonly speedTier = 'fast' as const
  readonly supportsEmbedding = true
  private genAI: GoogleGenerativeAI | null = null
  private lastHealthCheck = 0
  private lastHealthResult = false

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey)
    }
  }

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY
  }

  async isAvailable(): Promise<boolean> {
    if (!this.genAI) return false
    const now = Date.now()
    if (now - this.lastHealthCheck < 60_000) return this.lastHealthResult
    this.lastHealthCheck = now
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      await model.generateContent('ping')
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
      const model = this.genAI!.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
      const result = await model.generateContent(fullPrompt)
      const content = result.response.text()
      const tokensUsed = content.length
      return {
        content,
        provider: this.name,
        model: 'gemini-2.0-flash',
        tokensUsed,
        latencyMs: Date.now() - start,
        costEstimateUsd: 0,
        fallbackUsed: false,
        attemptCount: 1,
      }
    } catch (error) {
      throw new Error(`Gemini completion failed: ${(error as Error).message}`)
    }
  }

  async embed(text: string): Promise<EmbedResponse> {
    try {
      const model = this.genAI!.getGenerativeModel({ model: 'text-embedding-004' })
      const result = await model.embedContent(text)
      return {
        embedding: result.embedding.values,
        provider: this.name,
        model: 'text-embedding-004',
        dimension: result.embedding.values.length,
      }
    } catch (error) {
      throw new Error(`Gemini embedding failed: ${(error as Error).message}`)
    }
  }
}
