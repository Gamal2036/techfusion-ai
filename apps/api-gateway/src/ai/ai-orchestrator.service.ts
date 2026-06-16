import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from './services/encryption.service';
import { CostTrackerService } from './services/cost-tracker.service';
import { AiUsageService } from './services/ai-usage.service';
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

    const providers = await this.loadProviders(orgId);
    if (providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    const errors: string[] = [];

    for (const entry of providers) {
      const startTime = Date.now();
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
        const latencyMs = Date.now() - startTime;
        const errorMessage = (err as Error).message;

        this.logger.warn(`${entry.name} failed after ${latencyMs}ms: ${errorMessage}`);

        await this.usageService.log({
          orgId,
          conversationId: undefined,
          provider: entry.name,
          model: entry.model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          latencyMs,
          success: false,
          errorMessage,
        });

        errors.push(`${entry.name}: ${errorMessage}`);
      }
    }

    throw new Error(`All AI providers failed: ${errors.join('; ')}`);
  }

  async embed(orgId: string, opts: EmbeddingOptions): Promise<EmbeddingResult> {
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
}
