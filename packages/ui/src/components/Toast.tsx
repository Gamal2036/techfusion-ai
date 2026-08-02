'use client';

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';
import { cn } from '../lib/utils';

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: cn(
            'group toast group-[.toaster]:bg-dialog group-[.toaster]:text-dialog-foreground group-[.toaster]:border-border group-[.toaster]:shadow-dialog group-[.toaster]:backdrop-blur-xl',
          ),
          description: 'group-[.toast]:text-text-muted',
          actionButton:
            'group-[.toast]:bg-primary group-[.toaster]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-surface-muted group-[.toaster]:text-text-secondary',
          success: 'group-[.toast]:border-success/20',
          error: 'group-[.toast]:border-danger/20',
          warning: 'group-[.toast]:border-warning/20',
          info: 'group-[.toast]:border-info/20',
        },
      }}
      {...props}
    />
  );
}

const toast = {
  success: sonnerToast.success,
  error: sonnerToast.error,
  warning: sonnerToast.warning,
  info: sonnerToast.info,
  loading: sonnerToast.loading,
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
  custom: sonnerToast.custom,
};

export { Toaster, toast };
