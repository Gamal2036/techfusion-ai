import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingFlow } from '@/components/command-center/OnboardingFlow';

const mockUseDeviceList = jest.fn();
const mockApiFetch = jest.fn();
const onComplete = jest.fn();

jest.mock('@/hooks/useDevices', () => ({
  useDeviceList: (...args: any[]) => mockUseDeviceList(...args),
}));

jest.mock('@/lib/auth-client', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn() },
}));

jest.mock('@techfusion/ui', () => ({
  GlassPanel: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Monitor: MockIcon,
    Loader2: MockIcon,
    Copy: MockIcon,
    Check: MockIcon,
    CheckCircle: MockIcon,
    Key: MockIcon,
    AlertTriangle: MockIcon,
  };
});

async function generateLinuxToken() {
  const user = userEvent.setup();
  render(<OnboardingFlow onComplete={onComplete} />);
  await user.click(screen.getByRole('button', { name: /linux/i }));
  await user.click(
    screen.getByRole('button', { name: /generate enrollment token/i }),
  );
  return user;
}

describe('OnboardingFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDeviceList.mockReturnValue({
      devices: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
      startFastPolling: jest.fn(),
      fastPolling: false,
    });
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
    delete process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('selecting an OS advances to the token step with aria-pressed state', async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow onComplete={onComplete} />);

    const linux = screen.getByRole('button', { name: /linux/i });
    expect(linux).toHaveAttribute('aria-pressed', 'false');

    await user.click(linux);

    expect(
      screen.getByText('Generate a one-time enrollment token used only during installation'),
    ).toBeInTheDocument();
  });

  it('renders the installer command after a successful token generation', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tfenr_qa_test_token' }),
    });

    render(<OnboardingFlow onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /linux/i }));
    await user.click(
      screen.getByRole('button', { name: /generate enrollment token/i }),
    );

    const command = await screen.findByText(/tfenr_qa_test_token/);
    expect(command).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith('/enrollment/tokens', expect.any(Object));
    expect(
      screen.getByText(/install-linux\.sh/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/--api "http:\/\/localhost:3001"/),
    ).toBeInTheDocument();
  });

  it('shows an inline error when token generation fails', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'quota exceeded',
    });

    render(<OnboardingFlow onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /linux/i }));
    await user.click(
      screen.getByRole('button', { name: /generate enrollment token/i }),
    );

    const err = await screen.findByText(/quota exceeded/i);
    expect(err).toBeInTheDocument();
    expect(screen.queryByText(/tfenr_/)).toBeNull();
  });

  it('creates a single-use token for Linux onboarding', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tfenr_linux_once' }),
    });
    await generateLinuxToken();

    await screen.findByText(/tfenr_linux_once/);
    expect(mockApiFetch).toHaveBeenCalledWith('/enrollment/tokens', {
      method: 'POST',
      body: expect.stringContaining('"maxUses":1'),
    });
  });

  it('Linux command uses the bootstrap installer, not cargo run', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tfenr_linux_install' }),
    });
    await generateLinuxToken();

    const command = await screen.findByText(/install-linux\.sh/);
    expect(command).toBeInTheDocument();
    expect(screen.queryByText(/cargo run/)).toBeNull();
    expect(screen.queryByText(/TF_ORG_TOKEN/)).toBeNull();
    expect(screen.getByText(/sha256sum -c techfusion-install\.sh\.sha256/)).toBeInTheDocument();
  });

  it('Linux command embeds the configured release base URL', async () => {
    process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL = 'https://downloads.example/releases/download/v1.0.0-agent-beta.2';
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tfenr_linux_url' }),
    });
    await generateLinuxToken();

    const command = await screen.findByText(/install-linux\.sh/);
    expect(command).toHaveTextContent('--release "https://downloads.example/releases/download/v1.0.0-agent-beta.2"');
  });

  it('Linux command uses the published release default when not configured', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tfenr_linux_default' }),
    });
    await generateLinuxToken();

    const command = await screen.findByText(/install-linux\.sh/);
    expect(command).toHaveTextContent(
      '--release "https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.3"',
    );
    expect(command).not.toHaveTextContent('--url ');
  });

  it('non-Linux onboarding keeps the existing developer command', async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tfenr_mac_test' }),
    });
    render(<OnboardingFlow onComplete={onComplete} />);
    await user.click(screen.getByRole('button', { name: /macOS/i }));
    await user.click(screen.getByRole('button', { name: /generate enrollment token/i }));

    await screen.findByText(/tfenr_mac_test/);
    expect(screen.getByText(/cargo run/)).toBeInTheDocument();
  });
});
