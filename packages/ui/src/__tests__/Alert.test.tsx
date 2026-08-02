import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Alert } from '../components/Alert';

describe('Alert', () => {
  it('renders with role alert', () => {
    render(<Alert data-testid="alert">Test content</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders info variant by default', () => {
    render(<Alert data-testid="alert">Content</Alert>);
    const alert = screen.getByTestId('alert');
    expect(alert.className).toContain('border-info');
  });

  it('renders success variant', () => {
    render(<Alert variant="success" data-testid="alert">Content</Alert>);
    const alert = screen.getByTestId('alert');
    expect(alert.className).toContain('border-success');
  });

  it('renders warning variant', () => {
    render(<Alert variant="warning" data-testid="alert">Content</Alert>);
    const alert = screen.getByTestId('alert');
    expect(alert.className).toContain('border-warning');
  });

  it('renders danger variant', () => {
    render(<Alert variant="danger" data-testid="alert">Content</Alert>);
    const alert = screen.getByTestId('alert');
    expect(alert.className).toContain('border-danger');
  });

  it('renders title', () => {
    render(<Alert title="Test Title" data-testid="alert" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<Alert description="Test Description" data-testid="alert" />);
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <Alert icon={<span data-testid="icon">Icon</span>} data-testid="alert">
        Content
      </Alert>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders action slot', () => {
    render(
      <Alert action={<button data-testid="action">Action</button>} data-testid="alert">
        Content
      </Alert>,
    );
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('renders dismiss button when dismissible', () => {
    const onDismiss = jest.fn();
    render(<Alert dismissible onDismiss={onDismiss} data-testid="alert" />);
    expect(screen.getByLabelText('Dismiss alert')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss is clicked', () => {
    const onDismiss = jest.fn();
    render(<Alert dismissible onDismiss={onDismiss} data-testid="alert" />);
    fireEvent.click(screen.getByLabelText('Dismiss alert'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not render dismiss button when not dismissible', () => {
    render(<Alert data-testid="alert">Content</Alert>);
    expect(screen.queryByLabelText('Dismiss alert')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Alert className="custom-class" data-testid="alert">Content</Alert>);
    expect(screen.getByTestId('alert').className).toContain('custom-class');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<Alert ref={ref}>Content</Alert>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
