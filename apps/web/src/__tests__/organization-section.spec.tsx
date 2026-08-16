import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { OrganizationSection } from '@/components/account/OrganizationSection';

jest.mock('next/link', () => {
  return ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

const ORG = {
  id: 'org-1',
  name: 'Acme Networks',
  slug: 'acme',
  plan: 'PRO',
  createdAt: '2025-01-01T00:00:00Z',
  membershipRole: 'Owner' as const,
  isActive: true,
};

describe('OrganizationSection with the real @techfusion/ui Button', () => {
  it('transitions from loading to a loaded organization without a Slot exception', () => {
    const { rerender } = render(
      <OrganizationSection org={null} loading={true} error={null} onRetry={() => {}} />,
    );
    expect(screen.getByText('Loading organization...')).toBeInTheDocument();

    expect(() =>
      rerender(<OrganizationSection org={ORG} loading={false} error={null} onRetry={() => {}} />),
    ).not.toThrow();

    expect(screen.getByText('Acme Networks')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage organization/i })).toBeInTheDocument();
  });

  it('renders the Manage organization link with the correct href through the real Button', () => {
    render(<OrganizationSection org={ORG} loading={false} error={null} onRetry={() => {}} />);

    const link = screen.getByRole('link', { name: /manage organization/i });
    expect(link).toHaveAttribute('href', '/dashboard/settings/organization');
    expect(link).toHaveTextContent('Manage organization');
  });

  it('renders the loading status while pending', () => {
    render(<OrganizationSection org={null} loading={true} error={null} onRetry={() => {}} />);

    expect(screen.getByText('Loading organization...')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
