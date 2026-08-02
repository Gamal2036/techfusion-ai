import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { Avatar, AvatarImage, AvatarFallback, getInitials } from '../components/Avatar';

describe('Avatar', () => {
  it('renders fallback when no image', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders AvatarImage component', () => {
    render(
      <Avatar>
        <AvatarImage src="/avatar.jpg" alt="User avatar" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('applies size classes to root', () => {
    const { container, rerender } = render(
      <Avatar size="sm" data-testid="avatar">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>,
    );
    const avatar = container.querySelector('[data-testid="avatar"]');
    expect(avatar).toHaveClass('h-8');

    rerender(
      <Avatar size="lg" data-testid="avatar">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>,
    );
    const avatarLg = container.querySelector('[data-testid="avatar"]');
    expect(avatarLg).toHaveClass('h-12');
  });

  it('applies shape classes', () => {
    const { container } = render(
      <Avatar shape="rounded" data-testid="avatar">
        <AvatarFallback>RD</AvatarFallback>
      </Avatar>,
    );
    const avatar = container.querySelector('[data-testid="avatar"]');
    expect(avatar).toHaveClass('rounded-lg');
  });

  it('generates initials correctly', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Alice')).toBe('A');
    expect(getInitials('Bob Smith Jr')).toBe('BJ');
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(
      <Avatar ref={ref}>
        <AvatarFallback>T</AvatarFallback>
      </Avatar>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('applies border classes', () => {
    const { container } = render(
      <Avatar data-testid="avatar">
        <AvatarFallback>T</AvatarFallback>
      </Avatar>,
    );
    const avatar = container.querySelector('[data-testid="avatar"]');
    expect(avatar).toHaveClass('border-border');
  });
});
