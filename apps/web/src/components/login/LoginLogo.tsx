import { AuthLogo } from '@/components/auth/AuthLogo';

interface LoginLogoProps {
  className?: string;
}

export function LoginLogo({ className }: LoginLogoProps) {
  return <AuthLogo className={className} />;
}
