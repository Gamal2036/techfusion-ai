import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../components/Pagination';

describe('Pagination', () => {
  it('renders nothing for zero pages', () => {
    const { container } = render(
      <Pagination currentPage={0} totalPages={0} onPageChange={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders pagination for multiple pages', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />,
    );
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Page 5')).toBeInTheDocument();
  });

  it('calls onPageChange on page click', () => {
    const onPageChange = jest.fn();
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByLabelText('Page 3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous on first page', () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />,
    );
    expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
  });

  it('disables next on last page', () => {
    render(
      <Pagination currentPage={5} totalPages={5} onPageChange={jest.fn()} />,
    );
    expect(screen.getByLabelText('Go to next page')).toBeDisabled();
  });

  it('shows ellipsis for large page counts', () => {
    render(
      <Pagination currentPage={5} totalPages={20} onPageChange={jest.fn()} />,
    );
    expect(screen.getAllByText('More pages').length).toBeGreaterThanOrEqual(1);
  });

  it('marks current page with aria-current', () => {
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={jest.fn()} />,
    );
    expect(screen.getByLabelText('Page 3')).toHaveAttribute('aria-current', 'page');
  });

  it('calls onPageChange for previous/next', () => {
    const onPageChange = jest.fn();
    render(
      <Pagination currentPage={3} totalPages={5} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByLabelText('Go to previous page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('works with compact mode', () => {
    render(
      <Pagination currentPage={1} totalPages={10} onPageChange={jest.fn()} compact />,
    );
    expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
  });
});
