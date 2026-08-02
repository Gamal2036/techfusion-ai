'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '../lib/utils';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
};

export type SelectOptionGroup = {
  label: string;
  options: SelectOption[];
};

export interface SelectProps {
  label?: string;
  description?: string;
  error?: string;
  placeholder?: string;
  options: (SelectOption | SelectOptionGroup)[];
  selectSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  required?: boolean;
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  name?: string;
}

const selectTriggerSizes = {
  sm: 'h-9 text-xs px-3',
  md: 'h-10 text-sm px-3',
  lg: 'h-12 text-base px-4',
};

const Select = React.forwardRef<HTMLButtonElement, SelectProps & { className?: string }>(
  (
    {
      className,
      label,
      description,
      error,
      placeholder = 'Select an option...',
      options,
      selectSize = 'md',
      fullWidth = true,
      required,
      value,
      defaultValue,
      disabled,
      onValueChange,
      name,
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = generatedId;
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;

    const describedBy = [
      description ? descriptionId : undefined,
      error ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    const renderOption = (option: SelectOption) => (
      <SelectPrimitive.Item
        key={option.value}
        value={option.value}
        disabled={option.disabled}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-2 text-sm text-foreground outline-none',
          'focus:bg-surface-subtle focus:text-foreground',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        )}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );

    const renderItems = (items: (SelectOption | SelectOptionGroup)[]) =>
      items.map((item) => {
        if ('options' in item) {
          return (
            <SelectPrimitive.Group key={item.label}>
              <SelectPrimitive.Label className="px-2 py-1.5 text-xs font-medium text-text-muted">
                {item.label}
              </SelectPrimitive.Label>
              {item.options.map(renderOption)}
            </SelectPrimitive.Group>
          );
        }
        return renderOption(item);
      });

    return (
      <div className={cn(fullWidth && 'w-full')}>
        {label && (
          <label
            className={cn(
              'mb-1.5 block text-xs font-medium text-text-secondary',
              disabled && 'opacity-50',
            )}
          >
            {label}
            {required && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <SelectPrimitive.Root
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          onValueChange={onValueChange}
          name={name}
        >
          <SelectPrimitive.Trigger
            ref={ref}
            id={id}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border bg-input-background text-foreground transition-colors',
              'placeholder:text-input-placeholder',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-danger focus-visible:ring-danger'
                : 'border-input-border',
              selectTriggerSizes[selectSize],
              className,
            )}
            aria-describedby={describedBy || undefined}
            aria-invalid={error ? true : undefined}
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <svg
                className="h-4 w-4 shrink-0 text-text-muted opacity-50"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-elevated',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
                'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
              )}
              position="popper"
              sideOffset={4}
            >
              <SelectPrimitive.Viewport
                className={cn(
                  'p-1',
                  'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
                )}
              >
                {renderItems(options)}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
        {description && !error && (
          <p id={descriptionId} className="mt-1 text-xs text-text-muted">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
