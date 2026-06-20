import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiOrchestratorService } from '../ai/ai-orchestrator.service';
import { KbArticle, KbEmbedding, Prisma } from '@prisma/client';

type EmbeddingWithArticle = Prisma.KbEmbeddingGetPayload<{ include: { article: true } }>;

export interface CreateKbArticleDto {
  title: string;
  markdown: string;
}

export interface UpdateKbArticleDto {
  title?: string;
  markdown?: string;
}

export interface KbQueryRequest {
  query: string;
  topK?: number; // Number of results to return, default 5
}

export interface RetrievedChunk {
  id: string;
  articleId: string;
  articleTitle: string;
  chunkIndex: number;
  chunkText: string;
  similarity: number; // Cosine similarity score 0-1
}

// Embedding dimension
// Production: 1536 (text-embedding-3-small or similar)
// Dev/test fallback also produces 1536-dim vectors
const EMBEDDING_DIMENSION = 1536;

@Injectable()
export class KbService {
  private readonly logger = new Logger(KbService.name);

  constructor(
    private prisma: PrismaService,
    private aiOrchestrator: AiOrchestratorService,
  ) {}

  /**
   * Create a new KB article and automatically chunk and embed it
   */
  async createArticle(
    orgId: string,
    dto: CreateKbArticleDto,
  ): Promise<KbArticle> {
    // Create the article
    const article = await this.prisma.kbArticle.create({
      data: {
        orgId,
        title: dto.title,
        markdown: dto.markdown,
      },
    });

    // Chunk and embed the markdown
    await this.chunkAndEmbedArticle(orgId, article.id);

    return article;
  }

  /**
   * Get all articles for an organization
   */
  async getArticles(orgId: string): Promise<KbArticle[]> {
    return this.prisma.kbArticle.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single article by ID
   */
  async getArticle(articleId: string, orgId: string): Promise<KbArticle | null> {
    return this.prisma.kbArticle.findFirst({
      where: { id: articleId, orgId },
    });
  }

  /**
   * Update an article and re-chunk/re-embed if markdown changed
   */
  async updateArticle(
    articleId: string,
    orgId: string,
    dto: UpdateKbArticleDto,
  ): Promise<KbArticle> {
    const article = await this.getArticle(articleId, orgId);
    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    const updated = await this.prisma.kbArticle.update({
      where: { id: articleId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.markdown !== undefined && { markdown: dto.markdown }),
      },
    });

    // If markdown changed, re-chunk and embed
    if (dto.markdown !== undefined) {
      // Delete old embeddings
      await this.prisma.kbEmbedding.deleteMany({
        where: { articleId },
      });
      // Create new embeddings
      await this.chunkAndEmbedArticle(orgId, articleId);
    }

    return updated;
  }

  /**
   * Delete an article (embeddings cascade delete via schema)
   */
  async deleteArticle(articleId: string, orgId: string): Promise<void> {
    const article = await this.getArticle(articleId, orgId);
    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    await this.prisma.kbArticle.delete({
      where: { id: articleId },
    });
  }

  /**
   * Internal: Split markdown into chunks
   */
  private splitIntoChunks(markdown: string, chunkSize = 500, overlap = 100): string[] {
    const chunks: string[] = [];
    let pos = 0;

    while (pos < markdown.length) {
      const end = Math.min(pos + chunkSize, markdown.length);
      chunks.push(markdown.substring(pos, end));
      const next = end - overlap;
      // Ensure we always advance at least 1 character to avoid infinite loop
      pos = next > pos ? next : pos + 1;
    }

    return chunks;
  }

  /**
   * Internal: Chunk article and embed each chunk
   */
  private async chunkAndEmbedArticle(orgId: string, articleId: string): Promise<void> {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    // Split into chunks
    const chunks = this.splitIntoChunks(article.markdown);

    // Embed each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];

      try {
        // Get embedding from AI provider
        const embedding = await this.aiOrchestrator.getEmbedding(
          orgId,
          chunkText,
          EMBEDDING_DIMENSION,
        );

        // Validate embedding
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSION) {
          throw new Error(
            `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${embedding?.length}. ` +
            `Check that the AI provider's embedding model matches EMBEDDING_DIMENSION.`,
          );
        }

        // Store the embedding
        await this.prisma.kbEmbedding.create({
          data: {
            articleId,
            chunkIndex: i,
            chunkText,
            embedding: embedding, // Stored as JSON array
          },
        });
      } catch (error) {
        this.logger.error(`Failed to embed chunk ${i} of article ${articleId}: ${error}`);
        throw error;
      }
    }

    this.logger.log(
      `Successfully chunked and embedded article ${articleId} into ${chunks.length} chunks`,
    );
  }

  /**
   * Query KB by semantic similarity
   * 1. Embed the query
   * 2. Find top-K similar chunks using cosine similarity
   * 3. Return with source article info
   */
  async queryKb(orgId: string, req: KbQueryRequest): Promise<RetrievedChunk[]> {
    const topK = req.topK || 5;

    // Get embedding for the query
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.aiOrchestrator.getEmbedding(
        orgId,
        req.query,
        EMBEDDING_DIMENSION,
      );
    } catch (error) {
      this.logger.error(`Failed to embed query: ${error}`);
      throw error;
    }

    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Invalid query embedding: expected ${EMBEDDING_DIMENSION} dimensions, got ${queryEmbedding?.length}`,
      );
    }

    // Get all embeddings for this org
    const embeddings = await this.prisma.kbEmbedding.findMany({
      where: {
        article: {
          orgId,
        },
      },
      include: {
        article: true,
      },
    });

    // Compute cosine similarity for each embedding
    const scored = embeddings
      .filter((emb: EmbeddingWithArticle) => {
        const stored = emb.embedding as number[];
        if (!Array.isArray(stored) || stored.length !== EMBEDDING_DIMENSION) {
          this.logger.warn(
            `Skipping embedding ${emb.id}: expected ${EMBEDDING_DIMENSION} dimensions, got ${stored?.length}`,
          );
          return false;
        }
        return true;
      })
      .map((emb: EmbeddingWithArticle) => {
        const similarity = this.cosineSimilarity(
          queryEmbedding,
          emb.embedding as number[],
        );
        return {
          embedding: emb,
          similarity,
        };
      })
      .sort((a: { similarity: number }, b: { similarity: number }) => b.similarity - a.similarity)
      .slice(0, topK);

    // Convert to response format
    return scored.map((item: { embedding: EmbeddingWithArticle; similarity: number }) => ({
      id: item.embedding.id,
      articleId: item.embedding.articleId,
      articleTitle: item.embedding.article.title,
      chunkIndex: item.embedding.chunkIndex,
      chunkText: item.embedding.chunkText,
      similarity: item.similarity,
    }));
  }

  /**
   * Compute cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}
