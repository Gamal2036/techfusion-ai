import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OrganizationSwitcher } from '@/components/org/OrganizationSwitcher';
import { createOrganization, fetchOrganizations, switchToOrganization } from '@/lib/org-client';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/lib/org-client', () => ({
  fetchOrganizations: jest.fn(),
  createOrganization: jest.fn(),
  switchToOrganization: jest.fn(),
}));

jest.mock('@techfusion/ui', () => {
  const Button = ({ children, ...props }: any) => <button {...props}>{children}</button>;
  const Badge = ({ children, ...props }: any) => <span {...props}>{children}</span>;
  const Dialog = ({ open, children }: any) => (open ? <div data-testid="dialog">{children}</div> : null);
  const DialogContent = ({ children }: any) => <div>{children}</div>;
  const DialogHeader = ({ children }: any) => <div>{children}</div>;
  const DialogTitle = ({ children }: any) => <h2>{children}</h2>;
  const DialogDescription = ({ children }: any) => <p>{children}</p>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button, Badge };
});

jest.mock('lucide-react', () => {
  const MockIcon = (props: any) => <svg data-testid="icon" {...props} />;
  return {
    Building2: MockIcon,
    Check: MockIcon,
    Loader2: MockIcon,
    Plus: MockIcon,
    Settings: MockIcon,
    AlertTriangle: MockIcon,
    ChevronRight: MockIcon,
  };
});

const mockFetchOrganizations = fetchOrganizations as jest.MockedFunction<typeof fetchOrganizations>;
const mockCreateOrganization = createOrganization as jest.MockedFunction<typeof createOrganization>;
const mockSwitchToOrganization = switchToOrganization as jest.MockedFunction<typeof switchToOrganization>;

const ORGS = [
  {
    id: 'org-a',
    name: 'Acme Corp',
    slug: 'acme-corp',
    plan: 'Team',
    createdAt: '2026-01-01T00:00:00Z',
    membershipRole: 'Owner' as const,
    isActive: true,
  },
  {
    id: 'org-b',
    name: 'Globex',
    slug: 'globex',
    plan: 'Free',
    createdAt: '2026-02-01T00:00:00Z',
    membershipRole: 'Admin' as const,
    isActive: false,
  },
];

describe('OrganizationSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchOrganizations.mockResolvedValue(ORGS);
    mockSwitchToOrganization.mockResolvedValue({
      user: { id: 'u1', email: 'a@test.com', displayName: 'A', role: 'Owner', orgId: 'org-b' },
      accessToken: 'a2',
      refreshToken: 'r2',
    });
    mockCreateOrganization.mockResolvedValue(ORGS[1]);
  });

  it('lists organizations with role badges and highlights the current one', async () => {
    render(<OrganizationSwitcher open onOpenChange={jest.fn()} />);

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.getByText('Current organization')).toBeInTheDocument();

    const currentRow = screen.getByText('Acme Corp').closest('button');
    expect(currentRow).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('shows an empty state when the user has no organizations', async () => {
    mockFetchOrganizations.mockResolvedValue([]);
    render(<OrganizationSwitcher open onOpenChange={jest.fn()} />);
    expect(await screen.findByText('No organizations found.')).toBeInTheDocument();
  });

  it('closes the dialog without switching when the current org is selected', async () => {
    const onOpenChange = jest.fn();
    render(<OrganizationSwitcher open onOpenChange={onOpenChange} />);

    fireEvent.click(await screen.findByText('Acme Corp'));

    expect(mockSwitchToOrganization).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('switches to a non-active organization via switchToOrganization', async () => {
    const onOpenChange = jest.fn();
    render(<OrganizationSwitcher open onOpenChange={onOpenChange} />);

    fireEvent.click(await screen.findByText('Globex'));

    await waitFor(() => expect(mockSwitchToOrganization).toHaveBeenCalledWith('org-b'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('surfaces a switch error in an alert', async () => {
    mockSwitchToOrganization.mockRejectedValue(new Error('You are not a member of this organization'));
    render(<OrganizationSwitcher open onOpenChange={jest.fn()} />);

    fireEvent.click(await screen.findByText('Globex'));

    expect(await screen.findByText('You are not a member of this organization')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('creates and switches to a new organization', async () => {
    render(<OrganizationSwitcher open onOpenChange={jest.fn()} />);

    fireEvent.click(await screen.findByText('Create Organization'));

    const input = await screen.findByLabelText('Organization name');
    fireEvent.change(input, { target: { value: 'TechFusion Lab' } });
    fireEvent.click(screen.getByText('Create & Switch'));

    await waitFor(() => expect(mockCreateOrganization).toHaveBeenCalledWith('TechFusion Lab'));
    await waitFor(() => expect(mockSwitchToOrganization).toHaveBeenCalledWith('org-b'));
  });

  it('does not create when the name is empty', async () => {
    render(<OrganizationSwitcher open onOpenChange={jest.fn()} />);

    fireEvent.click(await screen.findByText('Create Organization'));

    const createButton = await screen.findByText('Create & Switch');
    expect((createButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(createButton);
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('reloads the organization list each time the dialog opens', async () => {
    const { rerender } = render(<OrganizationSwitcher open={false} onOpenChange={jest.fn()} />);
    expect(mockFetchOrganizations).not.toHaveBeenCalled();

    rerender(<OrganizationSwitcher open onOpenChange={jest.fn()} />);
    await waitFor(() => expect(mockFetchOrganizations).toHaveBeenCalledTimes(1));
  });
});
