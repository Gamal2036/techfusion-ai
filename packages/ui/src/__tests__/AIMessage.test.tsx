import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { AIMessage } from '../components/AIMessage';

describe('AIMessage', () => {
  it('renders user message', () => {
    render(<AIMessage role="user" content="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders assistant message', () => {
    render(<AIMessage role="assistant" content="Hi there" />);
    expect(screen.getByText('Hi there')).toBeInTheDocument();
  });

  it('renders system message', () => {
    render(<AIMessage role="system" content="System update" />);
    expect(screen.getByText('System update')).toBeInTheDocument();
  });

  it('renders tool message', () => {
    render(<AIMessage role="tool" content="Tool output" />);
    expect(screen.getByText('Tool output')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<AIMessage role="error" content="Something failed" />);
    expect(screen.getByText('Something failed')).toBeInTheDocument();
  });

  it('renders author', () => {
    render(<AIMessage role="user" content="Hi" author="John" />);
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('shows default role label when author provided', () => {
    render(<AIMessage role="assistant" content="Hi" author="AI Assistant" />);
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('renders timestamp', () => {
    render(<AIMessage role="user" content="Hi" timestamp="2:30 PM" />);
    expect(screen.getByText('2:30 PM')).toBeInTheDocument();
  });

  it('renders model label', () => {
    render(<AIMessage role="assistant" content="Hi" modelLabel="GPT-4" />);
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  it('renders actions', () => {
    render(
      <AIMessage
        role="assistant"
        content="Hi"
        actions={<button data-testid="action">Action</button>}
      />,
    );
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('renders copy action', () => {
    render(
      <AIMessage
        role="assistant"
        content="Hi"
        copyAction={<button data-testid="copy">Copy</button>}
      />,
    );
    expect(screen.getByTestId('copy')).toBeInTheDocument();
  });

  it('renders retry action', () => {
    render(
      <AIMessage
        role="assistant"
        content="Hi"
        retryAction={<button data-testid="retry">Retry</button>}
      />,
    );
    expect(screen.getByTestId('retry')).toBeInTheDocument();
  });

  it('renders citations slot', () => {
    render(
      <AIMessage
        role="assistant"
        content="Hi"
        citationsSlot={<div data-testid="citations">Sources</div>}
      />,
    );
    expect(screen.getByTestId('citations')).toBeInTheDocument();
  });

  it('renders attachments slot', () => {
    render(
      <AIMessage
        role="assistant"
        content="Hi"
        attachmentsSlot={<div data-testid="attachments">Files</div>}
      />,
    );
    expect(screen.getByTestId('attachments')).toBeInTheDocument();
  });

  it('renders metadata slot', () => {
    render(
      <AIMessage
        role="assistant"
        content="Hi"
        metadataSlot={<div data-testid="meta">Info</div>}
      />,
    );
    expect(screen.getByTestId('meta')).toBeInTheDocument();
  });

  it('renders streaming indicator', () => {
    render(<AIMessage role="assistant" content="Hi" streaming />);
    expect(screen.getByLabelText('Generating response')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<AIMessage role="assistant" loading data-testid="msg" />);
    expect(screen.getByTestId('msg').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders avatar', () => {
    render(
      <AIMessage
        role="assistant"
        content="Hi"
        avatar={<span data-testid="avatar">A</span>}
      />,
    );
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
  });

  it('applies data-role attribute', () => {
    render(<AIMessage role="user" content="Hi" data-testid="msg" />);
    expect(screen.getByTestId('msg')).toHaveAttribute('data-role', 'user');
  });

  it('applies bubble variant', () => {
    render(<AIMessage role="user" content="Hi" variant="bubble" data-testid="msg" />);
    expect(screen.getByTestId('msg')).toHaveAttribute('data-variant', 'bubble');
  });

  it('applies panel variant', () => {
    render(<AIMessage role="assistant" content="Hi" variant="panel" data-testid="msg" />);
    expect(screen.getByTestId('msg')).toHaveAttribute('data-variant', 'panel');
  });

  it('applies minimal variant', () => {
    render(<AIMessage role="system" content="Info" variant="minimal" data-testid="msg" />);
    expect(screen.getByTestId('msg')).toHaveAttribute('data-variant', 'minimal');
  });

  it('renders ReactNode content', () => {
    render(
      <AIMessage
        role="assistant"
        content={<strong data-testid="bold">Bold text</strong>}
      />,
    );
    expect(screen.getByTestId('bold')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<AIMessage role="user" content="Hi" className="custom" data-testid="msg" />);
    expect(screen.getByTestId('msg').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<AIMessage role="user" content="Hi" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
