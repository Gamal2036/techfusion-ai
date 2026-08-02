import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LlmProvider, CompletionOptions, CompletionResult, EmbeddingOptions, EmbeddingResult } from '../interfaces/llm-provider.interface';

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async complete(opts: CompletionOptions): Promise<CompletionResult> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemInstruction = opts.systemPrompt
      ? { role: 'system' as const, parts: [{ text: opts.systemPrompt }] }
      : undefined;

    const chat = model.startChat({
      systemInstruction,
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxTokens || 4096,
      },
    });

    const prompt = opts.messages.map(m => m.content).join('\n');

    if (opts.onStream) {
      const result = await chat.sendMessageStream(prompt);
      let fullContent = '';

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullContent += text;
          opts.onStream(text);
        }
      }

      const response = await result.response;
      const usage = response.usageMetadata;

      return {
        content: fullContent,
        model: 'gemini-2.0-flash',
        promptTokens: usage?.promptTokenCount || 0,
        completionTokens: usage?.candidatesTokenCount || 0,
        totalTokens: usage?.totalTokenCount || 0,
      };
    }

    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const content = response.text();
    const usage = response.usageMetadata;

    return {
      content,
      model: 'gemini-1.5-flash',
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
    };
  }

  async embed(opts: EmbeddingOptions): Promise<EmbeddingResult> {
    const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const text = opts.input.join(' ');
    const result = await model.embedContent(text);

    return {
      embeddings: [result.embedding.values],
      model: 'text-embedding-004',
      totalTokens: result.embedding.values.length,
    };
  }
}
