'use client';

const TICKS = Array.from({ length: 14 }, (_, i) => 80 + i * 80);

export function CommandHorizon() {
  return (
    <div aria-hidden="true" className="cmd-horizon">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 64"
        preserveAspectRatio="none"
        focusable="false"
      >
        <line
          x1="0"
          y1="44"
          x2="1200"
          y2="44"
          stroke="hsl(var(--primary) / 0.35)"
          strokeWidth="1"
        />
        {TICKS.map((x) => (
          <line
            key={x}
            x1={x}
            y1="38"
            x2={x}
            y2="50"
            stroke="hsl(var(--primary) / 0.4)"
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="cmd-horizon__sweep" />
    </div>
  );
}
