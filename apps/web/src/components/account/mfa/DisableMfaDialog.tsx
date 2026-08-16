'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  StatusMessage,
} from '@techfusion/ui';
import { LoginPasswordField } from '@/components/login/LoginPasswordField';
import {
  disableMfa,
  isValidRecoveryCode,
  isValidTotp,
  normalizeRecoveryCode,
  normalizeTotp,
} from '@/lib/mfa-client';
import { mapMfaError } from '@/lib/mfa-errors';

interface DisableMfaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onThrottled?: () => void;
}

/**
 * ACC-UX-02C — MFA disable. The backend contract requires the current password
 * plus a valid TOTP token OR an unused recovery code — a password alone never
 * disables MFA. The dialog therefore always collects one of the two second
 * factors and sends exactly one of them.
 */
export function DisableMfaDialog({ open, onOpenChange, onThrottled }: DisableMfaDialogProps) {
  const [method, setMethod] = useState<'totp' | 'recovery'>('totp');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod('totp');
      setPassword('');
      setToken('');
      setRecoveryCode('');
      setError('');
      setSubmitting(false);
    } else {
      setPassword('');
      setToken('');
      setRecoveryCode('');
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  function validationError(): string {
    if (!password) return 'Enter your current password.';
    if (method === 'totp' && !isValidTotp(token)) {
      return 'Enter the 6-digit code from your authenticator app.';
    }
    if (method === 'recovery' && !isValidRecoveryCode(recoveryCode)) {
      return 'Enter a valid recovery code (e.g. XXXX-XXXX-XXXX-XXXX).';
    }
    return '';
  }

  const submit = async () => {
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await disableMfa(
        method === 'totp'
          ? { password, token }
          : { password, recoveryCode: normalizeRecoveryCode(recoveryCode) },
      );
      onOpenChange(false);
    } catch (e) {
      const mapped = mapMfaError(e);
      if (mapped.kind === 'throttled') onThrottled?.();
      setError(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Disable two-factor authentication?</ModalTitle>
          <ModalDescription>
            Disabling two-factor authentication makes your account less secure. Your current
            password and a second factor are required.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          <LoginPasswordField
            id="disable-password"
            label="Current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
          />

          <fieldset>
            <legend className="mb-1.5 block text-xs font-medium text-text-secondary">
              Second factor
            </legend>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="disable-second-factor"
                  value="totp"
                  checked={method === 'totp'}
                  onChange={() => setMethod('totp')}
                  className="h-4 w-4 accent-primary-600"
                  disabled={submitting}
                />
                Authenticator code
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="disable-second-factor"
                  value="recovery"
                  checked={method === 'recovery'}
                  onChange={() => setMethod('recovery')}
                  className="h-4 w-4 accent-primary-600"
                  disabled={submitting}
                />
                Recovery code
              </label>
            </div>
          </fieldset>

          {method === 'totp' ? (
            <Input
              id="disable-totp"
              label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={token}
              onChange={(e) => setToken(normalizeTotp(e.target.value))}
              disabled={submitting}
            />
          ) : (
            <Input
              id="disable-recovery"
              label="Recovery code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              disabled={submitting}
            />
          )}

          {error && (
            <StatusMessage variant="error" layout="block">
              {error}
            </StatusMessage>
          )}
        </div>

        <ModalFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={submit}
            loading={submitting}
            disabled={submitting}
          >
            Disable two-factor authentication
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
