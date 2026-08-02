import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '../components/DropdownMenu';

function DropdownTest() {
  const [checked, setChecked] = React.useState(false);
  const [radioValue, setRadioValue] = React.useState('a');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem destructive>Delete</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={checked}
          onCheckedChange={setChecked}
        >
          Show details
        </DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup value={radioValue} onValueChange={setRadioValue}>
          <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>More options</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Sub item</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DropdownWithDisabled() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Enabled</DropdownMenuItem>
        <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('renders trigger', () => {
    render(<DropdownTest />);
    expect(screen.getByText('Open menu')).toBeInTheDocument();
  });

  it('trigger has aria-haspopup attribute', () => {
    render(<DropdownTest />);
    const trigger = screen.getByText('Open menu');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('trigger starts closed', () => {
    render(<DropdownTest />);
    const trigger = screen.getByText('Open menu');
    expect(trigger).toHaveAttribute('data-state', 'closed');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders menu component parts', () => {
    render(<DropdownTest />);
    const trigger = screen.getByText('Open menu');
    expect(trigger).toBeInTheDocument();
    expect(trigger.tagName).toBe('BUTTON');
  });

  it('renders disabled trigger attribute', () => {
    render(<DropdownWithDisabled />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Open').tagName).toBe('BUTTON');
  });

  it('supports asChild prop', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span data-testid="custom-trigger">Custom</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
  });
});
