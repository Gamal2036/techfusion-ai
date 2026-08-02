import { cn } from '@techfusion/ui';

interface AuthLogoProps {
  className?: string;
}

export function AuthLogo({ className }: AuthLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
        <span className="text-sm font-semibold text-primary-foreground">
          TF
        </span>
      </div>
      <span className="text-base font-semibold tracking-tight text-text-primary">
        TechFusion
        <span className="text-text-secondary">-AI</span>
      </span>
    </div>
  );
}
