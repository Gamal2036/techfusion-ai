'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert } from 'lucide-react';
import { cn } from '@techfusion/ui';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type {
  PasswordStrengthResult,
  StrengthLevel,
} from './usePasswordStrength';

const LEVEL_STYLES: Record<
  StrengthLevel,
  { label: string; text: string; bar: string; fill: number }
> = {
  weak: { label: 'Weak', text: 'text-danger', bar: 'bg-danger', fill: 1 },
  medium: {
    label: 'Medium',
    text: 'text-warning',
    bar: 'bg-warning',
    fill: 2,
  },
  strong: {
    label: 'Strong',
    text: 'text-success',
    bar: 'bg-success',
    fill: 3,
  },
};

interface PasswordStrengthProps {
  result: PasswordStrengthResult;
  visible: boolean;
}

export function PasswordStrength({ result, visible }: PasswordStrengthProps) {
  const reduced = useReducedMotion();
  const { level, score, requirements } = result;
  const styles = LEVEL_STYLES[level];
  const metCount = requirements.filter((req) => req.met).length;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={
            reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }
          }
          exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={
            reduced ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }
          }
          className="overflow-hidden"
        >
          <div className="mt-2.5">
            <div
              className="flex items-center gap-2"
              role="status"
              aria-live="polite"
              aria-label={`Password strength: ${styles.label}`}
            >
              <div className="flex flex-1 gap-1.5" aria-hidden="true">
                {[1, 2, 3].map((segment) => (
                  <div
                    key={segment}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-colors duration-200',
                        segment <= styles.fill ? styles.bar : 'bg-transparent',
                      )}
                    />
                  </div>
                ))}
              </div>
              <span
                className={cn(
                  'w-16 shrink-0 text-right text-xs font-semibold',
                  styles.text,
                )}
              >
                {styles.label}
              </span>
              <span
                className="hidden text-xs text-text-secondary sm:block"
                aria-hidden="true"
              >
                {score}/5
              </span>
            </div>

            <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
              {requirements.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center gap-1.5 text-xs text-text-secondary"
                >
                  {req.met ? (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-success"
                      aria-hidden="true"
                    />
                  ) : (
                    <CircleAlert
                      className="h-3.5 w-3.5 shrink-0 text-text-muted"
                      aria-hidden="true"
                    />
                  )}
                  <span>{req.label}</span>
                </li>
              ))}
            </ul>
            <p className="sr-only">
              {metCount} of {requirements.length} requirements met.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
