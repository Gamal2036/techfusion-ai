/**
 * Decorative ambient background: subtle grid, radial glows, and scanline.
 * Pure CSS — zero runtime cost.
 */
export function AmbientGrid() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      {/* Base grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%)',
        }}
      />
      {/* Ambient glows */}
      <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/[0.07] blur-[120px]" />
      <div className="absolute top-[30%] -left-40 h-[400px] w-[400px] rounded-full bg-purple-500/[0.05] blur-[120px]" />
      <div className="absolute top-[60%] -right-40 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
    </div>
  );
}
