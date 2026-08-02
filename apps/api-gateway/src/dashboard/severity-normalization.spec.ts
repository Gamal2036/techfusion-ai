import { normalizeSeverity } from './severity-normalization';

describe('normalizeSeverity', () => {
  it('returns the canonical bucket for canonical severities', () => {
    expect(normalizeSeverity('critical')).toBe('critical');
    expect(normalizeSeverity('high')).toBe('high');
    expect(normalizeSeverity('medium')).toBe('medium');
    expect(normalizeSeverity('low')).toBe('low');
    expect(normalizeSeverity('warning')).toBe('warning');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(normalizeSeverity('CRITICAL')).toBe('critical');
    expect(normalizeSeverity('  High  ')).toBe('high');
    expect(normalizeSeverity('WaRnInG')).toBe('warning');
  });

  it('maps unknown values to unknown without escalation', () => {
    expect(normalizeSeverity('info')).toBe('unknown');
    expect(normalizeSeverity('warn')).toBe('unknown');
    expect(normalizeSeverity('sev-3')).toBe('unknown');
    expect(normalizeSeverity('')).toBe('unknown');
  });

  it('maps null and undefined to unknown', () => {
    expect(normalizeSeverity(null)).toBe('unknown');
    expect(normalizeSeverity(undefined)).toBe('unknown');
  });
});
