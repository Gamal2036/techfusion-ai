'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn, Input, type InputProps } from '@techfusion/ui';
import { PasswordStrength } from './PasswordStrength';
import { usePasswordStrength } from './usePasswordStrength';

export interface SignupPasswordFieldProps
  extends Omit<InputProps, 'type' | 'rightElement'> {
  showStrength?: boolean;
}

export const SignupPasswordField = React.forwardRef<
  HTMLInputElement,
  SignupPasswordFieldProps
>(
  (
    {
      id,
      label,
      value = '',
      showStrength = true,
      disabled,
      className,
      required,
      requiredIndicator,
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(
      null,
    ) as React.MutableRefObject<HTMLInputElement | null>;
    const strength = usePasswordStrength(String(value));

    const mergedRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) {
          (ref as React.MutableRefObject<HTMLInputElement | null>).current =
            node;
        }
      },
      [ref],
    );

    const handleToggle = () => {
      setVisible((prev) => {
        const next = !prev;
        requestAnimationFrame(() => {
          const el = inputRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        });
        return next;
      });
    };

    const toggle = (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        disabled={disabled}
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-sm text-text-muted transition-colors duration-150',
          'hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    );

    return (
      <div className="w-full">
        <Input
          ref={mergedRef}
          id={id}
          label={label}
          type={visible ? 'text' : 'password'}
          autoComplete={props.autoComplete || 'new-password'}
          value={value}
          disabled={disabled}
          required={required}
          requiredIndicator={requiredIndicator}
          rightElement={toggle}
          className={cn('h-11 rounded-sm pr-14', className)}
          {...props}
        />
        {showStrength && (
          <PasswordStrength
            result={strength}
            visible={Boolean(value) && !disabled}
          />
        )}
      </div>
    );
  },
);
SignupPasswordField.displayName = 'SignupPasswordField';
