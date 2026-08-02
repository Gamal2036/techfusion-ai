'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const drawerVariants = cva(
  'fixed z-50 flex flex-col bg-dialog shadow-dialog',
  {
    variants: {
      side: {
        right: 'inset-y-0 right-0 h-full border-l border-border',
        left: 'inset-y-0 left-0 h-full border-r border-border',
        top: 'inset-x-0 top-0 w-full border-b border-border',
        bottom: 'inset-x-0 bottom-0 w-full border-t border-border',
      },
      size: {
        sm: '',
        md: '',
        lg: '',
        xl: '',
        full: '',
      },
    },
    compoundVariants: [
      { side: 'right', size: 'sm', class: 'w-72' },
      { side: 'right', size: 'md', class: 'w-96' },
      { side: 'right', size: 'lg', class: 'w-[32rem]' },
      { side: 'right', size: 'xl', class: 'w-[40rem]' },
      { side: 'right', size: 'full', class: 'w-full' },
      { side: 'left', size: 'sm', class: 'w-72' },
      { side: 'left', size: 'md', class: 'w-96' },
      { side: 'left', size: 'lg', class: 'w-[32rem]' },
      { side: 'left', size: 'xl', class: 'w-[40rem]' },
      { side: 'left', size: 'full', class: 'w-full' },
      { side: 'top', size: 'sm', class: 'h-1/4' },
      { side: 'top', size: 'md', class: 'h-1/3' },
      { side: 'top', size: 'lg', class: 'h-1/2' },
      { side: 'top', size: 'xl', class: 'h-2/3' },
      { side: 'top', size: 'full', class: 'h-full' },
      { side: 'bottom', size: 'sm', class: 'h-1/4' },
      { side: 'bottom', size: 'md', class: 'h-1/3' },
      { side: 'bottom', size: 'lg', class: 'h-1/2' },
      { side: 'bottom', size: 'xl', class: 'h-2/3' },
      { side: 'bottom', size: 'full', class: 'h-full' },
    ],
    defaultVariants: {
      side: 'right',
      size: 'md',
    },
  },
);

export interface DrawerProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {}

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;
const DrawerPortal = DialogPrimitive.Portal;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerVariants> {}

const getSlideAnimation = (side: 'right' | 'left' | 'top' | 'bottom' | null) => {
  switch (side) {
    case 'right':
      return {
        'data-[state=closed]:slide-out-to-right': true,
        'data-[state=open]:slide-in-from-right': true,
      };
    case 'left':
      return {
        'data-[state=closed]:slide-out-to-left': true,
        'data-[state=open]:slide-in-from-left': true,
      };
    case 'top':
      return {
        'data-[state=closed]:slide-out-to-top': true,
        'data-[state=open]:slide-in-from-top': true,
      };
    case 'bottom':
      return {
        'data-[state=closed]:slide-out-to-bottom': true,
        'data-[state=open]:slide-in-from-bottom': true,
      };
    default:
      return {};
  }
};

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, side = 'right', size, ...props }, ref) => {
  const slideAnimation = getSlideAnimation(side);

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          drawerVariants({ side, size }),
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:duration-300 data-[state=open]:duration-300',
          slideAnimation,
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = DialogPrimitive.Content.displayName;

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 p-6 text-center sm:text-left',
      className,
    )}
    {...props}
  />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6',
      className,
    )}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-text-primary',
      className,
    )}
    {...props}
  />
));
DrawerTitle.displayName = DialogPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-text-muted', className)}
    {...props}
  />
));
DrawerDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerClose,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  drawerVariants,
};
