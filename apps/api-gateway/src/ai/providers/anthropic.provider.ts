import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { LlmProvider, CompletionOptions, CompletionResult, EmbeddingOptions, EmbeddingResult } from '../interfaces/llm-provider.interface';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const systemMsg = opts.systemPrompt;
    const messages = opts.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    if (opts.onStream) {
      const stream = await this.client.messages.create({
        model: opts.model,
        system: systemMsg,
        max_tokens: opts.maxTokens || 4096,
        temperature: opts.temperature ?? 0.3,
        messages,
        stream: true,
      });

      let fullContent = '';
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          opts.onStream(event.delta.text);
        }
      }

      return {
        content: fullContent,
        model: opts.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    const response = await this.client.messages.create({
      model: opts.model,
      system: systemMsg,
      max_tokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.3,
      messages,
    });

    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('');

    return {
      content,
      model: opts.model,
      promptTokens: response.usage?.input_tokens || 0,
      completionTokens: response.usage?.output_tokens || 0,
      totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    };
  }

  async embed(opts: EmbeddingOptions): Promise<EmbeddingResult> {
    throw new Error('Anthropic does not support embeddings via this API');
  }
}
