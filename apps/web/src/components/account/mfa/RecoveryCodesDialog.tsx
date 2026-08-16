'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
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
import { generateRecoveryCodes, regenerateRecoveryCodes, isValidTotp, normalizeTotp } from '@/lib/mfa-client';
import { mapMfaError } from '@/lib/mfa-errors';
import { OneTimeCodes } from './OneTimeCodes';

interface RecoveryCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regenerate: boolean;
  onThrottled?: () => void;
}

/**
 * ACC-UX-02C — generate / regenerate recovery codes. Re-authenticates with the
 * current password + a valid TOTP, then displays the plaintext codes exactly
 * once. The codes are cleared on close and never persisted by the client.
 */
export function RecoveryCodesDialog({ open, onOpenChange, regenerate, onThrottled }: RecoveryCodesDialogProps) {
  const [step, setStep] = useState<'challenge' | 'codes'>('challenge');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('challenge');
      setPassword('');
      setToken('');
      setConfirmRegenerate(false);
      setCodes(null);
      setError('');
      setSubmitting(false);
    } else {
      setCodes(null);
      setPassword('');
      setToken('');
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  function validationError(): string {
    if (!password) return 'Enter your current password.';
    if (!isValidTotp(token)) return 'Enter the 6-digit code from your authenticator app.';
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
      const result = regenerate
        ? await regenerateRecoveryCodes({ password, token })
        : await generateRecoveryCodes({ password, token });
      setCodes(result.codes);
      setPassword('');
      setToken('');
      setConfirmRegenerate(false);
      setStep('codes');
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
          <ModalTitle>
            {step === 'codes' ? 'Your recovery codes' : regenerate ? 'Regenerate recovery codes' : 'Generate recovery codes'}
          </ModalTitle>
          <ModalDescription>
            {step === 'codes'
              ? 'These codes are shown only once — copy them now.'
              : regenerate
                ? 'All existing recovery codes will stop working immediately.'
                : 'Recovery codes let you sign in if you ever lose access to your authenticator app.'}
          </ModalDescription>
        </ModalHeader>

        {step === 'challenge' ? (
          <div className="space-y-4">
            {regenerate && (
              <StatusMessage variant="warning" layout="block">
                Regenerating invalidates every previously issued recovery code. The new codes
                will be shown exactly once.
              </StatusMessage>
            )}

            <LoginPasswordField
              id="recovery-password"
              label="Current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              autoComplete="current-password"
            />

            <Input
              id="recovery-totp"
              label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={token}
              onChange={(e) => setToken(normalizeTotp(e.target.value))}
              disabled={submitting}
            />

            {regenerate && (
              <Checkbox
                id="regenerate-confirm"
                label="I understand that all existing recovery codes will stop working."
                checked={confirmRegenerate}
                onCheckedChange={(checked) => setConfirmRegenerate(checked === true)}
                disabled={submitting}
              />
            )}

            {error && (
              <StatusMessage variant="error" layout="block">
                {error}
              </StatusMessage>
            )}
          </div>
        ) : codes ? (
          <OneTimeCodes codes={codes} />
        ) : null}

        <ModalFooter>
          {step === 'codes' ? (
            <Button variant="primary" size="sm" onClick={() => onOpenChange(false)}>
              I&apos;ve saved my recovery codes
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={regenerate && !confirmRegenerate}
                loading={submitting}
              >
                {regenerate ? 'Regenerate codes' : 'Generate codes'}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
