'use client';

import { useMemo } from 'react';

export type StrengthLevel = 'weak' | 'medium' | 'strong';

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: number;
  level: StrengthLevel;
  requirements: PasswordRequirement[];
}

const RULES: Array<{
  id: string;
  label: string;
  test: (value: string) => boolean;
}> = [
  { id: 'length', label: '8+ characters', test: (v) => v.length >= 8 },
  { id: 'uppercase', label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'Lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'Number', test: (v) => /\d/.test(v) },
  {
    id: 'special',
    label: 'Special character',
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
];

export function evaluatePasswordStrength(
  password: string,
): PasswordStrengthResult {
  const requirements = RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));

  const score = requirements.filter((req) => req.met).length;

  let level: StrengthLevel = 'weak';
  if (score >= 5) level = 'strong';
  else if (score >= 3) level = 'medium';

  return { score, level, requirements };
}

export function usePasswordStrength(password: string): PasswordStrengthResult {
  return useMemo(() => evaluatePasswordStrength(password), [password]);
}
