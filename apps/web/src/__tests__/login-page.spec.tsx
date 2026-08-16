import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginExperience } from '@/components/login/LoginExperience';

const mockPush = jest.fn();
const mockSetTokens = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('@techfusion/ui', () => {
  const ReactUi = require('react');
  const Input = ReactUi.forwardRef(
    (
      {
        id,
        label,
        error,
        required,
        requiredIndicator,
        rightElement,
        type = 'text',
        className,
        ...props
      }: any,
      ref: any,
    ) => {
      const inputId = id || 'input-id';
      const errorId = `${inputId}-error`;
      return (
        <div className={className}>
          {label && (
            <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium">
              {label}
              {(required || requiredIndicator) && (
                <span aria-hidden="true">*</span>
              )}
            </label>
          )}
          <input
            id={inputId}
            ref={ref}
            type={type}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            {...props}
          />
          {rightElement}
          {error && (
            <p id={errorId} role="alert">
              {error}
            </p>
          )}
        </div>
      );
    },
  );
  Input.displayName = 'Input';

  return {
    cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
    Input,
    Button: ReactUi.forwardRef(
      (
        {
          children,
          loading,
          loadingText,
          disabled,
          variant,
          size,
          fullWidth,
          ...props
        }: any,
        ref: any,
      ) => (
        <button
          ref={ref}
          disabled={disabled || loading}
          aria-busy={loading || undefined}
          {...props}
        >
          {loading ? loadingText || children : children}
        </button>
      ),
    ),
    Alert: ({ children, ...props }: any) => (
      <div role="alert" {...props}>
        {children}
      </div>
    ),
    Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  };
});

jest.mock('@/lib/auth-client', () => ({
  setTokens: (...args: any[]) => mockSetTokens(...args),
  getApiUrl: () => 'http://localhost:3001',
}));

const fetchMock = jest.fn();
global.fetch = fetchMock as any;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
});

async function fillValidCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email*'), 'jane@acme.com');
  await user.type(screen.getByLabelText('Password*'), 'secret');
  return user;
}

