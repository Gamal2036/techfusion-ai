import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MetricValue } from '../components/MetricValue';

describe('MetricValue', () => {
  it('renders value', () => {
    render(<MetricValue value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<MetricValue value="Offline" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders unit', () => {
    render(<MetricValue value={50} unit="%" />);
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('renders prefix', () => {
    render(<MetricValue value="24" prefix="$" />);
    expect(screen.getByText('$')).toBeInTheDocument();
  });

  it('renders suffix', () => {
    render(<MetricValue value="13.1" suffix="GB" />);
    expect(screen.getByText('GB')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(<MetricValue value={42} label="Total" />);
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<MetricValue value={42} description="From last month" />);
    expect(screen.getByText('From last month')).toBeInTheDocument();
  });

  it('renders no-data fallback for null value', () => {
    render(<MetricValue value={null} noDataLabel="No Data" />);
    expect(screen.getByText('No Data')).toBeInTheDocument();
  });

  it('renders no-data fallback for empty string', () => {
    render(<MetricValue value="" noDataLabel="N/A" />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<MetricValue value={42} loading data-testid="mv" />);
    expect(screen.getByTestId('mv').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('applies success tone', () => {
    render(<MetricValue value={42} tone="success" data-testid="mv" />);
    expect(screen.getByTestId('mv').querySelector('.text-success')).toBeInTheDocument();
  });

  it('applies danger tone', () => {
    render(<MetricValue value="Error" tone="danger" data-testid="mv" />);
    expect(screen.getByTestId('mv').querySelector('.text-danger')).toBeInTheDocument();
  });

  it('applies size sm', () => {
    render(<MetricValue value={42} size="sm" data-testid="mv" />);
    expect(screen.getByTestId('mv').querySelector('.text-sm')).toBeInTheDocument();
  });

  it('applies size xl', () => {
    render(<MetricValue value={42} size="xl" data-testid="mv" />);
    expect(screen.getByTestId('mv').querySelector('.text-4xl')).toBeInTheDocument();
  });

  it('applies monospaced by default', () => {
    render(<MetricValue value={42} data-testid="mv" />);
    expect(screen.getByTestId('mv').querySelector('.font-mono')).toBeInTheDocument();
  });

  it('disables monospaced', () => {
    render(<MetricValue value={42} monospaced={false} data-testid="mv" />);
    expect(screen.getByTestId('mv').querySelector('.font-mono')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<MetricValue value={42} className="custom" data-testid="mv" />);
    expect(screen.getByTestId('mv').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<MetricValue value={42} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
