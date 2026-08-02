import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Progress } from '../components/Progress';

describe('Progress', () => {
  it('renders with role progressbar', () => {
    render(<Progress value={50} data-testid="progress" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('sets aria-valuenow', () => {
    render(<Progress value={75} data-testid="progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('sets aria-valuemin and aria-valuemax', () => {
    render(<Progress value={50} max={200} data-testid="progress" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '200');
  });

  it('shows label', () => {
    render(<Progress value={50} label="Upload progress" data-testid="progress" />);
    expect(screen.getByText('Upload progress')).toBeInTheDocument();
  });

  it('shows percentage', () => {
    render(<Progress value={75} showPercentage data-testid="progress" />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows label and percentage together', () => {
    render(
      <Progress value={60} label="Loading" showPercentage data-testid="progress" />,
    );
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('clamps value above max', () => {
    render(<Progress value={150} max={100} showPercentage data-testid="progress" />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps negative value', () => {
    render(<Progress value={-10} showPercentage data-testid="progress" />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders indeterminate', () => {
    render(<Progress indeterminate data-testid="progress" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-busy', 'true');
    expect(bar).not.toHaveAttribute('aria-valuenow');
  });

  it('sets aria-label', () => {
    render(<Progress value={50} label="Custom label" data-testid="progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Custom label');
  });

  it('applies custom className', () => {
    render(<Progress value={50} className="custom" data-testid="progress" />);
    expect(screen.getByTestId('progress')).toHaveAttribute('class');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Progress value={50} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
