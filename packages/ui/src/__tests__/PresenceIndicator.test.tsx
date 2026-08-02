import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { PresenceIndicator } from '../components/PresenceIndicator';

describe('PresenceIndicator', () => {
  it('renders online status', () => {
    render(<PresenceIndicator status="online" />);
    expect(screen.getByRole('img', { name: 'Online' })).toBeInTheDocument();
  });

  it('renders offline status', () => {
    render(<PresenceIndicator status="offline" />);
    expect(screen.getByRole('img', { name: 'Offline' })).toBeInTheDocument();
  });

  it('renders away status', () => {
    render(<PresenceIndicator status="away" />);
    expect(screen.getByRole('img', { name: 'Away' })).toBeInTheDocument();
  });

  it('renders busy status', () => {
    render(<PresenceIndicator status="busy" />);
    expect(screen.getByRole('img', { name: 'Busy' })).toBeInTheDocument();
  });

  it('renders unknown status', () => {
    render(<PresenceIndicator status="unknown" />);
    expect(screen.getByRole('img', { name: 'Unknown' })).toBeInTheDocument();
  });

  it('uses custom label', () => {
    render(<PresenceIndicator status="online" label="Connected" />);
    expect(screen.getByRole('img', { name: 'Connected' })).toBeInTheDocument();
  });

  it('applies size classes', () => {
    const { rerender } = render(<PresenceIndicator status="online" size="md" />);
    const indicator = screen.getByRole('img', { name: 'Online' });
    expect(indicator.className).toContain('h-3');

    rerender(<PresenceIndicator status="online" size="lg" />);
    expect(screen.getByRole('img', { name: 'Online' }).className).toContain('h-3.5');
  });

  it('applies pulse class for online with showPulse', () => {
    render(<PresenceIndicator status="online" showPulse />);
    const indicator = screen.getByRole('img', { name: 'Online' });
    expect(indicator.className).toContain('animate-pulse');
  });

  it('does not pulse for non-online status', () => {
    render(<PresenceIndicator status="offline" showPulse />);
    expect(screen.getByRole('img', { name: 'Offline' }).className).not.toContain('animate-pulse');
  });

  it('has accessible role', () => {
    render(<PresenceIndicator status="busy" />);
    expect(screen.getByRole('img', { name: 'Busy' })).toHaveAttribute('role', 'img');
  });
});