describe('LoginExperience — credential flow', () => {
  it('renders the calm returning-user brand panel', () => {
    render(<LoginExperience />);

    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sign in to continue to techfusion-ai/i),
    ).toBeInTheDocument();

    const brand = screen.getByRole('region', { name: /techfusion/i });
    expect(
      within(brand).getByText(
        /complete, trustworthy command over your technology/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(brand).getByText(/welcome back to your workspace/i),
    ).toBeInTheDocument();
  });

  it('renders all login fields and the signup cross-link', () => {
    render(<LoginExperience />);

    expect(screen.getByLabelText('Email*')).toBeInTheDocument();
    expect(screen.getByLabelText('Password*')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('programmatically associates labels with inputs', () => {
    render(<LoginExperience />);

    const emailInput = screen.getByLabelText('Email*') as HTMLInputElement;
    expect(emailInput).toHaveAttribute('id', 'email');
    expect(emailInput).toHaveAttribute('name', 'email');
    expect(emailInput.labels).toHaveLength(1);
    expect(emailInput.labels?.[0]).toHaveAttribute('for', 'email');

    const passwordInput = screen.getByLabelText('Password*') as HTMLInputElement;
    expect(passwordInput).toHaveAttribute('id', 'password');
    expect(passwordInput).toHaveAttribute('name', 'password');
    expect(passwordInput.labels?.[0]).toHaveAttribute('for', 'password');
  });

  it('sets correct autocomplete and input attributes for email', () => {
    render(<LoginExperience />);

    const email = screen.getByLabelText('Email*');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autoComplete', 'email');
    expect(email).toHaveAttribute('inputMode', 'email');
    expect(email).toHaveAttribute('name', 'email');
  });

  it('sets current-password autocomplete for the password field', () => {
    render(<LoginExperience />);

    const password = screen.getByLabelText('Password*');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autoComplete', 'current-password');
    expect(password).toHaveAttribute('name', 'password');
  });

  it('toggles password visibility with an accessible show/hide button', async () => {
    render(<LoginExperience />);
    const user = userEvent.setup();
    const password = screen.getByLabelText('Password*');

    expect(password).toHaveAttribute('type', 'password');
    await user.type(password, 'secret');

    const showButton = screen.getByRole('button', { name: /show password/i });
    expect(showButton).toHaveAttribute('aria-pressed', 'false');
    await user.click(showButton);

    expect(password).toHaveAttribute('type', 'text');
    const hideButton = screen.getByRole('button', { name: /hide password/i });
    expect(hideButton).toHaveAttribute('aria-pressed', 'true');

    await user.click(hideButton);
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveValue('secret');
  });

  it('preserves focus in the password field after toggling', async () => {
    render(<LoginExperience />);
    const user = userEvent.setup();
    const password = screen.getByLabelText('Password*');

    await user.type(password, 'secret');
    await user.click(screen.getByRole('button', { name: /show password/i }));

    await waitFor(() => expect(password).toHaveFocus());
  });

  it('blocks an empty form with inline errors', async () => {
    render(<LoginExperience />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Password*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wires field errors with aria-describedby', async () => {
    render(<LoginExperience />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const email = screen.getByLabelText('Email*');
    expect(email).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByText('Enter your email address.')).toHaveAttribute(
      'id',
      'email-error',
    );
  });

  it('blocks an invalid email format', async () => {
    render(<LoginExperience />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email*'), 'not-an-email');
    await user.type(screen.getByLabelText('Password*'), 'secret');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      screen.getByText('Enter a valid email address.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits the exact login payload to /auth/login', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
        { status: 200 },
      ),
    );
    render(<LoginExperience />);
    const user = await fillValidCredentials();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3001/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      email: 'jane@acme.com',
      password: 'secret',
    });
    await waitFor(() =>
      expect(mockSetTokens).toHaveBeenCalledWith('access-1', 'refresh-1'),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('disables the form while submitting and shows the loading label', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const submitButton = screen.getByRole('button', { name: /signing in/i });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Email*')).toBeDisabled();
    expect(screen.getByLabelText('Password*')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /show password/i }),
    ).toBeDisabled();

    resolveFetch(
      new Response(
        JSON.stringify({ accessToken: 'a', refreshToken: 'b' }),
        { status: 200 },
      ),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows the generic invalid-credential error and preserves form state', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid email or password' }), {
        status: 401,
      }),
    );
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Invalid email or password',
      ),
    );
    expect(mockSetTokens).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email*')).toHaveValue('jane@acme.com');
    expect(screen.getByLabelText('Password*')).toHaveValue('secret');
  });

  it('maps a rate-limited response to calm copy', async () => {
    fetchMock.mockResolvedValue(new Response('ThrottlerException', { status: 429 }));
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Too many sign-in attempts. Wait a moment and try again.',
      ),
    );
  });

  it('maps a network failure to connection copy', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        "We couldn't reach the service. Check your connection and try again.",
      ),
    );
  });
});

