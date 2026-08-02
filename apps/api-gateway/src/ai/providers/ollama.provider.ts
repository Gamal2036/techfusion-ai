import { Injectable } from '@nestjs/common';
import { LlmProvider, CompletionOptions, CompletionResult, EmbeddingOptions, EmbeddingResult } from '../interfaces/llm-provider.interface';

@Injectable()
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3';
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const messages = [
      { role: 'system', content: opts.systemPrompt },
      ...opts.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    if (opts.onStream) {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          options: {
            temperature: opts.temperature ?? 0.3,
            num_predict: opts.maxTokens || 4096,
          },
        }),
      });

      if (!res.ok) throw new Error(`Ollama returned ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Ollama stream response has no body');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.done) break;
            if (parsed.message?.content) {
              fullContent += parsed.message.content;
              opts.onStream(parsed.message.content);
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }

      return {
        content: fullContent,
        model: this.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: opts.temperature ?? 0.3,
          num_predict: opts.maxTokens || 4096,
        },
      }),
    });

    if (!res.ok) throw new Error(`Ollama returned ${res.status}`);

    const data = await res.json();
    const content = data.message?.content || '';

    return {
      content,
      model: this.model,
      promptTokens: data.prompt_eval_count || 0,
      completionTokens: data.eval_count || 0,
      totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    };
  }

  async embed(opts: EmbeddingOptions): Promise<EmbeddingResult> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: opts.input.join(' '),
      }),
    });

    if (!res.ok) throw new Error(`Ollama embedding returned ${res.status}`);

    const data = await res.json();
    return {
      embeddings: [data.embedding || []],
      model: 'nomic-embed-text',
      totalTokens: 0,
    };
  }
}
