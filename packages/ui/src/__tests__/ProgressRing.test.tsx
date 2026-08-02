import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressRing } from '../components/ProgressRing';

describe('ProgressRing', () => {
  it('renders with role progressbar', () => {
    render(<ProgressRing value={50} data-testid="ring" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow', () => {
    render(<ProgressRing value={75} data-testid="ring" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('sets aria-valuemin and aria-valuemax', () => {
    render(<ProgressRing value={50} max={200} data-testid="ring" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '200');
  });

  it('shows percentage text', () => {
    render(<ProgressRing value={75} showPercentage data-testid="ring" />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows label', () => {
    render(<ProgressRing value={50} label="Progress" data-testid="ring" />);
    expect(screen.getByText('Progress')).toBeInTheDocument();
  });

  it('renders indeterminate state', () => {
    render(<ProgressRing indeterminate data-testid="ring" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-busy', 'true');
    expect(bar).not.toHaveAttribute('aria-valuenow');
  });

  it('clamps value above max', () => {
    render(<ProgressRing value={150} max={100} showPercentage data-testid="ring" />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders sm size', () => {
    render(<ProgressRing value={50} size="sm" data-testid="ring" />);
    const svg = screen.getByTestId('ring').querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
  });

  it('renders xl size', () => {
    render(<ProgressRing value={50} size="xl" data-testid="ring" />);
    const svg = screen.getByTestId('ring').querySelector('svg');
    expect(svg).toHaveAttribute('width', '96');
  });

  it('applies custom className', () => {
    render(<ProgressRing value={50} className="custom" data-testid="ring" />);
    expect(screen.getByTestId('ring').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ProgressRing value={50} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('renders SVG circles', () => {
    render(<ProgressRing value={50} data-testid="ring" />);
    const circles = screen.getByTestId('ring').querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('sets aria-label', () => {
    render(<ProgressRing value={50} label="Upload" data-testid="ring" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Upload');
  });
});
