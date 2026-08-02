import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { AvatarGroup } from '../components/AvatarGroup';

describe('AvatarGroup', () => {
  const items = [
    { name: 'Alice Smith', src: '/alice.jpg' },
    { name: 'Bob Jones', src: '/bob.jpg' },
    { name: 'Carol White' },
    { name: 'Dan Brown', src: '/dan.jpg' },
    { name: 'Eve Black', src: '/eve.jpg' },
    { name: 'Frank Green' },
  ];

  it('renders avatar group', () => {
    render(<AvatarGroup items={items} />);
    expect(screen.getByRole('group')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<AvatarGroup items={items} />);
    expect(screen.getByRole('group', { name: 'Group of 6 avatars' })).toBeInTheDocument();
  });

  it('limits visible items', () => {
    const { container } = render(<AvatarGroup items={items} max={3} />);
    const avatars = container.querySelectorAll('[class*="rounded-full"][class*="ring-2"]');
    expect(avatars.length).toBe(3);
  });

  it('shows overflow count', () => {
    render(<AvatarGroup items={items} max={3} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('shows all when max exceeds items', () => {
    const { container } = render(<AvatarGroup items={items} max={10} />);
    const avatars = container.querySelectorAll('[class*="rounded-full"][class*="ring-2"]');
    expect(avatars.length).toBe(6);
  });

  it('handles empty items', () => {
    render(<AvatarGroup items={[]} />);
    expect(screen.getByRole('group', { name: 'Group of 0 avatars' })).toBeInTheDocument();
  });

  it('renders single item', () => {
    render(<AvatarGroup items={[{ name: 'Only One' }]} />);
    expect(screen.getByText('OO')).toBeInTheDocument();
  });
});
