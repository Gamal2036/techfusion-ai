'use client';

import { useEffect, type RefObject } from 'react';

const MAX_X = 14;
const MAX_Y = 8;
const ROT_X_FACTOR = 0.05;
const ROT_Y_FACTOR = 0.06;

function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function useEnvironmentPointer(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) return;

    const raf =
      typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
    const caf =
      typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null;
    if (!raf || !caf) return;

    let frame = 0;
    let tx = 0;
    let ty = 0;

    const write = () => {
      frame = 0;
      el.style.setProperty('--tf-px', String(tx));
      el.style.setProperty('--tf-py', String(ty));
      el.style.setProperty('--tf-rotx', String(ty * ROT_X_FACTOR));
      el.style.setProperty('--tf-roty', String(tx * ROT_Y_FACTOR));
    };

    const schedule = () => {
      if (!frame) frame = raf(write);
    };

    const onMove = (e: MouseEvent) => {
      tx = ((e.clientX / window.innerWidth) * 2 - 1) * MAX_X;
      ty = ((e.clientY / window.innerHeight) * 2 - 1) * MAX_Y;
      schedule();
    };

    const onLeave = () => {
      tx = 0;
      ty = 0;
      schedule();
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (frame) caf(frame);
    };
  }, [ref]);
}
