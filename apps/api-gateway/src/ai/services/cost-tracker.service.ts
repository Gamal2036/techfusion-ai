import { Injectable } from '@nestjs/common';

interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-sonnet-4': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-5-sonnet-20241022': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-haiku-20240307': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'gpt-4o': { inputPer1k: 0.0025, outputPer1k: 0.01 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
};

const DEFAULT_PRICING: ModelPricing = { inputPer1k: 0.003, outputPer1k: 0.015 };

@Injectable()
export class CostTrackerService {
  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = PRICING[model] || DEFAULT_PRICING;
    const inputCost = (promptTokens / 1000) * pricing.inputPer1k;
    const outputCost = (completionTokens / 1000) * pricing.outputPer1k;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }
}
