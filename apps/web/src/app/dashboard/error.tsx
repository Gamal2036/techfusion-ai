'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { GlassPanel } from '@techfusion/ui';
import { OPERATIONAL_STATE_LABELS } from '@/lib/command-state';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="command-center">
      <div className="cmd-content space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Command Center</h1>
          <p className="mt-1 text-sm text-text-muted">
            Live operational state of your managed devices and infrastructure.
          </p>
        </header>

        <GlassPanel intensity="light" className="p-5">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text-muted">
                  <span className="h-2 w-2 rounded-full bg-text-muted" aria-hidden="true" />
                  {OPERATIONAL_STATE_LABELS.UNKNOWN}
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                Summary is temporarily unavailable. Try again in a moment.
              </p>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel intensity="light" className="p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/20 to-orange-600/20">
            <AlertTriangle className="h-8 w-8 text-warning" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-text-primary">Something went wrong</h2>
          <p className="mb-2 text-sm text-text-secondary">
            An unexpected error occurred while rendering this page.
          </p>
          <p className="mb-6 text-xs text-text-disabled">
            {error.message || 'Please try refreshing the page'}
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="cmd-focus-ring h-11 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 font-medium text-text-primary transition-all hover:from-blue-500 hover:to-purple-500"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/dashboard'; }}
              className="cmd-focus-ring h-11 rounded-xl border border-border px-6 text-text-secondary transition-all hover:bg-surface-subtle hover:text-text-primary"
            >
              Back to Dashboard
            </button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
