import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '../components/ContextMenu';

if (typeof DOMRect === 'undefined') {
  (global as any).DOMRect = class DOMRect {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    top = 0;
    right = 0;
    bottom = 0;
    left = 0;
    toJSON() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
    static fromRect(rect?: { x?: number; y?: number; width?: number; height?: number }) {
      return new DOMRect(rect?.x ?? 0, rect?.y ?? 0, rect?.width ?? 0, rect?.height ?? 0);
    }
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.right = x + width;
      this.bottom = y + height;
      this.left = x;
    }
  };
}

function ContextMenuTest() {
  return (
    <ContextMenu>
      <ContextMenuTrigger>Right click here</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Actions</ContextMenuLabel>
        <ContextMenuItem>Edit</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

describe('ContextMenu', () => {
  it('renders trigger', () => {
    render(<ContextMenuTest />);
    expect(screen.getByText('Right click here')).toBeInTheDocument();
  });

  it('opens on right click', async () => {
    render(<ContextMenuTest />);
    const trigger = screen.getByText('Right click here');
    fireEvent.contextMenu(trigger, { button: 2, bubbles: true });
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  it('renders items when open', async () => {
    render(<ContextMenuTest />);
    fireEvent.contextMenu(screen.getByText('Right click here'), { button: 2, bubbles: true });
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  it('renders disabled item', async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Trigger</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem disabled>Disabled</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );
    fireEvent.contextMenu(screen.getByText('Trigger'), { button: 2, bubbles: true });
    await waitFor(() => {
      const item = screen.getByText('Disabled');
      expect(item).toHaveAttribute('data-disabled', '');
    });
  });
});
