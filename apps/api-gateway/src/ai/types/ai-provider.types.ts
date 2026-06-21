export type CostTier = 'free' | 'low' | 'medium' | 'high'
export type SpeedTier = 'ultrafast' | 'fast' | 'medium' | 'slow'
export type RouterStrategy = 'smart' | 'cost-first' | 'speed-first' | 'round-robin'

export interface AiResponse {
  content: string
  provider: string
  model: string
  tokensUsed: number
  latencyMs: number
  costEstimateUsd: number
  fallbackUsed: boolean
  attemptCount: number
}

export interface EmbedResponse {
  embedding: number[]
  provider: string
  model: string
  dimension: number
}

export interface ProviderStatus {
  name: string
  configured: boolean
  available: boolean
  latencyMs: number | null
  costTier: CostTier
  speedTier: SpeedTier
  circuitOpen: boolean
  failureCount: number
  lastError: string | null
}

export interface RouterStats {
  totalRequests: number
  successRate: number
  averageLatencyMs: number
  providerUsage: Record<string, number>
  totalCostUsd: number
  activeStrategy: RouterStrategy
  primaryProvider: string
}

export interface AiProviderInterface {
  readonly name: string
  readonly priority: number
  readonly costTier: CostTier
  readonly speedTier: SpeedTier
  readonly supportsEmbedding: boolean
  isConfigured(): boolean
  isAvailable(): Promise<boolean>
  complete(
    prompt: string,
    systemPrompt?: string,
    timeoutMs?: number
  ): Promise<AiResponse>
  embed(text: string): Promise<EmbedResponse>
}
