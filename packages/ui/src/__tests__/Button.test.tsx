import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/Button';

const Link = React.forwardRef<HTMLAnchorElement, any>(
  ({ href, children, ...props }, ref) => (
    <a ref={ref} href={href} {...props}>
      {children}
    </a>
  ),
);
Link.displayName = 'Link';

describe('Button', () => {
  it('renders a default <button> with variant classes', () => {
    render(
      <Button variant="outline" size="sm">
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveClass('inline-flex', 'border');
    expect(button).not.toBeDisabled();
  });

  it('renders without throwing when asChild slots onto a link', () => {
    render(
      <Button variant="outline" size="sm" asChild>
        <Link href="/settings">Manage</Link>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Manage' });
    expect(link).toHaveAttribute('href', '/settings');
    expect(link).toHaveClass('inline-flex', 'border');
  });

  it('supports an asChild child containing an icon and text', () => {
    render(
      <Button asChild>
        <Link href="/settings">
          <svg data-testid="gear-icon" />
          Manage organization
        </Link>
      </Button>,
    );
    const link = screen.getByRole('link', { name: /manage organization/i });
    expect(link).toContainElement(screen.getByTestId('gear-icon'));
    expect(link).toHaveTextContent('Manage organization');
  });

  it('keeps leftIcon and rightIcon inside the asChild multi-child Slot composition', () => {
    render(
      <Button
        asChild
        leftIcon={<svg data-testid="left-icon" />}
        rightIcon={<svg data-testid="right-icon" />}
      >
        <Link href="/settings">Manage</Link>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Manage' });
    expect(link).toContainElement(screen.getByTestId('left-icon'));
    expect(link).toContainElement(screen.getByTestId('right-icon'));
  });

  it('forwards refs and event handlers through asChild', () => {
    const ref = React.createRef<HTMLAnchorElement>();
    const onClick = jest.fn();
    render(
      <Button asChild ref={ref as any} onClick={onClick}>
        <Link href="/settings">Manage</Link>
      </Button>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Manage' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ref.current?.getAttribute('href')).toBe('/settings');
  });

  it('shows the loading spinner, disables the button, and prefers loadingText', () => {
    render(
      <Button loading loadingText="Saving...">
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).toBeInTheDocument();
    expect(button).toHaveTextContent('Saving...');
    expect(button).not.toHaveTextContent('Save');
  });

  it('renders leftIcon before children and rightIcon after children', () => {
    render(
      <Button leftIcon={<svg data-testid="left-icon" />} rightIcon={<svg data-testid="right-icon" />}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: /save/i });
    const left = screen.getByTestId('left-icon');
    const right = screen.getByTestId('right-icon');
    const nodes = Array.from(button.childNodes);
    expect(button).toContainElement(left);
    expect(button).toContainElement(right);
    expect(nodes[0]).toContainElement(left);
    expect(nodes[nodes.length - 1]).toContainElement(right);
  });
});
