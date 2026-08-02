import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { DataSummary } from '../components/DataSummary';

const sampleItems = [
  { label: 'Name', value: 'Desktop-01' },
  { label: 'IP Address', value: '192.168.1.1' },
  { label: 'Status', value: 'Online', tone: 'success' as const },
  { label: 'CPU', value: '45%' },
];

describe('DataSummary', () => {
  it('renders items', () => {
    render(<DataSummary items={sampleItems} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Desktop-01')).toBeInTheDocument();
    expect(screen.getByText('IP Address')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
  });

  it('renders item with description', () => {
    const items = [
      { label: 'CPU', value: '45%', description: 'Current load' },
    ];
    render(<DataSummary items={items} />);
    expect(screen.getByText('Current load')).toBeInTheDocument();
  });

  it('renders item with icon', () => {
    const items = [
      { label: 'CPU', value: '45%', icon: <span data-testid="icon">C</span> },
    ];
    render(<DataSummary items={items} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders with role list', () => {
    render(<DataSummary items={sampleItems} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<DataSummary items={[]} emptyTitle="No data" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<DataSummary items={[]} loading data-testid="summary" />);
    expect(screen.getByTestId('summary').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('applies horizontal orientation', () => {
    render(<DataSummary items={sampleItems} orientation="horizontal" data-testid="summary" />);
    expect(screen.getByTestId('summary')).toBeInTheDocument();
  });

  it('applies 1 column', () => {
    render(<DataSummary items={sampleItems} columns={1} data-testid="summary" />);
    expect(screen.getByTestId('summary').className).toContain('grid-cols-1');
  });

  it('applies 2 columns', () => {
    render(<DataSummary items={sampleItems} columns={2} data-testid="summary" />);
    expect(screen.getByTestId('summary').className).toContain('sm:grid-cols-2');
  });

  it('applies compact mode', () => {
    render(<DataSummary items={sampleItems} compact data-testid="summary" />);
    expect(screen.getByTestId('summary')).toBeInTheDocument();
  });

  it('applies divided', () => {
    render(<DataSummary items={sampleItems} divided data-testid="summary" />);
    expect(screen.getByTestId('summary').className).toContain('divide-y');
  });

  it('applies custom className', () => {
    render(<DataSummary items={sampleItems} className="custom" data-testid="summary" />);
    expect(screen.getByTestId('summary').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<DataSummary items={sampleItems} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
