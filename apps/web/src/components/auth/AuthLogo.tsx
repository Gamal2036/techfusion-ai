'use client';

export function AuthLogo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        TF
      </div>
      <span className="text-base font-semibold tracking-tight text-text-primary">
        TechFusion<span className="text-text-secondary">-AI</span>
      </span>
    </div>
  );
}
