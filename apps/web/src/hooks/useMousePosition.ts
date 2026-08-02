'use client';

import { useState, useEffect } from 'react';

interface MousePosition {
  x: number;
  y: number;
  normalX: number;
  normalY: number;
}

export function useMousePosition(): MousePosition {
  const [position, setPosition] = useState<MousePosition>({
    x: 0,
    y: 0,
    normalX: 0,
    normalY: 0,
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX,
        y: e.clientY,
        normalX: (e.clientX / window.innerWidth) * 2 - 1,
        normalY: (e.clientY / window.innerHeight) * 2 - 1,
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return position;
}
