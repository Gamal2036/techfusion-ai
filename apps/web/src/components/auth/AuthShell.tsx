'use client';

import { AuthEnvironment } from '@/components/auth/AuthEnvironment';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { AuthLogo } from '@/components/auth/AuthLogo';

interface AuthShellProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ children, footer }: AuthShellProps) {
  return (
    <div
      data-auth-root
      className="relative flex min-h-screen flex-col overflow-hidden bg-surface text-foreground lg:flex-row"
    >
      <AuthEnvironment />

      <section
        className="relative order-2 z-10 flex flex-col justify-center px-6 pb-12 pt-4 sm:px-10 lg:order-1 lg:w-[55%] lg:border-r lg:border-border lg:px-14 lg:py-0"
        aria-label="TechFusion-AI overview"
      >
        <div className="relative z-10 mx-auto w-full max-w-xl animate-slide-up motion-reduce:animate-none lg:mx-0">
          <AuthBrandPanel variant="login" />
        </div>
      </section>

      <main className="relative order-1 z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:order-2 lg:w-[45%] lg:px-14 lg:py-16">
        <div
          className="w-full max-w-[440px] animate-slide-up motion-reduce:animate-none"
          style={{ animationDelay: '0.12s', animationFillMode: 'both' }}
        >
          <div className="tf-console group relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 hidden rounded-sm border border-border/30 sm:block"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 hidden rounded-sm border border-border/15 sm:block"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-3 -top-3 hidden h-2.5 w-2.5 border-l border-t border-border-strong/60 sm:block"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 -top-3 hidden h-2.5 w-2.5 border-r border-t border-border-strong/60 sm:block"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 -left-3 hidden h-2.5 w-2.5 border-l border-b border-border-strong/60 sm:block"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 -right-3 hidden h-2.5 w-2.5 border-r border-b border-border-strong/60 sm:block"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-8 hidden rounded-sm opacity-0 transition-opacity duration-500 group-focus-within:opacity-100 group-hover:opacity-60 motion-reduce:transition-none sm:block"
              style={{
                background:
                  'radial-gradient(70% 62% at 50% 50%, hsl(var(--primary) / 0.06), transparent 72%)',
              }}
            />
            <AuthLogo className="mb-6 lg:hidden" />
            {children}
            {footer && (
              <div className="mt-6 text-center text-sm text-text-secondary">
                {footer}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
