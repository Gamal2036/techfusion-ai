'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  StatusMessage,
} from '@techfusion/ui';
import { PasswordInput } from '@techfusion/ui';
import { changePassword, type SecurityError } from '@/lib/security-client';

interface PasswordChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordChanged?: () => void;
  onThrottled?: () => void;
}

export function PasswordChangeDialog({
  open,
  onOpenChange,
  onPasswordChanged,
  onThrottled,
}: PasswordChangeDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSubmitting(false);
      setSuccess(false);
    }
  }, [open]);

  const validate = useCallback((): string => {
    if (!currentPassword) return 'Enter your current password.';
    if (!newPassword) return 'Enter a new password.';
    if (newPassword.length < 8) return 'New password must be at least 8 characters.';
    if (newPassword.length > 128) return 'New password must be no more than 128 characters.';
    if (newPassword === currentPassword) return 'New password must be different from your current password.';
    if (newPassword !== confirmPassword) return 'Passwords do not match.';
    return '';
  }, [currentPassword, newPassword, confirmPassword]);

  const submit = async () => {
    const validationMsg = validate();
    if (validationMsg) {
      setError(validationMsg);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onPasswordChanged?.();
    } catch (e) {
      const err = e as SecurityError;
      if (err.status === 429) {
        onThrottled?.();
        setError('Too many attempts. Wait a moment before trying again.');
      } else if (err.status === 401) {
        setError('The current password you entered is incorrect.');
      } else if (err.status === 400) {
        setError('The password you entered does not meet the requirements.');
      } else if (err.status === 409) {
        setError('A password change is already in progress. Please wait and try again.');
      } else if (!navigator.onLine) {
        setError('You appear to be offline. Check your connection and try again.');
      } else if (err.status >= 500) {
        setError('Something went wrong on our end. Please try again later.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !submitting) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Change password</ModalTitle>
          <ModalDescription>
            Update your account password. Your current password is required for verification.
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4" onKeyDown={handleKeyDown}>
          <PasswordInput
            id="current-password"
            label="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={submitting || success}
            autoComplete="current-password"
            requiredIndicator
          />

          <PasswordInput
            id="new-password"
            label="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting || success}
            autoComplete="new-password"
            description="8 to 128 characters."
            requiredIndicator
          />

          <PasswordInput
            id="confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting || success}
            autoComplete="new-password"
            requiredIndicator
          />

          {error && (
            <StatusMessage variant="error" layout="block">
              {error}
            </StatusMessage>
          )}

          {success && (
            <StatusMessage variant="success" layout="block">
              Password changed successfully. Your session has been refreshed.
            </StatusMessage>
          )}
        </div>

        <ModalFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {success ? 'Close' : 'Cancel'}
          </Button>
          {!success && (
            <Button
              variant="primary"
              size="sm"
              onClick={submit}
              loading={submitting}
              disabled={submitting}
            >
              Change password
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
