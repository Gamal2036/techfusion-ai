'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './Avatar';
import type { PresenceStatus } from './PresenceIndicator';

const avatarGroupSizes = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
} as const;

const avatarGroupSpacing = {
  xs: '-ml-1.5',
  sm: '-ml-2',
  md: '-ml-3',
  lg: '-ml-3',
  xl: '-ml-4',
} as const;

const avatarGroupFallbackSizes = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-base',
} as const;

export interface AvatarGroupItem {
  src?: string;
  alt?: string;
  name?: string;
  presence?: PresenceStatus;
}

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  items: AvatarGroupItem[];
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

function getInitials(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, items, max = 5, size = 'md', ...props }, ref) => {
    const visibleItems = items.slice(0, max);
    const overflowCount = items.length - max;

    return (
      <div
        ref={ref}
        role="group"
        aria-label={`Group of ${items.length} avatars`}
        className={cn('flex items-center', className)}
        {...props}
      >
        {visibleItems.map((item, index) => (
          <div
            key={index}
            className={cn(
              'relative rounded-full ring-2 ring-background',
              avatarGroupSpacing[size],
              index === 0 && 'ml-0',
            )}
          >
            <Avatar size={size}>
              {item.src && <AvatarImage src={item.src} alt={item.alt || item.name || ''} />}
              <AvatarFallback
                size={size}
                className={cn(avatarGroupFallbackSizes[size])}
              >
                {item.name ? getInitials(item.name) : '?'}
              </AvatarFallback>
            </Avatar>
          </div>
        ))}
        {overflowCount > 0 && (
          <div
            className={cn(
              'relative flex items-center justify-center rounded-full bg-surface-muted border-2 border-background text-text-muted font-medium',
              avatarGroupSizes[size],
              avatarGroupSpacing[size],
            )}
          >
            <span className={cn(avatarGroupFallbackSizes[size])}>
              +{overflowCount}
            </span>
          </div>
        )}
      </div>
    );
  },
);
AvatarGroup.displayName = 'AvatarGroup';

export { AvatarGroup };
