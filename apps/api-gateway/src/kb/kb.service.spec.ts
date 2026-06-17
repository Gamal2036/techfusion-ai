import { Test, TestingModule } from '@nestjs/testing';
import { KbService } from './kb.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';

describe('KbService', () => {
  let service: KbService;
  let prisma: PrismaService;
  let aiOrchestrator: AiOrchestratorService;

  const mockOrgId = 'test-org-id';
  const mockArticleId = 'test-article-id';
  const mockEmbedding = Array(1536).fill(0.1); // Mock embedding

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbService,
        {
          provide: PrismaService,
          useValue: {
            kbArticle: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            kbEmbedding: {
              create: jest.fn(),
              findMany: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
        {
          provide: AiOrchestratorService,
          useValue: {
            getEmbedding: jest.fn().mockResolvedValue(mockEmbedding),
          },
        },
      ],
    }).compile();

    service = module.get<KbService>(KbService);
    prisma = module.get<PrismaService>(PrismaService);
    aiOrchestrator = module.get<AiOrchestratorService>(AiOrchestratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createArticle', () => {
    it('should create article and chunk/embed it', async () => {
      const dto = { title: 'Test', markdown: '# Test\nContent' };
      const mockArticle = { id: mockArticleId, orgId: mockOrgId, ...dto, createdAt: new Date(), updatedAt: new Date() };

      (prisma.kbArticle.create as jest.Mock).mockResolvedValueOnce(mockArticle);
      (prisma.kbArticle.findUnique as jest.Mock).mockResolvedValueOnce(mockArticle);
      (prisma.kbEmbedding.create as jest.Mock).mockResolvedValueOnce({});

      const result = await service.createArticle(mockOrgId, dto);

      expect(result).toEqual(mockArticle);
      expect(prisma.kbArticle.create).toHaveBeenCalledWith({
        data: { orgId: mockOrgId, ...dto },
      });
      expect(aiOrchestrator.getEmbedding).toHaveBeenCalled();
    });
  });

  describe('queryKb', () => {
    it('should query and return top-k similar chunks', async () => {
      const query = 'How to fix device?';
      const mockChunks = [
        {
          id: 'emb-1',
          articleId: mockArticleId,
          chunkIndex: 0,
          chunkText: 'Device troubleshooting...',
          embedding: mockEmbedding,
          article: { id: mockArticleId, title: 'Troubleshooting', markdown: '', orgId: mockOrgId, createdAt: new Date(), updatedAt: new Date() },
        },
      ];

      (prisma.kbEmbedding.findMany as jest.Mock).mockResolvedValueOnce(mockChunks);
      (aiOrchestrator.getEmbedding as jest.Mock).mockResolvedValueOnce(mockEmbedding);

      const results = await service.queryKb(mockOrgId, { query, topK: 5 });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].articleTitle).toBe('Troubleshooting');
      expect(aiOrchestrator.getEmbedding).toHaveBeenCalledWith(mockOrgId, query, 1536);
    });
  });

  describe('Cosine similarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];

      // Call via queryKb to test indirectly
      // Similarity of identical vectors should be 1
      expect(service['cosineSimilarity'](a, b)).toBeCloseTo(1);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];

      expect(service['cosineSimilarity'](a, b)).toBeCloseTo(0);
    });
  });

  describe('Chunking', () => {
    it('should split text into chunks with overlap', () => {
      const text = 'a'.repeat(1000); // 1000 chars

      const chunks = service['splitIntoChunks'](text, 500, 100);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(500);
    });
  });
});
