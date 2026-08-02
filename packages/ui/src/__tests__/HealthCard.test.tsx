import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { HealthCard } from '../components/HealthCard';

describe('HealthCard', () => {
  it('renders title', () => {
    render(<HealthCard title="Device Health" score={85} />);
    expect(screen.getByText('Device Health')).toBeInTheDocument();
  });

  it('renders score in ring mode', () => {
    render(<HealthCard title="Health" score={85} displayMode="ring" />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders score in bar mode', () => {
    render(<HealthCard title="Health" score={85} displayMode="bar" />);
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('/ 100')).toBeInTheDocument();
  });

  it('renders score in compact mode', () => {
    render(<HealthCard title="Health" score={85} displayMode="compact" />);
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<HealthCard title="Health" score={85} label="Excellent" />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<HealthCard title="Health" score={85} description="Above average" />);
    expect(screen.getByText('Above average')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<HealthCard title="Health" score={85} status="success" />);
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('renders trend', () => {
    render(<HealthCard title="Health" score={85} trend={{ direction: 'up', value: '+5' }} />);
    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(<HealthCard title="Health" score={85} icon={<span data-testid="icon">H</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders action', () => {
    render(<HealthCard title="Health" score={85} action={<button data-testid="action">View</button>} />);
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<HealthCard title="Health" loading data-testid="card" />);
    expect(screen.getByTestId('card').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders no-data state in ring mode', () => {
    render(<HealthCard title="Health" score={null} displayMode="ring" />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders no-data state in compact mode', () => {
    render(<HealthCard title="Health" score={null} displayMode="compact" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders freshness label', () => {
    render(<HealthCard title="Health" score={85} freshnessLabel="Updated 2 min ago" />);
    expect(screen.getByText('Updated 2 min ago')).toBeInTheDocument();
  });

  it('applies variant', () => {
    render(<HealthCard title="Health" score={85} variant="glass" data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-variant', 'glass');
  });

  it('applies custom className', () => {
    render(<HealthCard title="Health" score={85} className="custom" data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<HealthCard title="Health" score={85} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