describe('LoginExperience — MFA flow', () => {
  async function reachMfaStep(user: ReturnType<typeof userEvent.setup>) {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ mfaRequired: true, userId: 'user-123' }), {
        status: 200,
      }),
    );
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /verify your identity/i }),
      ).toBeInTheDocument(),
    );
  }

  it('switches to a focused MFA step and hides credentials', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    expect(
      screen.getByText(/enter the 6-digit code from your authenticator app/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code*')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Email*')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password*')).not.toBeInTheDocument();
  });

  it('optimizes the MFA field for a one-time code', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    const code = screen.getByLabelText('Verification code*');
    expect(code).toHaveAttribute('id', 'mfaCode');
    expect(code).toHaveAttribute('name', 'mfaCode');
    expect(code).toHaveAttribute('inputMode', 'numeric');
    expect(code).toHaveAttribute('autoComplete', 'one-time-code');
    expect(code).toHaveAttribute('maxLength', '6');
  });

  it('blocks MFA submission without a 6-digit code', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.click(screen.getByRole('button', { name: /verify/i }));

    expect(
      screen.getByText('Enter the 6-digit verification code.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('submits the exact verify-login payload', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ mfaRequired: true, userId: 'user-123' }), {
        status: 200,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
        { status: 200 },
      ),
    );
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.type(screen.getByLabelText('Verification code*'), '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('http://localhost:3001/auth/verify-login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      userId: 'user-123',
      token: '123456',
    });
    await waitFor(() =>
      expect(mockSetTokens).toHaveBeenCalledWith('access-1', 'refresh-1'),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows the verifying loading state and disables the code field', async () => {
    let resolveVerify!: (value: Response) => void;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ mfaRequired: true, userId: 'u' }), {
        status: 200,
      }),
    );
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveVerify = resolve;
        }),
    );

    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.type(screen.getByLabelText('Verification code*'), '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const verifyButton = screen.getByRole('button', { name: /verifying/i });
    expect(verifyButton).toBeDisabled();
    expect(verifyButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Verification code*')).toBeDisabled();

    resolveVerify(
      new Response(
        JSON.stringify({ accessToken: 'a', refreshToken: 'b' }),
        { status: 200 },
      ),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('preserves the code step when MFA verification fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ mfaRequired: true, userId: 'u' }), {
        status: 200,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Invalid MFA code' }), {
        status: 401,
      }),
    );
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.type(screen.getByLabelText('Verification code*'), '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid MFA code'),
    );
    expect(
      screen.getByRole('heading', { name: /verify your identity/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code*')).toHaveValue('123456');
    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it('returns to the credentials step via "Use a different account"', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.click(
      screen.getByRole('button', { name: /use a different account/i }),
    );

    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email*')).toHaveValue('jane@acme.com');
    expect(screen.getByLabelText('Password*')).toHaveValue('secret');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('switches to the recovery-code input and explains the option', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.click(
      screen.getByRole('button', { name: /use a recovery code instead/i }),
    );

    expect(
      screen.getByText(/enter one of your recovery codes/i),
    ).toBeInTheDocument();
    const recovery = screen.getByLabelText('Recovery code*');
    expect(recovery).toHaveAttribute('placeholder', 'XXXX-XXXX-XXXX-XXXX');
    expect(recovery).toHaveAttribute('autoComplete', 'off');
    expect(recovery).toHaveAttribute('autoCapitalize', 'characters');
    expect(recovery).toHaveAttribute('spellcheck', 'false');
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Verification code*')).not.toBeInTheDocument();
  });

  it('switches back to the authenticator code input', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.click(
      screen.getByRole('button', { name: /use a recovery code instead/i }),
    );
    await user.click(
      screen.getByRole('button', { name: /use an authenticator code instead/i }),
    );

    expect(
      screen.getByText(/enter the 6-digit code from your authenticator app/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code*')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recovery code*')).not.toBeInTheDocument();
  });

  it('blocks an invalid recovery code without calling the API', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.click(
      screen.getByRole('button', { name: /use a recovery code instead/i }),
    );
    await user.type(screen.getByLabelText('Recovery code*'), '1111-1111-1111-1111');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    expect(
      screen.getByText('Enter a valid recovery code (e.g. XXXX-XXXX-XXXX-XXXX).'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Recovery code*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('submits the exact recovery-code verify-login payload', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ mfaRequired: true, userId: 'user-123' }), {
        status: 200,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
        { status: 200 },
      ),
    );
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.click(
      screen.getByRole('button', { name: /use a recovery code instead/i }),
    );
    await user.type(
      screen.getByLabelText('Recovery code*'),
      'abcd-efgh-ijkl-mnop',
    );
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('http://localhost:3001/auth/verify-login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      userId: 'user-123',
      recoveryCode: 'ABCDEFGHIJKLMNOP',
    });
    expect(JSON.parse(init.body)).not.toHaveProperty('token');
    await waitFor(() =>
      expect(mockSetTokens).toHaveBeenCalledWith('access-1', 'refresh-1'),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('clears any typed code when switching modes', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.click(
      screen.getByRole('button', { name: /use a recovery code instead/i }),
    );
    await user.type(
      screen.getByLabelText('Recovery code*'),
      'abcd-efgh-ijkl-mnop',
    );
    await user.click(
      screen.getByRole('button', { name: /use an authenticator code instead/i }),
    );

    expect(screen.getByLabelText('Verification code*')).toHaveValue('');

    await user.click(
      screen.getByRole('button', { name: /use a recovery code instead/i }),
    );
    expect(screen.getByLabelText('Recovery code*')).toHaveValue('');
  });

  it('resets to authenticator mode after "Use a different account"', async () => {
    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await reachMfaStep(user);

    await user.click(
      screen.getByRole('button', { name: /use a recovery code instead/i }),
    );
    await user.click(
      screen.getByRole('button', { name: /use a different account/i }),
    );

    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ mfaRequired: true, userId: 'user-123' }), {
        status: 200,
      }),
    );
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: /verify your identity/i }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByLabelText('Verification code*')).toBeInTheDocument();
    expect(screen.queryByLabelText('Recovery code*')).not.toBeInTheDocument();
  });
});

