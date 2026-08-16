import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SecuritySection } from '@/components/account/SecuritySection';
import {
  fetchMfaStatus,
  fetchRecoveryCodesStatus,
  enrollMfa,
  verifyMfaEnrollment,
  generateRecoveryCodes,
  regenerateRecoveryCodes,
  disableMfa,
  type MfaStatus,
  type RecoveryCodesStatus,
} from '@/lib/mfa-client';
import { MfaRequestError } from '@/lib/mfa-errors';

jest.mock('@/lib/mfa-client', () => ({
  ...jest.requireActual('@/lib/mfa-client'),
  fetchMfaStatus: jest.fn(),
  fetchRecoveryCodesStatus: jest.fn(),
  enrollMfa: jest.fn(),
  verifyMfaEnrollment: jest.fn(),
  generateRecoveryCodes: jest.fn(),
  regenerateRecoveryCodes: jest.fn(),
  disableMfa: jest.fn(),
}));

jest.mock('@techfusion/ui', () => {
  const ReactUi = require('react');
  return {
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
    GlassPanel: ({ children }: any) => <div>{children}</div>,
    Badge: ({ children }: any) => <span>{children}</span>,
    Button: ({ children, variant, size, fullWidth, loading, loadingText, leftIcon, rightIcon, asChild, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    Input: ReactUi.forwardRef(
      ({ label, description, error, success, fullWidth, requiredIndicator, inputSize, leftIcon, rightElement, ...props }: any, ref: any) => (
        <div>
          {label && <label>{label}</label>}
          <input ref={ref} aria-label={label} {...props} />
          {error && (
            <span role="alert" className="text-danger">
              {error}
            </span>
          )}
        </div>
      ),
    ),
    StatusMessage: ({ children, variant, ...props }: any) => (
      <div data-testid="status-message" data-variant={variant} {...props}>
        {children}
      </div>
    ),
    Modal: ({ open, children }: any) =>
      open ? (
        <div role="dialog" data-testid="modal">
          {children}
        </div>
      ) : null,
    ModalContent: ({ children }: any) => <div>{children}</div>,
    ModalHeader: ({ children }: any) => <div>{children}</div>,
    ModalTitle: ({ children }: any) => <h3>{children}</h3>,
    ModalDescription: ({ children }: any) => <p>{children}</p>,
    ModalFooter: ({ children }: any) => <div>{children}</div>,
    Checkbox: ({ label, checked, onCheckedChange, id }: any) => (
      <div>
        <input
          id={id}
          type="checkbox"
          aria-label={label}
          checked={Boolean(checked)}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
        <label htmlFor={id}>{label}</label>
      </div>
    ),
  };
});

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Loader2: MockIcon,
    ShieldCheck: MockIcon,
    ShieldOff: MockIcon,
    Check: MockIcon,
    Copy: MockIcon,
    Eye: MockIcon,
    EyeOff: MockIcon,
  };
});

const mockFetchMfaStatus = fetchMfaStatus as jest.MockedFunction<typeof fetchMfaStatus>;
const mockFetchRecoveryCodesStatus = fetchRecoveryCodesStatus as jest.MockedFunction<typeof fetchRecoveryCodesStatus>;
const mockEnrollMfa = enrollMfa as jest.MockedFunction<typeof enrollMfa>;
const mockVerifyMfaEnrollment = verifyMfaEnrollment as jest.MockedFunction<typeof verifyMfaEnrollment>;
const mockGenerateRecoveryCodes = generateRecoveryCodes as jest.MockedFunction<typeof generateRecoveryCodes>;
const mockRegenerateRecoveryCodes = regenerateRecoveryCodes as jest.MockedFunction<typeof regenerateRecoveryCodes>;
const mockDisableMfa = disableMfa as jest.MockedFunction<typeof disableMfa>;

const MFA_ENABLED: MfaStatus = { isMfaEnabled: true };
const MFA_DISABLED: MfaStatus = { isMfaEnabled: false };

