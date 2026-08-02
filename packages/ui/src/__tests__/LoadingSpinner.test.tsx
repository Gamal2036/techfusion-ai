import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with role status', () => {
    render(<LoadingSpinner data-testid="spinner" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with default aria-label', () => {
    render(<LoadingSpinner data-testid="spinner" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders custom label', () => {
    render(<LoadingSpinner label="Saving..." data-testid="spinner" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Saving...');
  });

  it('renders label text when provided', () => {
    render(<LoadingSpinner label="Loading data" data-testid="spinner" />);
    expect(screen.getByText('Loading data')).toBeInTheDocument();
  });

  it('renders xs size', () => {
    render(<LoadingSpinner size="xs" data-testid="spinner" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg?.className.baseVal).toContain('h-3');
  });

  it('renders md size by default', () => {
    render(<LoadingSpinner data-testid="spinner" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg?.className.baseVal).toContain('h-6');
  });

  it('renders xl size', () => {
    render(<LoadingSpinner size="xl" data-testid="spinner" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg?.className.baseVal).toContain('h-12');
  });

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-class" data-testid="spinner" />);
    expect(screen.getByTestId('spinner').className).toContain('custom-class');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<LoadingSpinner ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('renders with aria-live polite', () => {
    render(<LoadingSpinner data-testid="spinner" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
