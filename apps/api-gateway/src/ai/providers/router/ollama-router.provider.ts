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
  private model: string

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    this.model = process.env.OLLAMA_MODEL || 'llama3'
  }

  isConfigured(): boolean {
    return true
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return false
      const data: OllamaTagResponse = await res.json()
      return (data.models?.length ?? 0) > 0
    } catch {
      return false
    }
  }

  async complete(prompt: string, systemPrompt?: string, _timeoutMs?: number): Promise<AiResponse> {
    const start = Date.now()
    try {
      const messages = []
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
      }
      messages.push({ role: 'user', content: prompt })
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, stream: false }),
      })
      if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
      const data = await res.json()
      return {
        content: data.message?.content || '',
        provider: this.name,
        model: this.model,
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
