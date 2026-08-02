import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupExperience } from '@/components/signup/SignupExperience';

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

jest.mock('framer-motion', () => {
  const allowed = new Set([
    'children',
    'className',
    'style',
    'role',
    'id',
    'tabIndex',
    'href',
    'type',
    'name',
    'value',
    'placeholder',
    'disabled',
    'autoComplete',
    'aria-label',
    'aria-live',
    'aria-hidden',
    'aria-busy',
    'aria-pressed',
    'aria-invalid',
    'aria-describedby',
    'data-testid',
  ]);
  const filterDomProps = (props: Record<string, unknown>) => {
    const dom: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      if (
        allowed.has(key) ||
        key.startsWith('aria-') ||
        key.startsWith('data-') ||
        key.startsWith('on')
      ) {
        dom[key] = props[key];
      }
    }
    return dom;
  };
  const makeMotion =
    (Tag: any) =>
    ({ children, ...props }: any) => (
      <Tag {...filterDomProps(props)}>{children}</Tag>
    );
  return {
    motion: {
      div: makeMotion('div'),
      h1: makeMotion('h1'),
      p: makeMotion('p'),
      li: makeMotion('li'),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
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
      return (
        <div className={className}>
          {label && (
            <label
              htmlFor={inputId}
              className="mb-1.5 block text-xs font-medium"
            >
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
            {...props}
          />
          {rightElement}
          {error && <p role="alert">{error}</p>}
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
          leftIcon,
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
          {children}
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

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

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

async function fillValidForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Organization*'), 'Acme Corp');
  await user.type(screen.getByLabelText('Full Name*'), 'Jane Doe');
  await user.type(screen.getByLabelText('Email*'), 'jane@acme.com');
  await user.type(screen.getByLabelText('Password*'), 'Passw0rd!');
  await user.type(screen.getByLabelText('Confirm Password*'), 'Passw0rd!');
}

describe('SignupExperience', () => {
  it('renders a calm brand panel with the one-line promise', () => {
    render(<SignupExperience />);

    expect(
      screen.getByRole('heading', {
        name: /complete, trustworthy command over your technology/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/create your workspace/i),
    ).toBeInTheDocument();

    const brand = screen.getByRole('region', {
      name: /techfusion/i,
    });
    expect(
      within(brand).getByRole('heading', {
        name: /complete, trustworthy command over your technology/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders all registration fields in the form panel', () => {
    render(<SignupExperience />);

    expect(screen.getByLabelText('Organization*')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name*')).toBeInTheDocument();
    expect(screen.getByLabelText('Email*')).toBeInTheDocument();
    expect(screen.getByLabelText('Password*')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password*')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('toggles password visibility with the show/hide button', async () => {
    render(<SignupExperience />);
    const user = userEvent.setup();
    const passwordInput = screen.getByLabelText('Password*');

    expect(passwordInput).toHaveAttribute('type', 'password');
    await user.type(passwordInput, 'secret');
    await user.click(
      screen.getAllByRole('button', { name: /show password/i })[0],
    );
    expect(passwordInput).toHaveAttribute('type', 'text');
    await user.click(
      screen.getAllByRole('button', { name: /hide password/i })[0],
    );
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows live password strength feedback and requirements', async () => {
    render(<SignupExperience />);
    const user = userEvent.setup();
    const passwordInput = screen.getByLabelText('Password*');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.type(passwordInput, 'pass');
    expect(screen.getByRole('status')).toHaveTextContent('Weak');

    await user.clear(passwordInput);
    await user.type(passwordInput, 'Passw0rd!');
    expect(screen.getByRole('status')).toHaveTextContent('Strong');
    expect(screen.getByText('8+ characters')).toBeInTheDocument();
    expect(screen.getByText('Uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('Lowercase letter')).toBeInTheDocument();
    expect(screen.getByText('Number')).toBeInTheDocument();
    expect(screen.getByText('Special character')).toBeInTheDocument();
  });

  it('flags a mismatched confirm password and blocks submission', async () => {
    render(<SignupExperience />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Organization*'), 'Acme Corp');
    await user.type(screen.getByLabelText('Full Name*'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email*'), 'jane@acme.com');
    await user.type(screen.getByLabelText('Password*'), 'Passw0rd1!');
    await user.type(screen.getByLabelText('Confirm Password*'), 'Passw0rd2!');

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password*')).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits the original payload to /auth/signup and navigates to dashboard on success', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
        { status: 200 },
      ),
    );
    render(<SignupExperience />);
    const user = userEvent.setup();

    await fillValidForm();
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3001/auth/signup');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      email: 'jane@acme.com',
      password: 'Passw0rd!',
      displayName: 'Jane Doe',
      orgName: 'Acme Corp',
    });
    await waitFor(() =>
      expect(mockSetTokens).toHaveBeenCalledWith('access-1', 'refresh-1'),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows the API error message and does not navigate on failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Email already in use' }), {
        status: 409,
      }),
    );
    render(<SignupExperience />);
    const user = userEvent.setup();

    await fillValidForm();
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Email already in use',
      ),
    );
    expect(mockSetTokens).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('disables the submit button and marks it busy while submitting', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(<SignupExperience />);
    const user = userEvent.setup();

    await fillValidForm();
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const submitButton = screen.getByRole('button', {
      name: /create account/i,
    });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute('aria-busy', 'true');

    resolveFetch(
      new Response(JSON.stringify({ accessToken: 'a', refreshToken: 'b' }), {
        status: 200,
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });
});
