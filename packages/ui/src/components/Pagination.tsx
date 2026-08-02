'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';

export interface PaginationProps extends React.ComponentPropsWithoutRef<'nav'> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  compact?: boolean;
  siblingCount?: number;
}

function generatePagination(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): (number | 'ellipsis')[] {
  const totalNumbers = siblingCount * 2 + 5;

  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftEllipsis = leftSiblingIndex > 2;
  const shouldShowRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!shouldShowLeftEllipsis && shouldShowRightEllipsis) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, 'ellipsis', totalPages];
  }

  if (shouldShowLeftEllipsis && !shouldShowRightEllipsis) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1,
    );
    return [1, 'ellipsis', ...rightRange];
  }

  if (shouldShowLeftEllipsis && shouldShowRightEllipsis) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i,
    );
    return [1, 'ellipsis', ...middleRange, 'ellipsis', totalPages];
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  (
    {
      className,
      currentPage,
      totalPages,
      onPageChange,
      compact = false,
      siblingCount = 1,
      ...props
    },
    ref,
  ) => {
    const pages = generatePagination(currentPage, totalPages, siblingCount);
    const isFirstPage = currentPage <= 1;
    const isLastPage = currentPage >= totalPages;

    if (totalPages <= 0) return null;

    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label="Pagination"
        className={cn('flex items-center justify-center', className)}
        {...props}
      >
        <ul className="flex flex-row items-center gap-1">
          {!compact && (
            <li>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={isFirstPage}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </li>
          )}

          {pages.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <li key={`ellipsis-${index}`}>
                  <span
                    className="flex h-9 w-9 items-center justify-center"
                    aria-hidden="true"
                  >
                    <MoreHorizontal className="h-4 w-4 text-text-muted" />
                  </span>
                  <span className="sr-only">More pages</span>
                </li>
              );
            }

            return (
              <li key={page}>
                <Button
                  variant={page === currentPage ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                >
                  {page}
                </Button>
              </li>
            );
          })}

          {!compact && (
            <li>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={isLastPage}
                aria-label="Go to next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </li>
          )}

          {compact && (
            <li>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={isFirstPage}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </li>
          )}

          {compact && (
            <li>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={isLastPage}
                aria-label="Go to next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </li>
          )}
        </ul>
      </nav>
    );
  },
);
Pagination.displayName = 'Pagination';

export { Pagination };
