import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '../components/Tooltip';
import { Citation } from '../components/Citation';

function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('Citation', () => {
  it('renders title', () => {
    renderWithProviders(<Citation variant="card" title="Knowledge Base Article" />);
    expect(screen.getByText('Knowledge Base Article')).toBeInTheDocument();
  });

  it('renders source', () => {
    renderWithProviders(<Citation variant="card" source="Internal docs" />);
    expect(screen.getByText('Internal docs')).toBeInTheDocument();
  });

  it('renders excerpt', () => {
    renderWithProviders(<Citation variant="card" excerpt="This is a summary..." />);
    expect(screen.getByText('This is a summary...')).toBeInTheDocument();
  });

  it('renders index', () => {
    renderWithProviders(<Citation variant="card" index={1} title="Source" />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders string index', () => {
    renderWithProviders(<Citation variant="card" index="A" title="Source" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders confidence', () => {
    renderWithProviders(<Citation variant="card" confidence={0.95} title="Source" />);
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('renders timestamp', () => {
    renderWithProviders(<Citation variant="card" timestamp="2 hours ago" title="Source" />);
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('renders href link', () => {
    renderWithProviders(
      <Citation
        variant="card"
        title="Source"
        href="https://example.com"
      />,
    );
    const link = screen.getByText('Open source');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders inline variant', () => {
    renderWithProviders(<Citation variant="inline" index={1} title="Source" />);
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('renders inline variant with href', () => {
    renderWithProviders(
      <Citation
        variant="inline"
        index={1}
        title="Source"
        href="https://example.com"
      />,
    );
    const link = screen.getByText('[1]');
    expect(link.closest('a')).toHaveAttribute('href', 'https://example.com');
  });

  it('renders compact variant', () => {
    renderWithProviders(<Citation variant="compact" index={1} title="Source" />);
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('renders icon', () => {
    renderWithProviders(
      <Citation
        variant="card"
        title="Source"
        icon={<span data-testid="icon">📄</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    renderWithProviders(<Citation variant="card" loading data-testid="citation" />);
    expect(screen.getByTestId('citation').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWithProviders(<Citation variant="card" title="Source" className="custom" data-testid="citation" />);
    expect(screen.getByTestId('citation').className).toContain('custom');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLDivElement>();
    renderWithProviders(<Citation variant="card" title="Source" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
