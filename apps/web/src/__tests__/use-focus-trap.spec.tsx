import '@testing-library/jest-dom';
import React from 'react';
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

function TrapFixture() {
  const [open, setOpen] = useState(false);
  const ref = useFocusTrap(open);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      {open && (
        <div ref={ref}>
          <button type="button">First</button>
          <button type="button" onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable on open and wraps tab order at both boundaries', () => {
    render(<TrapFixture />);
    fireEvent.click(screen.getByText('Open'));
    act(() => {});

    expect(document.activeElement).toHaveTextContent('First');

    const first = screen.getByText('First') as HTMLElement;
    const close = screen.getByText('Close') as HTMLElement;

    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toHaveTextContent('First');

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toHaveTextContent('Close');
  });

  it('pulls focus back in when tabbing starts outside the trap', () => {
    render(<TrapFixture />);
    fireEvent.click(screen.getByText('Open'));
    act(() => {});

    const first = screen.getByText('First') as HTMLElement;
    document.body.focus();
    fireEvent.keyDown(first, { key: 'Tab' });
    expect(document.activeElement).toHaveTextContent('First');
  });

  it('restores focus to the trigger when the trap closes', () => {
    render(<TrapFixture />);
    const openButton = screen.getByText('Open') as HTMLElement;
    openButton.focus();
    fireEvent.click(openButton);
    act(() => {});

    expect(document.activeElement).toHaveTextContent('First');

    fireEvent.click(screen.getByText('Close'));
    act(() => {});

    expect(document.activeElement).toBe(openButton);
  });
});
