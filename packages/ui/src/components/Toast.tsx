'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { cn } from '../lib/utils';

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: cn(
            'group toast group-[.toaster]:bg-surface-950 group-[.toaster]:text-white group-[.toaster]:border-white/[0.06] group-[.toaster]:shadow-dialog group-[.toaster]:backdrop-blur-xl',
          ),
          description: 'group-[.toast]:text-white/50',
          actionButton:
            'group-[.toast]:bg-primary-600 group-[.toast]:text-white',
          cancelButton:
            'group-[.toast]:bg-white/10 group-[.toast]:text-white/70',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
