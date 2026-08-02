import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { AIThinking } from '../components/AIThinking';

describe('AIThinking', () => {
  it('renders default thinking label', () => {
    render(<AIThinking />);
    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<AIThinking label="Processing" />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('renders searching status', () => {
    render(<AIThinking status="searching" />);
    expect(screen.getByText('Searching')).toBeInTheDocument();
  });

  it('renders analyzing status', () => {
    render(<AIThinking status="analyzing" />);
    expect(screen.getByText('Analyzing')).toBeInTheDocument();
  });

  it('renders generating status', () => {
    render(<AIThinking status="generating" />);
    expect(screen.getByText('Generating')).toBeInTheDocument();
  });

  it('renders finalizing status', () => {
    render(<AIThinking status="finalizing" />);
    expect(screen.getByText('Finalizing')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<AIThinking description="Looking up device data" />);
    expect(screen.getByText('Looking up device data')).toBeInTheDocument();
  });

  it('renders steps in expanded mode', () => {
    render(
      <AIThinking
        steps={['Reading data', 'Analyzing', 'Generating']}
        currentStep={1}
        expanded
      />,
    );
    expect(screen.getByText('Reading data')).toBeInTheDocument();
    expect(screen.getByText('Analyzing')).toBeInTheDocument();
    expect(screen.getByText('Generating')).toBeInTheDocument();
  });

  it('renders elapsed time', () => {
    render(<AIThinking elapsedTime="2.5s" />);
    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });

  it('renders cancel action', () => {
    render(
      <AIThinking
        cancelAction={<button data-testid="cancel">Cancel</button>}
      />,
    );
    expect(screen.getByTestId('cancel')).toBeInTheDocument();
  });

  it('has role status', () => {
    render(<AIThinking />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-live polite', () => {
    render(<AIThinking />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('has aria-label', () => {
    render(<AIThinking status="thinking" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Thinking');
  });

  it('applies dots layout', () => {
    render(<AIThinking layout="dots" data-testid="thinking" />);
    expect(screen.getByTestId('thinking')).toBeInTheDocument();
  });

  it('applies spinner layout', () => {
    render(<AIThinking layout="spinner" data-testid="thinking" />);
    expect(screen.getByTestId('thinking')).toBeInTheDocument();
  });

  it('applies pulse layout', () => {
    render(<AIThinking layout="pulse" data-testid="thinking" />);
    expect(screen.getByTestId('thinking')).toBeInTheDocument();
  });

  it('applies steps layout', () => {
    render(
      <AIThinking
        layout="steps"
        steps={['Step 1', 'Step 2']}
        currentStep={0}
        expanded
        data-testid="thinking"
      />,
    );
    expect(screen.getByTestId('thinking')).toBeInTheDocument();
  });

  it('applies compact mode', () => {
    render(<AIThinking compact data-testid="thinking" />);
    expect(screen.getByTestId('thinking').className).toContain('gap-2');
  });

  it('applies custom className', () => {
    render(<AIThinking className="custom" data-testid="thinking" />);
    expect(screen.getByTestId('thinking').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<AIThinking ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
