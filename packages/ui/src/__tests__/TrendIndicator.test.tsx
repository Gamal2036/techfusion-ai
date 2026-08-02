import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { TrendIndicator } from '../components/TrendIndicator';

describe('TrendIndicator', () => {
  it('renders up direction', () => {
    render(<TrendIndicator direction="up" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('data-direction', 'up');
  });

  it('renders down direction', () => {
    render(<TrendIndicator direction="down" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('data-direction', 'down');
  });

  it('renders neutral direction', () => {
    render(<TrendIndicator direction="neutral" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('data-direction', 'neutral');
  });

  it('renders value', () => {
    render(<TrendIndicator direction="up" value="+5%" data-testid="trend" />);
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  it('renders label as accessible text', () => {
    render(<TrendIndicator direction="up" label="Increasing" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('aria-label', 'Increasing');
  });

  it('renders label with value in aria-label', () => {
    render(<TrendIndicator direction="up" value="+5%" label="Increasing" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('aria-label', 'Increasing: +5%');
  });

  it('uses default label based on direction', () => {
    render(<TrendIndicator direction="up" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('aria-label', 'Increasing');
  });

  it('applies positive tone for up direction', () => {
    render(<TrendIndicator direction="up" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('data-tone', 'positive');
  });

  it('applies negative tone for down direction', () => {
    render(<TrendIndicator direction="down" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('data-tone', 'negative');
  });

  it('applies inverse meaning for up direction', () => {
    render(<TrendIndicator direction="up" inverseMeaning data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('data-tone', 'negative');
  });

  it('applies inverse meaning for down direction', () => {
    render(<TrendIndicator direction="down" inverseMeaning data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('data-tone', 'positive');
  });

  it('applies explicit positive tone', () => {
    render(<TrendIndicator direction="down" tone="positive" data-testid="trend" />);
    expect(screen.getByTestId('trend')).toHaveAttribute('data-tone', 'positive');
  });

  it('applies badge layout', () => {
    render(<TrendIndicator direction="up" layout="badge" data-testid="trend" />);
    expect(screen.getByTestId('trend').className).toContain('rounded-full');
  });

  it('applies compact layout', () => {
    render(<TrendIndicator direction="up" layout="compact" data-testid="trend" />);
    expect(screen.getByTestId('trend').className).toContain('rounded-md');
  });

  it('applies custom className', () => {
    render(<TrendIndicator direction="up" className="custom" data-testid="trend" />);
    expect(screen.getByTestId('trend').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<TrendIndicator direction="up" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
