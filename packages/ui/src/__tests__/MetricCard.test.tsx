import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../components/MetricCard';

describe('MetricCard', () => {
  it('renders title', () => {
    render(<MetricCard title="CPU Usage" value={45} unit="%" />);
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
  });

  it('renders value', () => {
    render(<MetricCard title="CPU" value={45} unit="%" />);
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('renders unit', () => {
    render(<MetricCard title="CPU" value={45} unit="%" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<MetricCard title="CPU" value={45} description="Current load" />);
    expect(screen.getByText('Current load')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<MetricCard title="CPU" value={45} status="success" />);
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('renders trend', () => {
    render(<MetricCard title="CPU" value={45} trend={{ direction: 'up', value: '+3%' }} />);
    expect(screen.getByText('+3%')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<MetricCard title="CPU" loading data-testid="card" />);
    expect(screen.getByTestId('card').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders no-data state', () => {
    render(<MetricCard title="CPU" noData />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders action', () => {
    render(<MetricCard title="CPU" value={45} action={<button data-testid="action">View</button>} />);
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('renders footer', () => {
    render(<MetricCard title="CPU" value={45} footer={<div data-testid="footer">Details</div>} />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('applies variant default', () => {
    render(<MetricCard title="CPU" value={45} variant="default" data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-variant', 'default');
  });

  it('applies variant glass', () => {
    render(<MetricCard title="CPU" value={45} variant="glass" data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-variant', 'glass');
  });

  it('applies compact mode', () => {
    render(<MetricCard title="CPU" value={45} compact data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('p-3');
  });

  it('renders visualization slot', () => {
    render(<MetricCard title="CPU" value={45} visualizationSlot={<div data-testid="viz">Chart</div>} />);
    expect(screen.getByTestId('viz')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<MetricCard title="CPU" value={45} icon={<span data-testid="icon">C</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<MetricCard title="CPU" value={45} className="custom" data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<MetricCard title="CPU" value={45} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
