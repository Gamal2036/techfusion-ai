import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { KbService, CreateKbArticleDto, UpdateKbArticleDto, KbQueryRequest } from './kb.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';

@Controller('kb')
@UseGuards(JwtAuthGuard)
export class KbController {
  constructor(private kbService: KbService) {}

  /**
   * POST /kb/articles
   * Create a new KB article
   */
  @Post('articles')
  async createArticle(
    @OrgContext() orgId: string,
    @Body() dto: CreateKbArticleDto,
  ) {
    if (!dto.title || !dto.markdown) {
      throw new BadRequestException('title and markdown are required');
    }

    const article = await this.kbService.createArticle(orgId, dto);

    return {
      success: true,
      data: article,
    };
  }

  /**
   * GET /kb/articles
   * List all articles for the organization
   */
  @Get('articles')
  async listArticles(@OrgContext() orgId: string) {
    const articles = await this.kbService.getArticles(orgId);

    return {
      success: true,
      data: articles,
      count: articles.length,
    };
  }

  /**
   * GET /kb/articles/:id
   * Get a single article
   */
  @Get('articles/:id')
  async getArticle(
    @Param('id') articleId: string,
    @OrgContext() orgId: string,
  ) {
    const article = await this.kbService.getArticle(articleId, orgId);

    if (!article) {
      throw new NotFoundException(`Article ${articleId} not found`);
    }

    return {
      success: true,
      data: article,
    };
  }

  /**
   * PUT /kb/articles/:id
   * Update an article
   */
  @Put('articles/:id')
  async updateArticle(
    @Param('id') articleId: string,
    @Body() dto: UpdateKbArticleDto,
    @OrgContext() orgId: string,
  ) {
    if (!dto.title && !dto.markdown) {
      throw new BadRequestException('At least one of title or markdown must be provided');
    }

    try {
      const article = await this.kbService.updateArticle(articleId, orgId, dto);

      return {
        success: true,
        data: article,
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * DELETE /kb/articles/:id
   * Delete an article
   */
  @Delete('articles/:id')
  async deleteArticle(
    @Param('id') articleId: string,
    @OrgContext() orgId: string,
  ) {
    try {
      await this.kbService.deleteArticle(articleId, orgId);

      return {
        success: true,
        message: 'Article deleted successfully',
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * POST /kb/query
   * Query the KB and get relevant articles/chunks
   */
  @Post('query')
  async queryKb(
    @OrgContext() orgId: string,
    @Body() req: KbQueryRequest,
  ) {
    if (!req.query || req.query.trim() === '') {
      throw new BadRequestException('query is required and cannot be empty');
    }

    try {
      const results = await this.kbService.queryKb(orgId, {
        query: req.query.trim(),
        topK: req.topK || 5,
      });

      return {
        success: true,
        data: results,
        count: results.length,
      };
    } catch (error) {
      throw new BadRequestException(`KB query failed: ${error.message}`);
    }
  }
}
