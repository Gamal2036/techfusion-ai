import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../components/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<EmptyState title="Title" description="Get started by creating one" />);
    expect(screen.getByText('Get started by creating one')).toBeInTheDocument();
  });

  it('renders with role status', () => {
    render(<EmptyState title="Title" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <EmptyState
        title="Title"
        icon={<span data-testid="icon">Icon</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders illustration', () => {
    render(
      <EmptyState
        title="Title"
        illustration={<div data-testid="illustration">Art</div>}
      />,
    );
    expect(screen.getByTestId('illustration')).toBeInTheDocument();
  });

  it('renders primary action', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        title="Title"
        primaryAction={{ label: 'Create', onClick }}
      />,
    );
    const btn = screen.getByText('Create');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders secondary action', () => {
    const onClick = jest.fn();
    render(
      <EmptyState
        title="Title"
        secondaryAction={{ label: 'Learn more', onClick }}
      />,
    );
    const btn = screen.getByText('Learn more');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders both actions', () => {
    render(
      <EmptyState
        title="Title"
        primaryAction={{ label: 'Create', onClick: jest.fn() }}
        secondaryAction={{ label: 'Cancel', onClick: jest.fn() }}
      />,
    );
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('applies compact mode', () => {
    render(<EmptyState title="Title" compact data-testid="empty" />);
    expect(screen.getByTestId('empty').className).toContain('py-8');
  });

  it('applies custom className', () => {
    render(<EmptyState title="Title" className="custom" data-testid="empty" />);
    expect(screen.getByTestId('empty').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<EmptyState title="Title" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
