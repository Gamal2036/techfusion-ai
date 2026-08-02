'use client';

import { useRef } from 'react';
import { CommandCore } from './CommandCore';
import { InfrastructureField } from './InfrastructureField';
import { useEnvironmentPointer } from './useEnvironmentPointer';
import './auth-environment.css';

const SCAN_ANIMATION = 'tf-scan-h 28s linear infinite';

export function AuthEnvironment() {
  const envRef = useRef<HTMLDivElement>(null);
  useEnvironmentPointer(envRef);

  return (
    <>
      <div
        ref={envRef}
        data-tf-env
        aria-hidden="true"
        className="tf-env pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* L5 — atmosphere (all viewports) */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 16% 10%, hsl(var(--surface-selected) / 0.5), transparent 62%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(85% 65% at 74% 20%, hsl(var(--surface-interactive) / 0.4), transparent 62%)',
            }}
          />
          <div
            className="absolute inset-x-0 top-[38%] hidden h-[26%] lg:block"
            style={{
              background:
                'radial-gradient(55% 100% at 50% 100%, hsl(var(--primary) / 0.05), transparent 70%)',
            }}
          />
        </div>

        {/* Desktop spatial scene — perspective camera */}
        <div className="tf-env-scene hidden lg:block">
          {/* FAR PLANE — atmospheric infrastructure */}
          <div className="tf-plane tf-plane-bg">
            <svg
              viewBox="0 0 1440 900"
              preserveAspectRatio="xMidYMid slice"
              className="h-full w-full opacity-50"
              focusable="false"
            >
              <defs>
                <pattern id="tf-far-grid" width="180" height="180" patternUnits="userSpaceOnUse">
                  <circle cx="0" cy="0" r="1" className="fill-border/40" />
                </pattern>
              </defs>
              <rect width="1440" height="900" fill="url(#tf-far-grid)" opacity="0.35" />
              <path
                d="M 0 640 L 1440 640"
                stroke="currentColor"
                className="text-border/15"
              />
              <path
                d="M 0 420 L 300 420 L 300 200 L 520 200"
                fill="none"
                stroke="currentColor"
                className="text-border/10"
              />
              <path
                d="M 1120 180 L 1120 520 L 1440 520"
                fill="none"
                stroke="currentColor"
                className="text-border/10"
              />
            </svg>
          </div>

          {/* FRAMES PLANE — receding architectural depth frames */}
          <div className="tf-plane tf-plane-frames">
            <div className="absolute inset-x-8 inset-y-6 rounded-sm border border-border/10" />
            <div className="absolute inset-x-16 inset-y-12 rounded-sm border border-border/5" />
            <div className="absolute inset-x-28 inset-y-24 rounded-sm border border-border/5" />
          </div>

          {/* MID PLANE — horizon + infrastructure + scan */}
          <div className="tf-plane tf-plane-mid">
            <div className="tf-horizon-behind absolute inset-x-0 top-[54%]">
              <div className="h-px w-full bg-border/10" />
            </div>

            <div className="absolute left-0 top-1/2 h-[92vh] max-h-[48rem] w-[58%] -translate-y-1/2">
              <InfrastructureField />
            </div>

            {/* Command Horizon — signature, shared across both sides */}
            <div className="tf-horizon-main absolute inset-x-0 top-[54%]">
              <div className="relative h-px w-full bg-border/20">
                <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              </div>
              <span className="absolute left-1/2 top-1/2 hidden h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-border-strong/70 sm:block" />
              <span className="absolute left-1/2 top-1/2 hidden h-px w-16 -translate-x-1/2 -translate-y-1/2 bg-border-strong/50 sm:block" />
              <span className="absolute left-[22%] top-1/2 hidden h-2 w-px -translate-y-1/2 bg-border/35 sm:block" />
              <span className="absolute left-[38%] top-1/2 hidden h-2 w-px -translate-y-1/2 bg-border/25 sm:block" />
              <span className="absolute left-[64%] top-1/2 hidden h-2.5 w-px -translate-y-1/2 bg-border/30 sm:block" />
              <span className="absolute left-[78%] top-1/2 hidden h-2 w-px -translate-y-1/2 bg-border/20 sm:block" />
            </div>

            {/* security scan — slow horizontal pass */}
            <div
              className="tf-scan-wrap tf-env-animate absolute inset-y-0 left-0 w-full"
              style={{ animation: SCAN_ANIMATION }}
            >
              <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
            </div>
          </div>

          {/* FOREGROUND PLANE — command core + front horizon */}
          <div className="tf-plane tf-plane-fg">
            <CommandCore />
            <div className="tf-horizon-front absolute inset-x-[16%] top-[54%]">
              <div className="relative h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent">
                <span className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-primary/35" />
              </div>
            </div>
          </div>

          {/* LIGHT PLANE — reactive lighting behind the console */}
          <div className="tf-plane tf-plane-light">
            <div className="tf-focus-pool absolute right-[3%] top-1/2 hidden h-[64%] w-[38%] -translate-y-1/2 lg:block">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(62% 55% at 50% 50%, hsl(var(--primary) / 0.07), transparent 72%)',
                }}
              />
              <div className="absolute bottom-[14%] right-0 top-[14%] w-px bg-border/15" />
            </div>

            <div className="tf-converge-pool absolute right-[3%] top-1/2 hidden h-[70%] w-[40%] -translate-y-1/2 lg:block" />
            <div className="tf-mfa-perimeter absolute right-[3%] top-1/2 hidden h-[74%] w-[42%] -translate-y-1/2 lg:block" />

            <div className="tf-error-break absolute left-[56%] right-[4%] top-[30%] hidden h-px lg:block" />
          </div>
        </div>

        {/* Mobile cue — small Command Horizon + calibration signature */}
        <div className="tf-mobile-cue absolute inset-x-0 top-[60%] lg:hidden">
          <div className="relative h-px w-full bg-border/15">
            <span className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45 border border-border/30" />
          </div>
          <span className="absolute left-[24%] top-1/2 h-2 w-px -translate-y-1/2 bg-border/20" />
          <span className="absolute right-[24%] top-1/2 h-2 w-px -translate-y-1/2 bg-border/20" />
        </div>
      </div>
    </>
  );
}
