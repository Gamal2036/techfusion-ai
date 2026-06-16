import { SecurityScoringService } from './security-scoring.service';

describe('SecurityScoringService', () => {
  let service: SecurityScoringService;

  beforeEach(() => {
    service = new SecurityScoringService();
  });

  describe('compute', () => {
    it('returns 100 for no findings', () => {
      const result = service.compute([]);
      expect(result.securityScore).toBe(100);
      expect(result.riskLevel).toBe('low');
      expect(result.totalFindings).toBe(0);
    });

    it('calculates correct penalty for one critical finding', () => {
      const result = service.compute([{ severity: 'critical' }]);
      expect(result.securityScore).toBe(75);
      expect(result.riskLevel).toBe('low');
      expect(result.criticalCount).toBe(1);
    });

    it('caps critical penalty at 3 findings (-75)', () => {
      const result = service.compute([
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'critical' },
      ]);
      expect(result.securityScore).toBe(25);
      expect(result.riskLevel).toBe('high');
      expect(result.criticalCount).toBe(4);
    });

    it('caps high penalty at 4 findings (-60)', () => {
      const result = service.compute([
        { severity: 'high' },
        { severity: 'high' },
        { severity: 'high' },
        { severity: 'high' },
        { severity: 'high' },
      ]);
      expect(result.securityScore).toBe(40);
      expect(result.riskLevel).toBe('high');
    });

    it('calculates mixed severities correctly', () => {
      const result = service.compute([
        { severity: 'critical' },
        { severity: 'high' },
        { severity: 'high' },
        { severity: 'medium' },
        { severity: 'low' },
        { severity: 'low' },
      ]);
      // critical: 1*25=25, high: 2*15=30, medium: 1*8=8, low: 2*3=6
      // total penalty = 25+30+8+6 = 69, score = 100-69 = 31
      expect(result.securityScore).toBe(31);
      expect(result.riskLevel).toBe('high');
      expect(result.criticalCount).toBe(1);
      expect(result.highCount).toBe(2);
      expect(result.mediumCount).toBe(1);
      expect(result.lowCount).toBe(2);
    });

    it('handles score floor at 0 for severe findings', () => {
      const result = service.compute([
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'high' },
        { severity: 'high' },
      ]);
      // critical: 3*25=75 capped, high: 2*15=30 → total 105 → score 0
      expect(result.securityScore).toBe(0);
      expect(result.riskLevel).toBe('critical');
    });

    it('returns medium risk level for score 50-74', () => {
      const result = service.compute([
        { severity: 'medium' },
        { severity: 'medium' },
        { severity: 'medium' },
        { severity: 'medium' },
      ]);
      // medium: 4*8=32 → score = 68
      expect(result.securityScore).toBe(68);
      expect(result.riskLevel).toBe('medium');
    });

    it('returns low risk level for score 75+', () => {
      const result = service.compute([
        { severity: 'low' },
        { severity: 'low' },
        { severity: 'low' },
      ]);
      // low: 3*3=9 → score = 91
      expect(result.securityScore).toBe(91);
      expect(result.riskLevel).toBe('low');
    });

    it('handles remediation by re-scoring with fewer findings', () => {
      const before = service.compute([
        { severity: 'high' },
        { severity: 'high' },
        { severity: 'medium' },
      ]);
      // high: 2*15=30, medium: 1*8=8 → total 38 → score 62 → medium
      expect(before.securityScore).toBe(62);
      expect(before.riskLevel).toBe('medium');

      const after = service.compute([
        { severity: 'medium' },
      ]);
      // medium: 1*8=8 → score 92 → low
      expect(after.securityScore).toBe(92);
      expect(after.riskLevel).toBe('low');
    });
  });
});
