import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { LlmProvider, CompletionOptions, CompletionResult, EmbeddingOptions, EmbeddingResult } from '../interfaces/llm-provider.interface';

@Injectable()
export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: opts.systemPrompt },
      ...opts.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    if (opts.onStream) {
      const stream = await this.client.chat.completions.create({
        model: opts.model,
        messages,
        max_tokens: opts.maxTokens || 4096,
        temperature: opts.temperature ?? 0.3,
        stream: true,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          opts.onStream(delta);
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

    const response = await this.client.chat.completions.create({
      model: opts.model,
      messages,
      max_tokens: opts.maxTokens || 4096,
      temperature: opts.temperature ?? 0.3,
    });

    const content = response.choices?.[0]?.message?.content || '';

    return {
      content,
      model: opts.model,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    };
  }

  async embed(opts: EmbeddingOptions): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: opts.model || 'text-embedding-3-small',
      input: opts.input,
    });

    return {
      embeddings: response.data.map((d) => d.embedding),
      model: response.model,
      totalTokens: response.usage?.total_tokens || 0,
    };
  }
}
