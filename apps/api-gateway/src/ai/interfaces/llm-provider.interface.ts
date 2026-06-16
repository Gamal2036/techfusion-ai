export interface CompletionOptions {
  model: string;
  systemPrompt: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
  onStream?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface CompletionResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface EmbeddingOptions {
  model: string;
  input: string[];
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  totalTokens: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(opts: CompletionOptions): Promise<CompletionResult>;
  embed(opts: EmbeddingOptions): Promise<EmbeddingResult>;
}
