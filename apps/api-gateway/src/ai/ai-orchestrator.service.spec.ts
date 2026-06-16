import { Test, TestingModule } from '@nestjs/testing';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { EncryptionService } from './services/encryption.service';
import { CostTrackerService } from './services/cost-tracker.service';
import { AiUsageService } from './services/ai-usage.service';
import { PrismaService } from '../prisma/prisma.service';
import { LlmProvider, CompletionResult, CompletionOptions, EmbeddingOptions, EmbeddingResult } from './interfaces/llm-provider.interface';

class MockSuccessProvider implements LlmProvider {
  readonly name = 'mock-primary';
  async complete(_opts: CompletionOptions): Promise<CompletionResult> {
    return { content: 'from-primary', model: 'mock-primary', promptTokens: 10, completionTokens: 20, totalTokens: 30 };
  }
  async embed(_opts: EmbeddingOptions): Promise<EmbeddingResult> {
    return { embeddings: [[0.1]], model: 'mock-primary', totalTokens: 5 };
  }
}

class MockFailingProvider implements LlmProvider {
  readonly name = 'mock-failing';
  async complete(_opts: CompletionOptions): Promise<CompletionResult> {
    throw new Error('Primary provider timeout');
  }
  async embed(_opts: EmbeddingOptions): Promise<EmbeddingResult> {
    throw new Error('Primary provider failed');
  }
}

class MockSecondaryProvider implements LlmProvider {
  readonly name = 'mock-secondary';
  async complete(_opts: CompletionOptions): Promise<CompletionResult> {
    return { content: 'from-secondary', model: 'mock-secondary', promptTokens: 5, completionTokens: 10, totalTokens: 15 };
  }
  async embed(_opts: EmbeddingOptions): Promise<EmbeddingResult> {
    return { embeddings: [[0.2]], model: 'mock-secondary', totalTokens: 3 };
  }
}

describe('AiOrchestratorService', () => {
  let service: AiOrchestratorService;
  let usageService: AiUsageService;

  const mockPrisma = {
    organization: {
      findUnique: jest.fn().mockResolvedValue({ plan: 'Enterprise' }),
    },
    aiUsageLog: {
      count: jest.fn().mockResolvedValue(0),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiOrchestratorService,
        EncryptionService,
        CostTrackerService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AiUsageService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AiOrchestratorService>(AiOrchestratorService);
    usageService = module.get<AiUsageService>(AiUsageService);
  });

  afterEach(() => {
    service.setTestProviders(null);
    jest.clearAllMocks();
  });

  describe('fallback logic', () => {
    it('uses primary provider when it succeeds', async () => {
      service.setTestProviders([
        { name: 'primary', provider: new MockSuccessProvider(), model: 'mock-model', priority: 1 },
        { name: 'secondary', provider: new MockSecondaryProvider(), model: 'mock-model', priority: 2 },
      ]);

      const result = await service.complete('org-1', {
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'hello' }],
      });

      expect(result.content).toBe('from-primary');
      expect(usageService.log).toHaveBeenCalledTimes(1);
      const logCall = (usageService.log as jest.Mock).mock.calls[0][0];
      expect(logCall.success).toBe(true);
      expect(logCall.provider).toBe('primary');
    });

    it('falls back to secondary when primary fails', async () => {
      service.setTestProviders([
        { name: 'failing', provider: new MockFailingProvider(), model: 'mock-model', priority: 1 },
        { name: 'secondary', provider: new MockSecondaryProvider(), model: 'mock-model', priority: 2 },
      ]);

      const result = await service.complete('org-1', {
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'hello' }],
      });

      expect(result.content).toBe('from-secondary');
      expect(usageService.log).toHaveBeenCalledTimes(2);
      const calls = (usageService.log as jest.Mock).mock.calls;
      expect(calls[0][0].success).toBe(false);
      expect(calls[0][0].provider).toBe('failing');
      expect(calls[1][0].success).toBe(true);
      expect(calls[1][0].provider).toBe('secondary');
    });

    it('throws when all providers fail', async () => {
      service.setTestProviders([
        { name: 'fail-1', provider: new MockFailingProvider(), model: 'mock-model', priority: 1 },
        { name: 'fail-2', provider: new MockFailingProvider(), model: 'mock-model', priority: 2 },
      ]);

      await expect(service.complete('org-1', {
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'hello' }],
      })).rejects.toThrow('All AI providers failed');
    });

    it('records usage logs for every attempt', async () => {
      service.setTestProviders([
        { name: 'fail-1', provider: new MockFailingProvider(), model: 'mock-model', priority: 1 },
        { name: 'ok', provider: new MockSuccessProvider(), model: 'mock-model', priority: 2 },
      ]);

      await service.complete('org-1', {
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'hello' }],
      });

      expect(usageService.log).toHaveBeenCalledTimes(2);
      const calls = (usageService.log as jest.Mock).mock.calls;
      expect(calls[0][0]).toMatchObject({ provider: 'fail-1', success: false });
      expect(calls[1][0]).toMatchObject({ provider: 'ok', success: true });
      expect(calls[1][0]).toHaveProperty('latencyMs');
      expect(calls[1][0]).toHaveProperty('costUsd');
      expect(calls[1][0]).toHaveProperty('promptTokens');
      expect(calls[1][0]).toHaveProperty('completionTokens');
      expect(calls[1][0]).toHaveProperty('totalTokens');
    });
  });
});
