'use client';

function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -left-[25%] -top-[20%] h-[70%] w-[70%] rounded-full opacity-[0.12]"
        style={{
          background:
            'radial-gradient(circle, rgba(59,130,246,0.6) 0%, rgba(99,102,241,0.3) 40%, transparent 70%)',
          animation: 'auroraDrift1 25s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -right-[15%] top-[5%] h-[65%] w-[65%] rounded-full opacity-[0.1]"
        style={{
          background:
            'radial-gradient(circle, rgba(6,182,212,0.5) 0%, rgba(59,130,246,0.25) 40%, transparent 70%)',
          animation: 'auroraDrift2 30s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-15%] left-[25%] h-[55%] w-[55%] rounded-full opacity-[0.08]"
        style={{
          background:
            'radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(168,85,247,0.2) 40%, transparent 70%)',
          animation: 'auroraDrift3 28s ease-in-out infinite',
        }}
      />
    </div>
  );
}

function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute -left-[20%] -top-[20%] h-[70%] w-[70%] rounded-full opacity-[0.1]"
        style={{
          background:
            'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)',
          animation: 'meshDrift1 20s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -right-[15%] top-[10%] h-[60%] w-[60%] rounded-full opacity-[0.08]"
        style={{
          background:
            'radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)',
          animation: 'meshDrift2 25s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-10%] left-[30%] h-[50%] w-[50%] rounded-full opacity-[0.07]"
        style={{
          background:
            'radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)',
          animation: 'meshDrift3 22s ease-in-out infinite',
        }}
      />
    </div>
  );
}

function DigitalGrid() {
  return (
    <div
      className="absolute inset-0 overflow-hidden opacity-[0.035]"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)',
        }}
      />
    </div>
  );
}

function LightBeams() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 opacity-[0.05]"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(59,130,246,0.7) 25%, rgba(6,182,212,0.5) 55%, transparent 100%)',
          animation: 'lightSweep 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute left-[30%] top-0 h-full w-[1px] opacity-[0.03]"
        style={{
          background:
            'linear-gradient(to bottom, transparent 10%, rgba(139,92,246,0.5) 50%, transparent 90%)',
          animation: 'lightSweep 12s ease-in-out infinite 2s',
        }}
      />
      <div
        className="absolute left-[70%] top-0 h-full w-[1px] opacity-[0.025]"
        style={{
          background:
            'linear-gradient(to bottom, transparent 20%, rgba(6,182,212,0.4) 60%, transparent 100%)',
          animation: 'lightSweep 10s ease-in-out infinite 4s',
        }}
      />
    </div>
  );
}

function EnergyWaves() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      {[0, 1.5, 3].map((delay) => (
        <div
          key={delay}
          className="absolute h-[300px] w-[300px] rounded-full border border-blue-500/[0.04]"
          style={{
            animation: `energyWave 8s ease-out infinite ${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function NoiseOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.025]"
      aria-hidden="true"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        animation: 'noiseShift 0.5s steps(2) infinite',
      }}
    />
  );
}

export function HeroBackground() {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Aurora />
      <GradientMesh />
      <DigitalGrid />
      <LightBeams />
      <EnergyWaves />
      <NoiseOverlay />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050710] via-[#080b16] to-[#050710]" />
    </div>
  );
}
