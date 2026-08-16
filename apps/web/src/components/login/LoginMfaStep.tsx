'use client';

import { FormEvent, RefObject } from 'react';
import { Button, Input } from '@techfusion/ui';

export type MfaLoginMode = 'totp' | 'recovery';

interface LoginMfaStepProps {
  code: string;
  mode: MfaLoginMode;
  onModeChange: (mode: MfaLoginMode) => void;
  onCodeChange: (value: string) => void;
  onCodeBlur: () => void;
  error?: string;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  onUseDifferentAccount: () => void;
  inputRef: RefObject<HTMLInputElement>;
}

/**
 * Second-factor entry for sign-in. Defaults to a 6-digit TOTP field; the user
 * can switch to a recovery code when their authenticator app is unavailable.
 * The backend accepts either `token` or `recoveryCode` on /auth/verify-login.
 */
export function LoginMfaStep({
  code,
  mode,
  onModeChange,
  onCodeChange,
  onCodeBlur,
  error,
  loading,
  onSubmit,
  onUseDifferentAccount,
  inputRef,
}: LoginMfaStepProps) {
  const isRecovery = mode === 'recovery';

  return (
    <div className="animate-fade-in motion-reduce:animate-none">
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {isRecovery ? (
          <Input
            id="mfaCode"
            name="mfaCode"
            label="Recovery code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onBlur={onCodeBlur}
            error={error}
            required
            disabled={loading}
            autoFocus
            inputSize="lg"
            className="h-11 rounded-sm text-center uppercase"
            ref={inputRef}
          />
        ) : (
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
        )}

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

        <div className="flex flex-col gap-1">
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onModeChange(isRecovery ? 'totp' : 'recovery')}
              disabled={loading}
              className="h-11 rounded-sm px-4 text-sm font-medium text-text-secondary"
            >
              {isRecovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
            </Button>
          </div>
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
        </div>
      </form>
    </div>
  );
}
