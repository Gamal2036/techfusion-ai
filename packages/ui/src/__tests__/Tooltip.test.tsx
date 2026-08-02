import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../components/Tooltip';

function TooltipTest() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe('Tooltip', () => {
  it('renders trigger', () => {
    render(<TooltipTest />);
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('has accessible trigger', () => {
    render(<TooltipTest />);
    const trigger = screen.getByText('Hover me');
    expect(trigger).toBeInTheDocument();
  });

  it('provides provider context', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent>Content</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText('Trigger')).toBeInTheDocument();
  });
});
