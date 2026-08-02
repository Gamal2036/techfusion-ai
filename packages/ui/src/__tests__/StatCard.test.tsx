import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../components/StatCard';

describe('StatCard', () => {
  it('renders title', () => {
    render(<StatCard title="Total Devices" value={42} />);
    expect(screen.getByText('Total Devices')).toBeInTheDocument();
  });

  it('renders value', () => {
    render(<StatCard title="Devices" value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<StatCard title="Devices" value={42} description="All connected" />);
    expect(screen.getByText('All connected')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <StatCard
        title="Devices"
        value={42}
        icon={<span data-testid="icon">🖥</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders trend', () => {
    render(
      <StatCard
        title="Devices"
        value={42}
        trend={{ direction: 'up', value: '+5%' }}
      />,
    );
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('renders action', () => {
    render(
      <StatCard
        title="Devices"
        value={42}
        action={<button data-testid="action">View</button>}
      />,
    );
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<StatCard title="Devices" loading data-testid="card" />);
    expect(screen.getByTestId('card').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('applies variant default', () => {
    render(<StatCard title="Devices" value={42} variant="default" data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-variant', 'default');
  });

  it('applies variant glass', () => {
    render(<StatCard title="Devices" value={42} variant="glass" data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-variant', 'glass');
  });

  it('applies compact mode', () => {
    render(<StatCard title="Devices" value={42} compact data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('p-3');
  });

  it('applies tone icon background', () => {
    render(<StatCard title="Devices" value={42} tone="success" icon={<span>📊</span>} data-testid="card" />);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StatCard title="Devices" value={42} className="custom" data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<StatCard title="Devices" value={42} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
