import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Breadcrumbs,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '../components/Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders nav with aria-label', () => {
    render(
      <Breadcrumbs>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumbs>,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('renders ordered list', () => {
    render(
      <Breadcrumbs>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumbs>,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('marks current page with aria-current', () => {
    render(
      <Breadcrumbs>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Current Page</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumbs>,
    );
    const currentPage = screen.getByText('Current Page');
    expect(currentPage).toHaveAttribute('aria-current', 'page');
  });

  it('renders custom separator', () => {
    render(
      <Breadcrumbs>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>Page</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumbs>,
    );
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('renders ellipsis', () => {
    render(
      <Breadcrumbs>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbEllipsis />
          <BreadcrumbItem>
            <BreadcrumbPage>Page</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumbs>,
    );
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('renders links', () => {
    render(
      <Breadcrumbs>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumbs>,
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link).toHaveAttribute('href', '/');
  });
});
