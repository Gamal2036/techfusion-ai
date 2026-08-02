import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptCard } from '../components/PromptCard';

describe('PromptCard', () => {
  it('renders title', () => {
    render(<PromptCard title="Analyze Device" />);
    expect(screen.getByText('Analyze Device')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<PromptCard title="Analyze" description="Run diagnostics" />);
    expect(screen.getByText('Run diagnostics')).toBeInTheDocument();
  });

  it('renders category', () => {
    render(<PromptCard title="Analyze" category="Diagnostics" />);
    expect(screen.getByText('Diagnostics')).toBeInTheDocument();
  });

  it('renders icon', () => {
    render(
      <PromptCard
        title="Analyze"
        icon={<span data-testid="icon">🔍</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders as button when action is provided', () => {
    render(<PromptCard title="Analyze" action={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls action on click', () => {
    const action = jest.fn();
    render(<PromptCard title="Analyze" action={action} />);
    fireEvent.click(screen.getByRole('button'));
    expect(action).toHaveBeenCalled();
  });

  it('calls action on Enter key', () => {
    const action = jest.fn();
    render(<PromptCard title="Analyze" action={action} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(action).toHaveBeenCalled();
  });

  it('calls action on Space key', () => {
    const action = jest.fn();
    render(<PromptCard title="Analyze" action={action} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(action).toHaveBeenCalled();
  });

  it('applies disabled state', () => {
    render(<PromptCard title="Analyze" action={() => {}} disabled data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-disabled', 'true');
    expect(screen.getByTestId('card').className).toContain('opacity-50');
  });

  it('does not call action when disabled', () => {
    const action = jest.fn();
    render(<PromptCard title="Analyze" action={action} disabled data-testid="card" />);
    fireEvent.click(screen.getByTestId('card'));
    expect(action).not.toHaveBeenCalled();
  });

  it('applies selected state', () => {
    render(<PromptCard title="Analyze" action={() => {}} selected data-testid="card" />);
    expect(screen.getByTestId('card')).toHaveAttribute('data-selected', 'true');
  });

  it('applies loading state', () => {
    render(<PromptCard title="Analyze" loading data-testid="card" />);
    expect(screen.getByTestId('card').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('applies variant default', () => {
    render(<PromptCard title="Analyze" variant="default" data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('bg-card');
  });

  it('applies variant subtle', () => {
    render(<PromptCard title="Analyze" variant="subtle" data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('bg-surface-subtle');
  });

  it('applies variant outline', () => {
    render(<PromptCard title="Analyze" variant="outline" data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('bg-transparent');
  });

  it('applies compact mode', () => {
    render(<PromptCard title="Analyze" compact data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('p-3');
  });

  it('does not have role button without action', () => {
    render(<PromptCard title="Analyze" data-testid="card" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<PromptCard title="Analyze" className="custom" data-testid="card" />);
    expect(screen.getByTestId('card').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<PromptCard title="Analyze" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
