'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
  loading?: boolean;
  clearOnEscape?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      value,
      onClear,
      loading = false,
      clearOnEscape = true,
      inputSize = 'md',
      fullWidth = true,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const innerRef = React.useRef<HTMLInputElement>(null);
    const mergedRef = useMergedRef(ref, innerRef);

    const hasValue = value !== undefined && value !== '';

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (clearOnEscape && e.key === 'Escape' && hasValue) {
          e.preventDefault();
          onClear?.();
          innerRef.current?.focus();
        }
        onKeyDown?.(e);
      },
      [clearOnEscape, hasValue, onClear, onKeyDown],
    );

    return (
      <div className={cn('relative', fullWidth && 'w-full')}>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
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
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </span>
        <input
          ref={mergedRef}
          type="search"
          role="searchbox"
          value={value}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex w-full rounded-lg border border-input-border bg-input-background py-2 pl-10 pr-10 text-sm text-foreground placeholder:text-input-placeholder transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            inputSize === 'sm' && 'h-9 text-xs',
            inputSize === 'md' && 'h-10',
            inputSize === 'lg' && 'h-12 text-base',
            '[&:-webkit-autofill]:!bg-input-background [&:-webkit-autofill]:![box-shadow:0_0_0px_1000px_hsl(var(--input-background))_inset] [&:-webkit-autofill]:!text-foreground [&:-webkit-autofill]:!caret-foreground',
            '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
            className,
          )}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={() => {
              onClear();
              innerRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-text-muted hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            {loading ? (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
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
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  },
);
SearchInput.displayName = 'SearchInput';

function useMergedRef<T>(...refs: (React.Ref<T> | undefined)[]) {
  return React.useCallback(
    (node: T | null) => {
      for (const ref of refs) {
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<T | null>).current = node;
        }
      }
    },
    refs,
  );
}

export { SearchInput };
