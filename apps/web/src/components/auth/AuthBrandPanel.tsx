import { AuthLogo } from './AuthLogo';

interface AuthBrandPanelProps {
  variant: 'login' | 'signup';
}

export function AuthBrandPanel({ variant }: AuthBrandPanelProps) {
  const isSignup = variant === 'signup';
  const Tag = isSignup ? 'h1' : 'p';

  return (
    <div className="flex flex-col gap-5">
      <AuthLogo className="hidden lg:flex" />
      <div aria-hidden="true" className="flex items-center gap-3">
        <span className="h-px w-10 bg-border-strong/80" />
        <span className="h-[7px] w-[7px] rotate-45 border border-border-strong/90" />
        <span className="h-px w-16 bg-border/50" />
      </div>
      <Tag className="max-w-xl text-3xl font-medium leading-[1.12] tracking-tight text-text-primary sm:text-4xl lg:text-[2.625rem]">
        Complete, trustworthy command over your technology.
      </Tag>
      <p className="max-w-sm text-base leading-relaxed text-text-secondary">
        {isSignup
          ? 'Create your workspace — it takes about two minutes.'
          : 'Welcome back to your workspace. Your fleet, alerts, and reports are right where you left them.'}
      </p>
    </div>
  );
}
