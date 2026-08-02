import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { LlmProvider, CompletionOptions, CompletionResult, EmbeddingOptions, EmbeddingResult } from '../interfaces/llm-provider.interface';

@Injectable()
export class OpenRouterProvider implements LlmProvider {
  readonly name = 'openrouter';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const model = 'meta-llama/llama-3.1-8b-instruct';
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (opts.systemPrompt) {
      messages.push({ role: 'system', content: opts.systemPrompt });
    }

    for (const msg of opts.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }

    const headers = { 'HTTP-Referer': 'https://techfusion.ai', 'X-Title': 'TechFusion AI' };

    if (opts.onStream) {
      const stream = await this.client.chat.completions.create(
        { model, messages, max_tokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.3, stream: true },
        { headers },
      );

      let fullContent = '';

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          opts.onStream(delta);
        }
      }

      const estimatedTokens = Math.ceil(fullContent.split(/\s+/).length * 1.3);

      return {
        content: fullContent,
        model,
        promptTokens: estimatedTokens,
        completionTokens: Math.ceil(fullContent.length / 4),
        totalTokens: estimatedTokens + Math.ceil(fullContent.length / 4),
      };
    }

    const response = await this.client.chat.completions.create(
      { model, messages, max_tokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.3 },
      { headers },
    );

    const content = response.choices?.[0]?.message?.content || '';
    const usage = response.usage;

    return {
      content,
      model,
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: (usage?.prompt_tokens || 0) + (usage?.completion_tokens || 0),
    };
  }

  async embed(_opts: EmbeddingOptions): Promise<EmbeddingResult> {
    throw new Error('OpenRouter does not support embeddings');
  }
}
