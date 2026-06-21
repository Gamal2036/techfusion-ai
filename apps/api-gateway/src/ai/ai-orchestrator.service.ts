import { Injectable, Logger, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './services/encryption.service';
import { CostTrackerService } from './services/cost-tracker.service';
import { AiUsageService } from './services/ai-usage.service';
import { AiRouterService } from './router/ai-router.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { LlmProvider, CompletionOptions, CompletionResult, EmbeddingOptions, EmbeddingResult } from './interfaces/llm-provider.interface';
import { AiOrchestrator, OrchestratorCompletionOptions } from './interfaces/ai-orchestrator.interface';
import { getPlanConfig } from '../billing/plan-features';

export interface ProviderEntry {
  name: string;
  provider: LlmProvider;
  model: string;
  priority: number;
}

@Injectable()
export class AiOrchestratorService implements AiOrchestrator {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private providerCache = new Map<string, ProviderEntry[]>();
  private testProviders: ProviderEntry[] | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly costTracker: CostTrackerService,
    private readonly usageService: AiUsageService,
    @Optional() private readonly aiRouter?: AiRouterService,
  ) {}

  setTestProviders(providers: ProviderEntry[] | null): void {
    this.testProviders = providers;
    this.providerCache.clear();
  }

  private async loadProviders(orgId: string): Promise<ProviderEntry[]> {
    if (this.testProviders) return this.testProviders;

    const cached = this.providerCache.get(orgId);
    if (cached) return cached;

    const configs = await this.prisma.aiProviderConfig.findMany({
      where: { orgId, isEnabled: true },
      orderBy: { priority: 'asc' },
    });

    const entries: ProviderEntry[] = [];

    for (const cfg of configs) {
      try {
        const apiKey = this.encryption.decrypt(cfg.apiKeyEncrypted);
        let provider: LlmProvider;

        switch (cfg.provider) {
          case 'anthropic':
            provider = new AnthropicProvider(apiKey);
            break;
          case 'openai':
            provider = new OpenAIProvider(apiKey, cfg.baseUrl || undefined);
            break;
          default:
            this.logger.warn(`Unknown provider: ${cfg.provider}`);
            continue;
        }

        entries.push({
          name: cfg.provider,
          provider,
          model: cfg.model,
          priority: cfg.priority,
        });
      } catch (err) {
        this.logger.error(`Failed to load provider ${cfg.provider}: ${(err as Error).message}`);
      }
    }

    if (entries.length === 0) {
      entries.push(...this.getFallbackProviders());
    }

    this.providerCache.set(orgId, entries);
    return entries;
  }

  private getFallbackProviders(): ProviderEntry[] {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const entries: ProviderEntry[] = [];

    if (anthropicKey) {
      entries.push({
        name: 'anthropic',
        provider: new AnthropicProvider(anthropicKey),
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        priority: 1,
      });
    }

    if (openaiKey) {
      entries.push({
        name: 'openai',
        provider: new OpenAIProvider(openaiKey),
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        priority: entries.length + 1,
      });
    }

    return entries;
  }

  clearCache(orgId?: string): void {
    if (orgId) {
      this.providerCache.delete(orgId);
    } else {
      this.providerCache.clear();
    }
  }

  async complete(orgId: string, opts: OrchestratorCompletionOptions): Promise<CompletionResult> {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (org) {
      const planConfig = getPlanConfig(org.plan);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthCount = await this.prisma.aiUsageLog.count({
        where: { orgId, createdAt: { gte: startOfMonth } },
      });
      if (monthCount >= planConfig.limits.maxAiQueriesPerMonth) {
        throw new ForbiddenException(
          `Monthly AI query limit reached (${planConfig.limits.maxAiQueriesPerMonth} max on ${planConfig.label} plan). ` +
          `Upgrade to use more AI queries.`,
        );
      }
    }

    const startTime = Date.now();

    try {
      const systemPrompt = opts.systemPrompt;
      const prompt = opts.messages.map(m => `${m.role}: ${m.content}`).join('\n');

      if (opts.onStream) {
        const providers = await this.loadProviders(orgId);
        if (providers.length === 0) {
          throw new Error('No AI providers configured');
        }

        const errors: string[] = [];
        for (const entry of providers) {
          try {
            this.logger.log(`Attempting ${entry.name} (${entry.model}) for org ${orgId}`);

            const result = await entry.provider.complete({
              ...opts,
              model: entry.model,
            });

            const latencyMs = Date.now() - startTime;
            const costUsd = this.costTracker.calculateCost(entry.model, result.promptTokens, result.completionTokens);

            await this.usageService.log({
              orgId,
              conversationId: undefined,
              provider: entry.name,
              model: entry.model,
              promptTokens: result.promptTokens,
              completionTokens: result.completionTokens,
              totalTokens: result.totalTokens,
              costUsd,
              latencyMs,
              success: true,
            });

            this.logger.log(`${entry.name} succeeded (${latencyMs}ms, ${result.totalTokens} tokens, $${costUsd})`);

            return result;
          } catch (err) {
            const errorMessage = (err as Error).message;
            this.logger.warn(`${entry.name} failed: ${errorMessage}`);
            await this.usageService.log({
              orgId,
              conversationId: undefined,
              provider: entry.name,
              model: entry.model,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              costUsd: 0,
              latencyMs: Date.now() - startTime,
              success: false,
              errorMessage,
            });
            errors.push(`${entry.name}: ${errorMessage}`);
          }
        }
        throw new Error(`All AI providers failed: ${errors.join('; ')}`);
      }

      if (this.aiRouter) {
        const response = await this.aiRouter.complete(prompt, systemPrompt);
        const latencyMs = Date.now() - startTime;

        await this.usageService.log({
          orgId,
          conversationId: undefined,
          provider: response.provider,
          model: response.model,
          promptTokens: Math.round(response.tokensUsed * 0.75),
          completionTokens: Math.round(response.tokensUsed * 0.25),
          totalTokens: response.tokensUsed,
          costUsd: response.costEstimateUsd,
          latencyMs,
          success: true,
        });

        return {
          content: response.content,
          model: response.model,
          promptTokens: Math.round(response.tokensUsed * 0.75),
          completionTokens: Math.round(response.tokensUsed * 0.25),
          totalTokens: response.tokensUsed,
        };
      }

      const providers = await this.loadProviders(orgId);
      if (providers.length === 0) {
        throw new Error('No AI providers configured');
      }

      const errors: string[] = [];
      for (const entry of providers) {
        try {
          this.logger.log(`Attempting ${entry.name} (${entry.model}) for org ${orgId}`);
          const result = await entry.provider.complete({
            ...opts,
            model: entry.model,
          });
          const latencyMs = Date.now() - startTime;
          const costUsd = this.costTracker.calculateCost(entry.model, result.promptTokens, result.completionTokens);
          await this.usageService.log({
            orgId,
            conversationId: undefined,
            provider: entry.name,
            model: entry.model,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            totalTokens: result.totalTokens,
            costUsd,
            latencyMs,
            success: true,
          });
          return result;
        } catch (err) {
          const errorMessage = (err as Error).message;
          this.logger.warn(`${entry.name} failed: ${errorMessage}`);
          await this.usageService.log({
            orgId,
            conversationId: undefined,
            provider: entry.name,
            model: entry.model,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            latencyMs: Date.now() - startTime,
            success: false,
            errorMessage,
          });
          errors.push(`${entry.name}: ${errorMessage}`);
        }
      }
      throw new Error(`All AI providers failed: ${errors.join('; ')}`);
    } catch (error) {
      if (!(error instanceof ForbiddenException)) {
        throw error;
      }
      throw error;
    }
  }

  async embed(orgId: string, opts: EmbeddingOptions): Promise<EmbeddingResult> {
    if (this.aiRouter) {
      try {
        const text = opts.input.join(' ');
        const response = await this.aiRouter.embed(text);
        return {
          embeddings: [response.embedding],
          model: response.model,
          totalTokens: response.dimension,
        };
      } catch {
        // fall through to existing logic
      }
    }

    const providers = await this.loadProviders(orgId);
    if (providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    for (const entry of providers) {
      try {
        return await entry.provider.embed({
          ...opts,
          model: entry.model,
        });
      } catch {
        continue;
      }
    }

    throw new Error('All AI providers failed for embedding');
  }

  /**
   * Get embedding for a single text string
   * Used by KB module and other features needing embeddings
   * Falls back to deterministic local embedding when no AI provider is configured (dev/test)
   */
  async getEmbedding(orgId: string, text: string, dimension?: number): Promise<number[]> {
    const dim = dimension || 1536;

    try {
      const result = await this.embed(orgId, {
        model: 'text-embedding-3-small',
        input: [text],
      });

      if (!result.embeddings || result.embeddings.length === 0) {
        throw new Error('No embeddings returned from provider');
      }

      const embedding = result.embeddings[0];

      if (embedding.length !== dim) {
        throw new Error(
          `Embedding dimension mismatch: expected ${dim}, got ${embedding.length}`,
        );
      }

      return embedding;
    } catch (error) {
      this.logger.warn(`Falling back to local deterministic embedding: ${(error as Error).message}`);
      return this.getLocalEmbedding(text, dim);
    }
  }

  /**
   * Deterministic hash-based embedding for dev/test when no external AI provider is configured.
   * Produces a normalized vector of the given dimension.
   * Not semantically meaningful - use a real embedding API in production.
   */
  private getLocalEmbedding(text: string, dimension: number): number[] {
    const embedding = new Array(dimension).fill(0);
    const chars = text.split('');
    for (let i = 0; i < chars.length; i++) {
      const idx = i % dimension;
      embedding[idx] += chars[i].charCodeAt(0) / 255;
    }
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        embedding[i] /= norm;
      }
    }
    return embedding;
  }
}
