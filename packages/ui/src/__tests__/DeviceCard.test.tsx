import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { DeviceCard } from '../components/DeviceCard';

describe('DeviceCard', () => {
  it('renders name', () => {
    render(<DeviceCard name="Desktop-01" />);
    expect(screen.getByText('Desktop-01')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<DeviceCard name="Desktop-01" subtitle="Main Workstation" />);
    expect(screen.getByText('Main Workstation')).toBeInTheDocument();
  });

  it('renders operating system', () => {
    render(<DeviceCard name="Desktop-01" operatingSystem="Windows 11" />);
    expect(screen.getByText(/Windows 11/)).toBeInTheDocument();
  });

  it('renders device type', () => {
    render(<DeviceCard name="Desktop-01" deviceType="Laptop" />);
    expect(screen.getByText(/Laptop/)).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<DeviceCard name="Desktop-01" status="online" />);
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('renders last seen', () => {
    render(<DeviceCard name="Desktop-01" lastSeen="2 minutes ago" />);
    expect(screen.getByText(/2 minutes ago/)).toBeInTheDocument();
  });

  it('renders health metric', () => {
    render(
      <DeviceCard
        name="Desktop-01"
        health={{ label: 'Health', value: 95, tone: 'success' }}
      />,
    );
    expect(screen.getByText('95')).toBeInTheDocument();
  });

  it('renders multiple metrics', () => {
    render(
      <DeviceCard
        name="Desktop-01"
        health={{ label: 'Health', value: 95 }}
        performance={{ label: 'Performance', value: 'Good' }}
        risk={{ label: 'Risk', value: 'Low' }}
      />,
    );
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Risk')).toBeInTheDocument();
  });

  it('renders metadata', () => {
    render(
      <DeviceCard
        name="Desktop-01"
        metadata={[{ label: 'IP', value: '192.168.1.1' }]}
      />,
    );
    expect(screen.getByText(/IP/)).toBeInTheDocument();
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
  });

  it('renders action', () => {
    render(
      <DeviceCard
        name="Desktop-01"
        action={<button data-testid="action">Edit</button>}
      />,
    );
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('renders menu slot', () => {
    render(
      <DeviceCard
        name="Desktop-01"
        menuSlot={<button data-testid="menu">Menu</button>}
      />,
    );
    expect(screen.getByTestId('menu')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<DeviceCard name="Desktop-01" loading data-testid="card" />);
    expect(screen.getByTestId('card').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('applies compact layout', () => {
    render(<DeviceCard name="Desktop-01" compact data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('p-3');
  });

  it('applies list layout', () => {
    render(<DeviceCard name="Desktop-01" layout="list" data-testid="card" />);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('applies selected state', () => {
    render(<DeviceCard name="Desktop-01" selected data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-selected', 'true');
  });

  it('applies interactive mode', () => {
    render(<DeviceCard name="Desktop-01" interactive data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('cursor-pointer');
  });

  it('renders icon', () => {
    render(<DeviceCard name="Desktop-01" icon={<span data-testid="icon">🖥</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<DeviceCard name="Desktop-01" className="custom" data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<DeviceCard name="Desktop-01" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
