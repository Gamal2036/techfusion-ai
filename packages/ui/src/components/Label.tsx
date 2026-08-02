'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../lib/utils';

export interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  disabled?: boolean;
  required?: boolean;
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  LabelProps
>(({ className, disabled, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-xs font-medium text-text-secondary leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      disabled && 'opacity-50 cursor-not-allowed',
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <span className="ml-0.5 text-danger" aria-hidden="true">
        *
      </span>
    )}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
