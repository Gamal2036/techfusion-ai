'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keeps keyboard focus within the returned container while `active`, and
 * restores focus to the previously focused element when the trap closes.
 * Modal-like overlays (command palette, drawer) use this so tab navigation
 * never escapes into the page behind them (D07).
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    const first = focusables()[0];
    first?.focus();
    container.addEventListener('keydown', onKeyDown);

    return () => {
      container.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return containerRef;
}