describe('LoginExperience — invitation continuation (V1-TEAM-01)', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('redirects to the invitation route after a successful sign-in', async () => {
    window.history.replaceState({}, '', '/login?next=/invite/abc123');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
        { status: 200 },
      ),
    );

    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/invite/abc123'));
  });

  it('keeps the sign-up cross-link pointing back to the invitation', async () => {
    window.history.replaceState({}, '', '/login?next=/invite/abc123');
    render(<LoginExperience />);

    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
      'href',
      '/signup?next=%2Finvite%2Fabc123',
    );
  });

  it('ignores an external next value and falls back to the dashboard', async () => {
    window.history.replaceState({}, '', '/login?next=//evil.example.com');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
        { status: 200 },
      ),
    );

    render(<LoginExperience />);
    const user = await fillValidCredentials();
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });
});

describe('LoginExperience — accessibility and regression', () => {
  it('does not add Forgot Password or Remember Me affordances', () => {
    render(<LoginExperience />);
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/remember me/i)).not.toBeInTheDocument();
  });

  it('keeps interactive controls keyboard reachable (no tabIndex=-1)', () => {
    render(<LoginExperience />);
    const email = screen.getByLabelText('Email*');
    const password = screen.getByLabelText('Password*');
    const toggle = screen.getByRole('button', { name: /show password/i });
    const submit = screen.getByRole('button', { name: /sign in/i });
    const link = screen.getByRole('link', { name: /sign up/i });

    for (const el of [email, password, toggle, submit, link]) {
      expect(el).not.toHaveAttribute('tabIndex', '-1');
    }
  });

  it('uses approved 44px touch-target sizing in login components', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.resolve(__dirname, '../components/login');
    const files = ['LoginForm.tsx', 'LoginPasswordField.tsx', 'LoginMfaStep.tsx']
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
      .join('\n');

    expect(files).toContain('h-11');
    expect(files).toContain('w-11');
    expect(files).not.toMatch(/h-10\b/);
  });

  it('removes GlassPanel and hard-coded colors from the login surface', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.resolve(__dirname, '../components/login');
    const files = ['LoginForm.tsx', 'LoginBrand.tsx', 'LoginMfaStep.tsx']
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
      .join('\n');
    const page = fs.readFileSync(
      path.resolve(__dirname, '../app/login/page.tsx'),
      'utf-8',
    );

    const combined = `${files}\n${page}`;
    expect(combined).not.toContain('GlassPanel');
    expect(combined).not.toContain('backdrop-blur');
    expect(combined).not.toContain('text-white');
    expect(combined).not.toContain('bg-white');
    expect(combined).not.toContain('bg-red-');
    expect(combined).not.toContain('text-red-');
    expect(combined).not.toContain('text-primary-400');
    expect(page).toContain('LoginExperience');
  });
});
