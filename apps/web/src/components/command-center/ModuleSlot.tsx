'use client';

import { ChevronRight } from 'lucide-react';
import { GlassPanel } from '@techfusion/ui';

export interface ModuleSlotProps {
  overline: string;
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}

/**
 * Honest placeholder frame for a future Command Center module. Renders no
 * numbers and never fabricates content; the real module replaces this slot in
 * a later mission.
 */
export function ModuleSlot({ overline, title, description, href, hrefLabel = 'Open' }: ModuleSlotProps) {
  return (
    <GlassPanel intensity="light" className="p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
        {overline}
      </p>
      <h3 className="mt-2 text-sm font-medium text-text-primary">{title}</h3>
      <p className="mt-1 text-xs text-text-muted">{description}</p>
      {href && (
        <a
          href={href}
          className="cmd-focus-ring mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
        >
          {hrefLabel}
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </GlassPanel>
  );
}