const RECOVERY_NONE: RecoveryCodesStatus = { generated: false, availableCount: 0 };
const RECOVERY_PARTIAL: RecoveryCodesStatus = { generated: true, availableCount: 3 };
const RECOVERY_ONE_LEFT: RecoveryCodesStatus = { generated: true, availableCount: 1 };
const RECOVERY_DEPLETED: RecoveryCodesStatus = { generated: true, availableCount: 0 };

const ENROLLMENT = { secret: 'JBSWY3DPEHPK3PXP', qrCode: 'data:image/png;base64,AAA' };

const CODES = [
  'ABCD-EFGH-IJKL-MNOP',
  'QRST-UVWX-YZ23-4567',
  'ABCD-EFGH-IJKL-MNOP',
  'QRST-UVWX-YZ23-4567',
  'ABCD-EFGH-IJKL-MNOP',
  'QRST-UVWX-YZ23-4567',
  'ABCD-EFGH-IJKL-MNOP',
  'QRST-UVWX-YZ23-4567',
  'ABCD-EFGH-IJKL-MNOP',
  'QRST-UVWX-YZ23-4567',
];

const throttledError = () => new MfaRequestError('Too many attempts. Wait a moment and try again.', 429);

const dialog = () => screen.getByRole('dialog');

describe('Security Section MFA workflows (ACC-UX-02C)', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
    mockFetchMfaStatus.mockResolvedValue(MFA_ENABLED);
    mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_NONE);
    mockEnrollMfa.mockResolvedValue(ENROLLMENT);
    mockVerifyMfaEnrollment.mockResolvedValue({ message: 'Two-factor authentication enabled' });
    mockGenerateRecoveryCodes.mockResolvedValue({ codes: CODES });
    mockRegenerateRecoveryCodes.mockResolvedValue({ codes: CODES });
    mockDisableMfa.mockResolvedValue({ message: 'Two-factor authentication disabled' });
  });

  describe('loading and status states', () => {
    it('shows a loading status while security data is pending', async () => {
      let resolveMfa: (value: MfaStatus) => void = () => {};
      mockFetchMfaStatus.mockReturnValue(
        new Promise<MfaStatus>((resolve) => {
          resolveMfa = resolve;
        }),
      );

      render(<SecuritySection />);

      expect(await screen.findByText('Loading security status...')).toBeInTheDocument();

      resolveMfa(MFA_ENABLED);
      expect(await screen.findByText('Enabled')).toBeInTheDocument();
    });

    it('fetches both authoritative status endpoints on mount', async () => {
      render(<SecuritySection />);

      await waitFor(() => expect(mockFetchMfaStatus).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockFetchRecoveryCodesStatus).toHaveBeenCalledTimes(1));
    });

    it('surfaces a status failure with a retry instead of fabricating a state', async () => {
      mockFetchMfaStatus.mockRejectedValue(new Error('boom'));
      render(<SecuritySection />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Security request failed. Try again.');
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
      expect(screen.queryByText('Not enabled')).not.toBeInTheDocument();
    });

    it('retry reloads the status from the server', async () => {
      mockFetchMfaStatus.mockRejectedValueOnce(new Error('boom'));
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /retry/i }));

      await waitFor(() => expect(mockFetchMfaStatus).toHaveBeenCalledTimes(2));
      expect(await screen.findByText('Enabled')).toBeInTheDocument();
    });

    it('shows MFA as not enabled and offers enrollment when status reports off', async () => {
      mockFetchMfaStatus.mockResolvedValue(MFA_DISABLED);
      render(<SecuritySection />);

      expect(await screen.findByText('Not enabled')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /set up two-factor authentication/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^disable$/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Recovery codes')).not.toBeInTheDocument();
    });

    it('reports a known recovery-status failure without inventing numbers', async () => {
      mockFetchRecoveryCodesStatus.mockRejectedValue(new Error('boom'));
      render(<SecuritySection />);

      expect(await screen.findByText('Recovery code status is unavailable.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate codes/i })).toBeInTheDocument();
    });
  });

  describe('recovery-code status display', () => {
    it('shows the remaining count when codes exist', async () => {
      mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_PARTIAL);
      render(<SecuritySection />);

      expect(await screen.findByText('You have 3 recovery codes remaining. Each code can be used once.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /regenerate codes/i })).toBeInTheDocument();
    });

    it('uses singular copy when exactly one code remains', async () => {
      mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_ONE_LEFT);
      render(<SecuritySection />);

      expect(await screen.findByText('You have 1 recovery code remaining. Each code can be used once.')).toBeInTheDocument();
    });

    it('offers regeneration when all codes have been used', async () => {
      mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_DEPLETED);
      render(<SecuritySection />);

      expect(await screen.findByText('All recovery codes have been used. Regenerate to receive a fresh set.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /regenerate codes/i })).toBeInTheDocument();
    });

    it('prompts generation when codes have never been issued', async () => {
      mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_NONE);
      render(<SecuritySection />);

      expect(await screen.findByText(/Generate codes so you can get back in/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate codes/i })).toBeInTheDocument();
    });
  });

  describe('MFA enrollment flow', () => {
    beforeEach(() => {
      mockFetchMfaStatus.mockResolvedValue(MFA_DISABLED);
    });

    it('starts enrollment from the security panel and calls POST /mfa/enroll', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      expect(within(dialog()).getByRole('heading', { name: /set up two-factor authentication/i })).toBeInTheDocument();

      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));

      await waitFor(() => expect(mockEnrollMfa).toHaveBeenCalledTimes(1));
      expect(await within(dialog()).findByText('Scan the QR code')).toBeInTheDocument();
    });

    it('renders the backend QR code and a masked setup key', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));

      const qr = await within(dialog()).findByAltText('QR code to scan with your authenticator app');
      expect(qr).toHaveAttribute('src', ENROLLMENT.qrCode);
      expect(within(dialog()).getByTestId('setup-key')).toHaveTextContent('JBSW •••• •••• ••••');
    });

    it('reveals and hides the plaintext setup key only on demand', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));

      fireEvent.click(await within(dialog()).findByRole('button', { name: /^show$/i }));
      expect(within(dialog()).getByTestId('setup-key')).toHaveTextContent(ENROLLMENT.secret);
      expect(within(dialog()).getByRole('button', { name: /^hide$/i })).toBeInTheDocument();

      fireEvent.click(within(dialog()).getByRole('button', { name: /^hide$/i }));
      expect(within(dialog()).getByTestId('setup-key')).toHaveTextContent('JBSW •••• •••• ••••');
    });

    it('copies the plaintext secret only when the user asks', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));

      fireEvent.click(await within(dialog()).findByRole('button', { name: /^copy$/i }));

      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ENROLLMENT.secret));
      expect(await within(dialog()).findByText('Copied')).toBeInTheDocument();
    });

    it('rejects an invalid verification code without calling the API', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));

      fireEvent.change(await within(dialog()).findByPlaceholderText('123456'), { target: { value: '12345' } });
      fireEvent.click(within(dialog()).getByRole('button', { name: /verify and enable/i }));

      expect(await screen.findByText('Enter the 6-digit code from your authenticator app.')).toBeInTheDocument();
      expect(mockVerifyMfaEnrollment).not.toHaveBeenCalled();
    });

    it('verifies possession with the TOTP code before enabling', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));

      fireEvent.change(await within(dialog()).findByPlaceholderText('123456'), { target: { value: '123456' } });
      fireEvent.click(within(dialog()).getByRole('button', { name: /verify and enable/i }));

      await waitFor(() => expect(mockVerifyMfaEnrollment).toHaveBeenCalledWith('123456'));
      expect(await within(dialog()).findByText('Two-factor authentication enabled')).toBeInTheDocument();
    });

    it('chains the success step into recovery-code generation', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));
      fireEvent.change(await within(dialog()).findByPlaceholderText('123456'), { target: { value: '123456' } });
      fireEvent.click(within(dialog()).getByRole('button', { name: /verify and enable/i }));

      fireEvent.click(await within(dialog()).findByRole('button', { name: /generate recovery codes now/i }));

      expect(await within(dialog()).findByRole('heading', { name: /generate recovery codes/i })).toBeInTheDocument();
    });

    it('shows a throttle warning and calm copy when enrollment is throttled', async () => {
      mockEnrollMfa.mockRejectedValue(throttledError());
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));

      expect(await screen.findByText('Too many attempts. Wait a moment and try again.')).toBeInTheDocument();
      expect(await screen.findByText('Too many security attempts. Wait a moment before trying again.')).toBeInTheDocument();
    });

    it('dismisses the throttle warning', async () => {
      mockEnrollMfa.mockRejectedValue(throttledError());
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /set up two-factor authentication/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /continue/i }));

      fireEvent.click(await screen.findByRole('button', { name: /dismiss/i }));
      expect(screen.queryByText('Too many security attempts. Wait a moment before trying again.')).not.toBeInTheDocument();
    });
  });

  describe('recovery-code generation', () => {
    it('requires the current password and a valid TOTP before generating', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^generate codes$/i }));
      const dlg = dialog();

      fireEvent.click(within(dlg).getByRole('button', { name: /^generate codes$/i }));
      expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
      expect(mockGenerateRecoveryCodes).not.toHaveBeenCalled();

      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^generate codes$/i }));
      expect(await screen.findByText('Enter the 6-digit code from your authenticator app.')).toBeInTheDocument();
      expect(mockGenerateRecoveryCodes).not.toHaveBeenCalled();
    });

    it('generates codes only after a valid password + TOTP challenge', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^generate codes$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '123456' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^generate codes$/i }));

      await waitFor(() => expect(mockGenerateRecoveryCodes).toHaveBeenCalledWith({ password: 'secret-pass', token: '123456' }));
      expect(await within(dialog()).findByText('Your recovery codes')).toBeInTheDocument();
    });

    it('displays the issued codes once with a count', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^generate codes$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '123456' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^generate codes$/i }));

      await within(dialog()).findByText('Your recovery codes');
      expect(screen.getAllByText(CODES[0]).length).toBeGreaterThan(0);
      expect(screen.getByText('10 codes issued. Keep them private — anyone who has one can sign in as you.')).toBeInTheDocument();
    });

    it('copies a single code and all codes only on request', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^generate codes$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '123456' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^generate codes$/i }));
      await within(dialog()).findByText('Your recovery codes');

      fireEvent.click(screen.getByRole('button', { name: 'Copy recovery code 1' }));
      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CODES[0]));

      fireEvent.click(screen.getByRole('button', { name: /copy all codes/i }));
      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CODES.join('\n')));
    });

    it('refreshes the authoritative status after closing the codes dialog', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^generate codes$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '123456' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^generate codes$/i }));
      fireEvent.click(await within(dialog()).findByRole('button', { name: /i've saved my recovery codes/i }));

      await waitFor(() => expect(mockFetchMfaStatus).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(mockFetchRecoveryCodesStatus).toHaveBeenCalledTimes(2));
      expect(screen.queryByText('Your recovery codes')).not.toBeInTheDocument();
    });
  });

  describe('recovery-code regeneration', () => {
    beforeEach(() => {
      mockFetchRecoveryCodesStatus.mockResolvedValue(RECOVERY_DEPLETED);
    });

    it('warns that existing codes are invalidated before regeneration', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^regenerate codes$/i }));

      expect(await within(dialog()).findByRole('heading', { name: /regenerate recovery codes/i })).toBeInTheDocument();
      expect(within(dialog()).getByText(/Regenerating invalidates every previously issued recovery code/i)).toBeInTheDocument();
    });

    it('requires explicit confirmation before regeneration is allowed', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^regenerate codes$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '123456' } });

      const confirm = within(dlg).getByRole('checkbox', {
        name: /I understand that all existing recovery codes will stop working/i,
      });
      const submit = within(dlg).getByRole('button', { name: /^regenerate codes$/i });
      expect(submit).toBeDisabled();

      fireEvent.click(confirm);
      expect(submit).not.toBeDisabled();
    });

    it('calls regenerate after confirmation and a valid challenge', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^regenerate codes$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '123456' } });
      fireEvent.click(
        within(dlg).getByRole('checkbox', { name: /I understand that all existing recovery codes will stop working/i }),
      );
      fireEvent.click(within(dlg).getByRole('button', { name: /^regenerate codes$/i }));

      await waitFor(() => expect(mockRegenerateRecoveryCodes).toHaveBeenCalledWith({ password: 'secret-pass', token: '123456' }));
      expect(await within(dialog()).findByText('Your recovery codes')).toBeInTheDocument();
    });
  });

  describe('MFA disable', () => {
    it('opens the disable dialog with the two-factor requirement', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^disable$/i }));

      expect(await within(dialog()).findByRole('heading', { name: /disable two-factor authentication/i })).toBeInTheDocument();
      expect(within(dialog()).getByText(/Your current password and a second factor are required/i)).toBeInTheDocument();
    });

    it('never disables with a password alone', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^disable$/i }));
      fireEvent.click(within(dialog()).getByRole('button', { name: /^disable two-factor authentication$/i }));

      expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
      expect(mockDisableMfa).not.toHaveBeenCalled();
    });

    it('sends password + TOTP when the authenticator method is selected', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^disable$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '654321' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^disable two-factor authentication$/i }));

      await waitFor(() => expect(mockDisableMfa).toHaveBeenCalledWith({ password: 'secret-pass', token: '654321' }));
    });

    it('rejects a malformed recovery code without calling the API', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^disable$/i }));
      const dlg = dialog();
      fireEvent.click(within(dlg).getByRole('radio', { name: /recovery code/i }));
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByRole('textbox', { name: /recovery code/i }), { target: { value: '1111-1111-1111-1111' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^disable two-factor authentication$/i }));

      expect(await screen.findByText('Enter a valid recovery code (e.g. XXXX-XXXX-XXXX-XXXX).')).toBeInTheDocument();
      expect(mockDisableMfa).not.toHaveBeenCalled();
    });

    it('sends password + normalized recovery code when that method is selected', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^disable$/i }));
      const dlg = dialog();
      fireEvent.click(within(dlg).getByRole('radio', { name: /recovery code/i }));
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByRole('textbox', { name: /recovery code/i }), {
        target: { value: 'ABCD-EFGH-IJKL-MNOP' },
      });
      fireEvent.click(within(dlg).getByRole('button', { name: /^disable two-factor authentication$/i }));

      await waitFor(() =>
        expect(mockDisableMfa).toHaveBeenCalledWith({ password: 'secret-pass', recoveryCode: 'ABCDEFGHIJKLMNOP' }),
      );
    });

    it('refreshes status after a successful disable and closes the dialog', async () => {
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^disable$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '654321' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^disable two-factor authentication$/i }));

      await waitFor(() => expect(mockFetchMfaStatus).toHaveBeenCalledTimes(2));
      expect(screen.queryByText('Disable two-factor authentication?')).not.toBeInTheDocument();
    });

    it('shows a throttle warning when disabling is throttled', async () => {
      mockDisableMfa.mockRejectedValue(throttledError());
      render(<SecuritySection />);

      fireEvent.click(await screen.findByRole('button', { name: /^disable$/i }));
      const dlg = dialog();
      fireEvent.change(within(dlg).getByLabelText('Current password'), { target: { value: 'secret-pass' } });
      fireEvent.change(within(dlg).getByPlaceholderText('123456'), { target: { value: '654321' } });
      fireEvent.click(within(dlg).getByRole('button', { name: /^disable two-factor authentication$/i }));

      expect(await screen.findByText('Too many attempts. Wait a moment and try again.')).toBeInTheDocument();
      expect(await screen.findByText('Too many security attempts. Wait a moment before trying again.')).toBeInTheDocument();
      expect(mockDisableMfa).toHaveBeenCalledTimes(1);
    });
  });
});
