import { worstRiskLevel } from './worst-risk-level';

describe('worstRiskLevel', () => {
  it('returns null for an empty list', () => {
    expect(worstRiskLevel([])).toBeNull();
  });

  it('returns null when no value is a known risk level', () => {
    expect(worstRiskLevel(['nonsense', null, undefined])).toBeNull();
  });

  it('returns the single known level', () => {
    expect(worstRiskLevel(['high'])).toBe('high');
  });

  it('returns the worst present level', () => {
    expect(worstRiskLevel(['low', 'medium', 'high'])).toBe('high');
    expect(worstRiskLevel(['high', 'critical'])).toBe('critical');
    expect(worstRiskLevel(['critical', 'medium', 'low'])).toBe('critical');
  });

  it('ignores unknown values without treating them as risk', () => {
    expect(worstRiskLevel(['low', 'mystery', 'medium'])).toBe('medium');
  });

  it('is case-insensitive', () => {
    expect(worstRiskLevel(['Critical'])).toBe('critical');
  });

  it('does not treat empty strings as a risk level', () => {
    expect(worstRiskLevel(['', '  '])).toBeNull();
  });
});
