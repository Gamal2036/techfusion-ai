import { CompletionResult, EmbeddingOptions, EmbeddingResult } from './llm-provider.interface';

export interface OrchestratorCompletionOptions {
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
  onStream?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface AiOrchestrator {
  complete(orgId: string, opts: OrchestratorCompletionOptions): Promise<CompletionResult>;
  embed(orgId: string, opts: EmbeddingOptions): Promise<EmbeddingResult>;
}
