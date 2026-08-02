import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Popover, PopoverTrigger, PopoverContent } from '../components/Popover';

function PopoverTest({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger>Open popover</PopoverTrigger>
      <PopoverContent>Popover content</PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('renders trigger', () => {
    render(<PopoverTest />);
    expect(screen.getByText('Open popover')).toBeInTheDocument();
  });

  it('opens controlled popover', () => {
    render(<PopoverTest open={true} />);
    expect(screen.getByText('Popover content')).toBeInTheDocument();
  });

  it('closes controlled popover', () => {
    const { rerender } = render(<PopoverTest open={true} />);
    expect(screen.getByText('Popover content')).toBeInTheDocument();

    rerender(<PopoverTest open={false} />);
    expect(screen.queryByText('Popover content')).not.toBeInTheDocument();
  });

  it('calls onOpenChange', () => {
    const onOpenChange = jest.fn();
    render(<PopoverTest open={true} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Popover content')).toBeInTheDocument();
  });
});
