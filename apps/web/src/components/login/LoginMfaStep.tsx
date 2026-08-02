'use client';

import { FormEvent, RefObject } from 'react';
import { Button, Input } from '@techfusion/ui';

interface LoginMfaStepProps {
  code: string;
  onCodeChange: (value: string) => void;
  onCodeBlur: () => void;
  error?: string;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  onUseDifferentAccount: () => void;
  inputRef: RefObject<HTMLInputElement>;
}

export function LoginMfaStep({
  code,
  onCodeChange,
  onCodeBlur,
  error,
  loading,
  onSubmit,
  onUseDifferentAccount,
  inputRef,
}: LoginMfaStepProps) {
  return (
    <div className="animate-fade-in motion-reduce:animate-none">
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Input
          id="mfaCode"
          name="mfaCode"
          label="Verification code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onBlur={onCodeBlur}
          error={error}
          required
          disabled={loading}
          autoFocus
          inputSize="lg"
          className="h-11 rounded-sm text-center"
          ref={inputRef}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={loading}
          loadingText="Verifying…"
          disabled={loading}
          className="rounded-sm text-sm font-medium shadow-none"
        >
          Verify
        </Button>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={onUseDifferentAccount}
            disabled={loading}
            className="h-11 rounded-sm px-4 text-sm font-medium text-text-secondary"
          >
            Use a different account
          </Button>
        </div>
      </form>
    </div>
  );
}
