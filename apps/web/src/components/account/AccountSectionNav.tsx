'use client';

import { cn } from '@techfusion/ui';
import { ACCOUNT_SECTIONS, type AccountSectionId } from '@/lib/account-sections';

/**
 * ACC-UX-02C — Account section navigation. Renders real anchor links so the
 * fragment (#security, …) is the single source of truth and native browser
 * scrolling applies. The active section is highlighted via aria-current.
 */
export function AccountSectionNav({ active }: { active: AccountSectionId }) {
  return (
    <nav
      aria-label="Account sections"
      className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-subtle/50 p-1"
    >
      {ACCOUNT_SECTIONS.map((section) => {
        const isActive = active === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={isActive ? 'location' : undefined}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'bg-background text-text-primary shadow-sm'
                : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
            )}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
