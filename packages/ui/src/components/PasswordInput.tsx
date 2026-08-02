'use client';

import * as React from 'react';
import { cn } from '../lib/utils';
import { Input, type InputProps } from './Input';

export interface PasswordInputProps
  extends Omit<InputProps, 'type' | 'leftIcon' | 'rightElement'> {
  showToggle?: boolean;
  toggleLabel?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      showToggle = true,
      toggleLabel = 'Toggle password visibility',
      inputSize = 'md',
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleToggle = React.useCallback(() => {
      setVisible((prev) => {
        const next = !prev;
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          const len = inputRef.current?.value.length || 0;
          inputRef.current?.setSelectionRange(len, len);
        });
        return next;
      });
    }, []);

    const mergedRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    const toggleButton = showToggle ? (
      <button
        type="button"
        onClick={handleToggle}
        tabIndex={-1}
        className="pointer-events-auto rounded-md p-0.5 text-text-muted hover:text-foreground transition-colors"
        aria-label={toggleLabel}
      >
        {visible ? (
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
              d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
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
              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        )}
      </button>
    ) : undefined;

    return (
      <Input
        ref={mergedRef}
        type={visible ? 'text' : 'password'}
        inputSize={inputSize}
        autoComplete={props.autoComplete || 'current-password'}
        rightElement={toggleButton}
        className={className}
        {...props}
      />
    );
  },
);
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
