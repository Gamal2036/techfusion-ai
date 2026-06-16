import { getPlanConfig, meetsPlanRequirement, PLAN_CONFIGS, PlanTier, PLAN_HIERARCHY } from './plan-features';

describe('PlanFeatures', () => {
  describe('getPlanConfig', () => {
    it('returns Free config for Free plan', () => {
      const config = getPlanConfig('Free');
      expect(config.tier).toBe(PlanTier.Free);
      expect(config.limits.maxDevices).toBe(3);
      expect(config.limits.maxReportsPerMonth).toBe(5);
      expect(config.limits.maxAiQueriesPerMonth).toBe(100);
    });

    it('returns Pro config for Pro plan', () => {
      const config = getPlanConfig('Pro');
      expect(config.tier).toBe(PlanTier.Pro);
      expect(config.limits.maxDevices).toBe(25);
      expect(config.limits.maxReportsPerMonth).toBe(50);
      expect(config.limits.maxAiQueriesPerMonth).toBe(1000);
    });

    it('returns Business config for Business plan', () => {
      const config = getPlanConfig('Business');
      expect(config.tier).toBe(PlanTier.Business);
      expect(config.limits.maxDevices).toBe(100);
      expect(config.limits.maxReportsPerMonth).toBe(200);
      expect(config.features.remoteSupport).toBe(true);
    });

    it('returns Enterprise config for Enterprise plan', () => {
      const config = getPlanConfig('Enterprise');
      expect(config.tier).toBe(PlanTier.Enterprise);
      expect(config.limits.maxDevices).toBe(999999);
      expect(config.features.sso).toBe(true);
      expect(config.features.prioritySupport).toBe(true);
    });

    it('defaults to Free for unknown plan', () => {
      const config = getPlanConfig('Unknown');
      expect(config.tier).toBe(PlanTier.Free);
    });

    it('every plan has all required fields', () => {
      for (const plan of Object.values(PlanTier)) {
        const config = getPlanConfig(plan);
        expect(config.tier).toBeDefined();
        expect(config.label).toBeDefined();
        expect(config.price).toBeGreaterThanOrEqual(0);
        expect(config.limits.maxDevices).toBeGreaterThan(0);
        expect(config.limits.maxReportsPerMonth).toBeGreaterThan(0);
        expect(config.limits.maxAiQueriesPerMonth).toBeGreaterThan(0);
        expect(config.features).toBeDefined();
        expect(typeof config.features.analyticsExport).toBe('boolean');
        expect(typeof config.features.customBranding).toBe('boolean');
        expect(typeof config.features.remoteSupport).toBe('boolean');
        expect(typeof config.features.sso).toBe('boolean');
        expect(typeof config.features.apiAccess).toBe('boolean');
        expect(typeof config.features.prioritySupport).toBe('boolean');
      }
    });
  });

  describe('meetsPlanRequirement', () => {
    it('Free meets Free requirement', () => {
      expect(meetsPlanRequirement('Free', 'Free')).toBe(true);
    });

    it('Free does NOT meet Pro requirement', () => {
      expect(meetsPlanRequirement('Free', 'Pro')).toBe(false);
    });

    it('Pro meets Pro requirement', () => {
      expect(meetsPlanRequirement('Pro', 'Pro')).toBe(true);
    });

    it('Pro meets Free requirement', () => {
      expect(meetsPlanRequirement('Pro', 'Free')).toBe(true);
    });

    it('Business meets Pro requirement', () => {
      expect(meetsPlanRequirement('Business', 'Pro')).toBe(true);
    });

    it('Business meets Business requirement', () => {
      expect(meetsPlanRequirement('Business', 'Business')).toBe(true);
    });

    it('Business does NOT meet Enterprise requirement', () => {
      expect(meetsPlanRequirement('Business', 'Enterprise')).toBe(false);
    });

    it('Enterprise meets all requirements', () => {
      expect(meetsPlanRequirement('Enterprise', 'Free')).toBe(true);
      expect(meetsPlanRequirement('Enterprise', 'Pro')).toBe(true);
      expect(meetsPlanRequirement('Enterprise', 'Business')).toBe(true);
      expect(meetsPlanRequirement('Enterprise', 'Enterprise')).toBe(true);
    });

    it('unknown plan defaults to level 0', () => {
      expect(meetsPlanRequirement('Unknown', 'Free')).toBe(true);
      expect(meetsPlanRequirement('Unknown', 'Pro')).toBe(false);
    });
  });

  describe('plan hierarchy', () => {
    it('has correct hierarchy values', () => {
      expect(PLAN_HIERARCHY.Free).toBe(0);
      expect(PLAN_HIERARCHY.Pro).toBe(1);
      expect(PLAN_HIERARCHY.Business).toBe(2);
      expect(PLAN_HIERARCHY.Enterprise).toBe(3);
    });

    it('ascending order of limits across tiers', () => {
      const tiers = [PlanTier.Free, PlanTier.Pro, PlanTier.Business, PlanTier.Enterprise];
      for (const limitKey of ['maxDevices', 'maxReportsPerMonth', 'maxAiQueriesPerMonth'] as const) {
        for (let i = 1; i < tiers.length; i++) {
          const prev = getPlanConfig(tiers[i - 1]).limits[limitKey];
          const curr = getPlanConfig(tiers[i]).limits[limitKey];
          if (prev === 999999) continue; // skip if prev is already unlimited
          expect(curr).toBeGreaterThanOrEqual(prev);
        }
      }
    });
  });

  describe('feature gating', () => {
    it('Free plan has no premium features', () => {
      const config = getPlanConfig('Free');
      expect(config.features.analyticsExport).toBe(false);
      expect(config.features.customBranding).toBe(false);
      expect(config.features.remoteSupport).toBe(false);
      expect(config.features.sso).toBe(false);
      expect(config.features.apiAccess).toBe(false);
      expect(config.features.prioritySupport).toBe(false);
    });

    it('Pro plan has analytics export and custom branding', () => {
      const config = getPlanConfig('Pro');
      expect(config.features.analyticsExport).toBe(true);
      expect(config.features.customBranding).toBe(true);
      expect(config.features.remoteSupport).toBe(false);
      expect(config.features.apiAccess).toBe(true);
    });

    it('Business plan has remote support', () => {
      const config = getPlanConfig('Business');
      expect(config.features.remoteSupport).toBe(true);
      expect(config.features.prioritySupport).toBe(true);
    });

    it('Enterprise plan has all features', () => {
      const config = getPlanConfig('Enterprise');
      expect(config.features.analyticsExport).toBe(true);
      expect(config.features.customBranding).toBe(true);
      expect(config.features.remoteSupport).toBe(true);
      expect(config.features.sso).toBe(true);
      expect(config.features.apiAccess).toBe(true);
      expect(config.features.prioritySupport).toBe(true);
    });
  });
});
