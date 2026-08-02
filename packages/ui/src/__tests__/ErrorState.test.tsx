import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from '../components/ErrorState';

describe('ErrorState', () => {
  it('renders with role alert', () => {
    render(<ErrorState data-testid="error" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders default title', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ErrorState title="Connection failed" />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<ErrorState description="Check your network" />);
    expect(screen.getByText('Check your network')).toBeInTheDocument();
  });

  it('renders custom icon', () => {
    render(
      <ErrorState icon={<span data-testid="icon">Icon</span>} />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders retry action', () => {
    const onClick = jest.fn();
    render(<ErrorState retryAction={{ onClick }} />);
    const btn = screen.getByText('Try Again');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders custom retry label', () => {
    render(<ErrorState retryAction={{ label: 'Reload', onClick: jest.fn() }} />);
    expect(screen.getByText('Reload')).toBeInTheDocument();
  });

  it('renders secondary action', () => {
    const onClick = jest.fn();
    render(
      <ErrorState
        retryAction={{ onClick: jest.fn() }}
        secondaryAction={{ label: 'Go back', onClick }}
      />,
    );
    const btn = screen.getByText('Go back');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders technical details', () => {
    render(<ErrorState details={<span>Error code: 500</span>} />);
    expect(screen.getByText('Technical details')).toBeInTheDocument();
    expect(screen.getByText('Error code: 500')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ErrorState className="custom" data-testid="error" />);
    expect(screen.getByTestId('error').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<ErrorState ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
