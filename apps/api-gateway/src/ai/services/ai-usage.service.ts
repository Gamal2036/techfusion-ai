import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async log(opts: {
    orgId: string;
    conversationId?: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    latencyMs: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await this.prisma.aiUsageLog.create({
      data: {
        orgId: opts.orgId,
        conversationId: opts.conversationId,
        provider: opts.provider,
        model: opts.model,
        promptTokens: opts.promptTokens,
        completionTokens: opts.completionTokens,
        totalTokens: opts.totalTokens,
        costUsd: opts.costUsd,
        latencyMs: opts.latencyMs,
        success: opts.success,
        errorMessage: opts.errorMessage || null,
      },
    });
  }
}
