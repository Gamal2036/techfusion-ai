'use client';

import type { ReactNode } from 'react';

/**
 * L1 Signal Field — the container region that holds live operational state
 * (state banner + primary fleet counts). Decorative L0/L2 planes sit behind
 * it; the field itself is the interactive, semantic layer.
 */
export function SignalField({
  children,
  ariaLabel = 'Live operational state',
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <section aria-label={ariaLabel} className="cmd-signal-field">
      {children}
    </section>
  );
}
