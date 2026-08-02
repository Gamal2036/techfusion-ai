import { SeverityBucket } from './dashboard.types';

const CANONICAL_SEVERITIES: ReadonlySet<string> = new Set([
  'critical',
  'high',
  'medium',
  'low',
  'warning',
]);

export function normalizeSeverity(
  value: string | null | undefined,
): SeverityBucket {
  if (!value) return 'unknown';
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'unknown';
  return CANONICAL_SEVERITIES.has(normalized)
    ? (normalized as SeverityBucket)
    : 'unknown';
}
