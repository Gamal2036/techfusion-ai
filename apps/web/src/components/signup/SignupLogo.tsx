import { AuthLogo } from '@/components/auth/AuthLogo';

interface SignupLogoProps {
  className?: string;
}

export function SignupLogo({ className }: SignupLogoProps) {
  return <AuthLogo className={className} />;
}
