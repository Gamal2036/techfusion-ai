import { SetMetadata } from '@nestjs/common';

export const PLAN_KEY = 'plan';
export const FEATURE_KEY = 'feature';

export const Plan = (plan: string) => SetMetadata(PLAN_KEY, plan);

export const RequireFeature = (feature: string) => SetMetadata(FEATURE_KEY, feature);
