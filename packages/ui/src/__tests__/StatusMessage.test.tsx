import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusMessage } from '../components/StatusMessage';

describe('StatusMessage', () => {
  it('renders children', () => {
    render(<StatusMessage data-testid="msg">Operation complete</StatusMessage>);
    expect(screen.getByText('Operation complete')).toBeInTheDocument();
  });

  it('renders neutral variant by default', () => {
    render(<StatusMessage data-testid="msg">Content</StatusMessage>);
    expect(screen.getByTestId('msg').className).toContain('text-text-secondary');
  });

  it('renders success variant', () => {
    render(<StatusMessage variant="success" data-testid="msg">Content</StatusMessage>);
    expect(screen.getByTestId('msg').className).toContain('text-success');
  });

  it('renders warning variant', () => {
    render(<StatusMessage variant="warning" data-testid="msg">Content</StatusMessage>);
    expect(screen.getByTestId('msg').className).toContain('text-warning');
  });

  it('renders error variant with role alert', () => {
    render(<StatusMessage variant="error" data-testid="msg">Content</StatusMessage>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders info variant', () => {
    render(<StatusMessage variant="info" data-testid="msg">Content</StatusMessage>);
    expect(screen.getByTestId('msg').className).toContain('text-info');
  });

  it('renders block layout', () => {
    render(<StatusMessage layout="block" data-testid="msg">Content</StatusMessage>);
    expect(screen.getByTestId('msg').className).toContain('px-3');
  });

  it('renders custom icon', () => {
    render(
      <StatusMessage icon={<span data-testid="icon">X</span>} data-testid="msg">
        Content
      </StatusMessage>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders default success icon', () => {
    render(<StatusMessage variant="success" data-testid="msg">Done</StatusMessage>);
    const svg = screen.getByTestId('msg').querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<StatusMessage className="custom" data-testid="msg">Content</StatusMessage>);
    expect(screen.getByTestId('msg').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<StatusMessage ref={ref}>Content</StatusMessage>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('has aria-live polite for non-error', () => {
    render(<StatusMessage variant="success" data-testid="msg">Done</StatusMessage>);
    expect(screen.getByTestId('msg')).toHaveAttribute('aria-live', 'polite');
  });

  it('has aria-live assertive for error', () => {
    render(<StatusMessage variant="error" data-testid="msg">Failed</StatusMessage>);
    expect(screen.getByTestId('msg')).toHaveAttribute('aria-live', 'assertive');
  });
});
