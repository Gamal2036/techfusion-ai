import * as React from 'react';
import { cn } from '../lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xl border border-white/10 bg-white/[0.03] text-white shadow-card',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const GlassPanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { intensity?: 'light' | 'medium' | 'heavy' }
>(({ className, intensity = 'medium', ...props }, ref) => {
  const bgMap = {
    light: 'bg-white/[0.02]',
    medium: 'bg-white/[0.05]',
    heavy: 'bg-white/[0.08]',
  };
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-white/[0.06] backdrop-blur-xl shadow-glass',
        bgMap[intensity],
        className,
      )}
      {...props}
    />
  );
});
GlassPanel.displayName = 'GlassPanel';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-white', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-white/50', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  GlassPanel,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
