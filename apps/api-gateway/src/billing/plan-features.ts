export enum PlanTier {
  Free = 'Free',
  Pro = 'Pro',
  Business = 'Business',
  Enterprise = 'Enterprise',
}

export const PLAN_HIERARCHY: Record<string, number> = {
  Free: 0,
  Pro: 1,
  Business: 2,
  Enterprise: 3,
};

export interface PlanLimits {
  maxDevices: number;
  maxReportsPerMonth: number;
  maxAiQueriesPerMonth: number;
  maxTeamMembers: number;
  maxAlertRules: number;
}

export interface PlanFeatures {
  analyticsExport: boolean;
  customBranding: boolean;
  remoteSupport: boolean;
  sso: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export interface PlanConfig {
  tier: PlanTier;
  label: string;
  price: number; // cents per month
  limits: PlanLimits;
  features: PlanFeatures;
  stripePriceId: string;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  [PlanTier.Free]: {
    tier: PlanTier.Free,
    label: 'Free',
    price: 0,
    limits: {
      maxDevices: 3,
      maxReportsPerMonth: 5,
      maxAiQueriesPerMonth: 100,
      maxTeamMembers: 1,
      maxAlertRules: 5,
    },
    features: {
      analyticsExport: false,
      customBranding: false,
      remoteSupport: false,
      sso: false,
      apiAccess: false,
      prioritySupport: false,
    },
    stripePriceId: '',
  },
  [PlanTier.Pro]: {
    tier: PlanTier.Pro,
    label: 'Pro',
    price: 2900,
    limits: {
      maxDevices: 25,
      maxReportsPerMonth: 50,
      maxAiQueriesPerMonth: 1000,
      maxTeamMembers: 5,
      maxAlertRules: 20,
    },
    features: {
      analyticsExport: true,
      customBranding: true,
      remoteSupport: false,
      sso: false,
      apiAccess: true,
      prioritySupport: false,
    },
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
  },
  [PlanTier.Business]: {
    tier: PlanTier.Business,
    label: 'Business',
    price: 9900,
    limits: {
      maxDevices: 100,
      maxReportsPerMonth: 200,
      maxAiQueriesPerMonth: 5000,
      maxTeamMembers: 20,
      maxAlertRules: 50,
    },
    features: {
      analyticsExport: true,
      customBranding: true,
      remoteSupport: true,
      sso: false,
      apiAccess: true,
      prioritySupport: true,
    },
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID || 'price_business',
  },
  [PlanTier.Enterprise]: {
    tier: PlanTier.Enterprise,
    label: 'Enterprise',
    price: 29900,
    limits: {
      maxDevices: 999999,
      maxReportsPerMonth: 999999,
      maxAiQueriesPerMonth: 999999,
      maxTeamMembers: 999,
      maxAlertRules: 999,
    },
    features: {
      analyticsExport: true,
      customBranding: true,
      remoteSupport: true,
      sso: true,
      apiAccess: true,
      prioritySupport: true,
    },
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
  },
};

export function getPlanConfig(plan: string): PlanConfig {
  return PLAN_CONFIGS[plan as PlanTier] || PLAN_CONFIGS[PlanTier.Free];
}

export function meetsPlanRequirement(orgPlan: string, requiredPlan: string): boolean {
  const orgLevel = PLAN_HIERARCHY[orgPlan] ?? 0;
  const reqLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;
  return orgLevel >= reqLevel;
}
