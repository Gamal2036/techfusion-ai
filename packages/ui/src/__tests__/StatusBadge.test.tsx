import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/StatusBadge';

describe('StatusBadge', () => {
  it('renders with label', () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<StatusBadge status="online" label="Connected" />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders neutral status', () => {
    render(<StatusBadge status="neutral" data-testid="badge" />);
    expect(screen.getByTestId('badge')).toHaveAttribute('data-status', 'neutral');
  });

  it('renders all generic statuses', () => {
    const statuses = ['neutral', 'info', 'success', 'warning', 'danger'] as const;
    statuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} data-testid="badge" />);
      expect(screen.getByTestId('badge')).toHaveAttribute('data-status', status);
      unmount();
    });
  });

  it('renders all operational statuses', () => {
    const statuses = ['online', 'offline', 'away', 'busy', 'syncing', 'pending', 'active', 'inactive', 'unknown'] as const;
    statuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(status.charAt(0).toUpperCase() + status.slice(1))).toBeInTheDocument();
      unmount();
    });
  });

  it('renders with dot for non-presence status', () => {
    render(<StatusBadge status="success" dot data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    const dot = badge.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
    expect(dot?.className).toContain('rounded-full');
  });

  it('renders with icon', () => {
    render(
      <StatusBadge
        status="success"
        icon={<span data-testid="icon">✓</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies sm size', () => {
    render(<StatusBadge status="online" size="sm" data-testid="badge" />);
    expect(screen.getByTestId('badge').className).toContain('text-[10px]');
  });

  it('applies lg size', () => {
    render(<StatusBadge status="online" size="lg" data-testid="badge" />);
    expect(screen.getByTestId('badge').className).toContain('text-sm');
  });

  it('applies outline variant', () => {
    render(<StatusBadge status="online" variant="outline" data-testid="badge" />);
    expect(screen.getByTestId('badge').className).toContain('bg-transparent');
  });

  it('has role status', () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<StatusBadge status="online" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Online');
  });

  it('applies custom className', () => {
    render(<StatusBadge status="online" className="custom" data-testid="badge" />);
    expect(screen.getByTestId('badge').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<StatusBadge status="online" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});
