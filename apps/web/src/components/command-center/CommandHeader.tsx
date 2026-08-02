'use client';

export function CommandHeader({ asOf, stale }: { asOf?: string | null; stale?: boolean }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Command Center</h1>
        <p className="mt-1 text-sm text-text-muted">
          Live operational state of your managed devices and infrastructure.
        </p>
      </div>
      {asOf && (
        <p className="text-xs text-text-muted tabular-nums">
          as of {asOf}
          {stale && <span className="ml-2 font-medium text-warning">stale</span>}
        </p>
      )}
    </header>
  );
}
