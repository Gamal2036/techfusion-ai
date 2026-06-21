import { AiProviderInterface, AiResponse, EmbedResponse } from '../../types/ai-provider.types';

interface OllamaTagResponse {
  models: { name: string }[]
}

export class OllamaRouterProvider implements AiProviderInterface {
  readonly name = 'Ollama'
  readonly priority = 6
  readonly costTier = 'free' as const
  readonly speedTier = 'slow' as const
  readonly supportsEmbedding = true
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  }

  isConfigured(): boolean {
    return true
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return false
      const data: OllamaTagResponse = await res.json()
      return data.models?.some(m => m.name.startsWith('llama3.2') || m.name.startsWith('llama3')) ?? false
    } catch {
      return false
    }
  }

  async complete(prompt: string, systemPrompt?: string, _timeoutMs?: number): Promise<AiResponse> {
    const start = Date.now()
    try {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama3.2', prompt: fullPrompt, stream: false }),
      })
      if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
      const data = await res.json()
      return {
        content: data.response || '',
        provider: this.name,
        model: 'llama3.2',
        tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        latencyMs: Date.now() - start,
        costEstimateUsd: 0,
        fallbackUsed: false,
        attemptCount: 1,
      }
    } catch (error) {
      throw new Error(`Ollama completion failed: ${(error as Error).message}`)
    }
  }

  async embed(text: string): Promise<EmbedResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
      })
      if (!res.ok) throw new Error(`Ollama embedding returned ${res.status}`)
      const data = await res.json()
      return {
        embedding: data.embedding || [],
        provider: this.name,
        model: 'nomic-embed-text',
        dimension: (data.embedding || []).length,
      }
    } catch (error) {
      throw new Error(`Ollama embedding failed: ${(error as Error).message}`)
    }
  }
}
