import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonCircle,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonTableRow,
} from '../components/Skeleton';

describe('Skeleton', () => {
  it('renders with aria-hidden', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies animate-pulse by default', () => {
    render(<Skeleton data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton').className).toContain('animate-pulse');
  });

  it('does not animate in static variant', () => {
    render(<Skeleton variant="static" data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton').className).not.toContain('animate-pulse');
  });

  it('applies width and height as strings', () => {
    render(<Skeleton width="200px" height="40px" data-testid="skeleton" />);
    const el = screen.getByTestId('skeleton');
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('40px');
  });

  it('applies width and height as numbers', () => {
    render(<Skeleton width={200} height={40} data-testid="skeleton" />);
    const el = screen.getByTestId('skeleton');
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('40px');
  });

  it('applies custom className', () => {
    render(<Skeleton className="custom-class" data-testid="skeleton" />);
    expect(screen.getByTestId('skeleton').className).toContain('custom-class');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Skeleton ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('SkeletonText', () => {
  it('renders 3 lines by default', () => {
    render(<SkeletonText data-testid="skeleton-text" />);
    const container = screen.getByTestId('skeleton-text');
    expect(container.children.length).toBe(3);
  });

  it('renders custom number of lines', () => {
    render(<SkeletonText lines={5} data-testid="skeleton-text" />);
    expect(screen.getByTestId('skeleton-text').children.length).toBe(5);
  });

  it('applies custom className', () => {
    render(<SkeletonText className="custom" data-testid="skeleton-text" />);
    expect(screen.getByTestId('skeleton-text').className).toContain('custom');
  });
});

describe('SkeletonTitle', () => {
  it('renders', () => {
    render(<SkeletonTitle data-testid="skeleton-title" />);
    expect(screen.getByTestId('skeleton-title')).toBeInTheDocument();
  });
});

describe('SkeletonCircle', () => {
  it('renders with default size', () => {
    render(<SkeletonCircle data-testid="skeleton-circle" />);
    const el = screen.getByTestId('skeleton-circle');
    expect(el.style.width).toBe('40px');
    expect(el.style.height).toBe('40px');
  });

  it('renders with custom size', () => {
    render(<SkeletonCircle size={64} data-testid="skeleton-circle" />);
    const el = screen.getByTestId('skeleton-circle');
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('64px');
  });
});

describe('SkeletonAvatar', () => {
  it('renders', () => {
    render(<SkeletonAvatar data-testid="skeleton-avatar" />);
    expect(screen.getByTestId('skeleton-avatar')).toBeInTheDocument();
  });
});

describe('SkeletonButton', () => {
  it('renders', () => {
    render(<SkeletonButton data-testid="skeleton-btn" />);
    expect(screen.getByTestId('skeleton-btn')).toBeInTheDocument();
  });
});

describe('SkeletonCard', () => {
  it('renders', () => {
    render(<SkeletonCard data-testid="skeleton-card" />);
    expect(screen.getByTestId('skeleton-card')).toBeInTheDocument();
  });
});

describe('SkeletonTableRow', () => {
  it('renders 4 columns by default', () => {
    render(<SkeletonTableRow data-testid="skeleton-row" />);
    const row = screen.getByTestId('skeleton-row');
    expect(row.children.length).toBe(4);
  });

  it('renders custom number of columns', () => {
    render(<SkeletonTableRow columns={6} data-testid="skeleton-row" />);
    expect(screen.getByTestId('skeleton-row').children.length).toBe(6);
  });
});
