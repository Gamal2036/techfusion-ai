import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Hero } from '@/components/landing/Hero';
import { Navbar } from '@/components/landing/Navbar';
import { DemoModal } from '@/components/landing/DemoModal';
import { HeroBackground } from '@/components/landing/HeroBackground';
import { ScrollIndicator } from '@/components/landing/ScrollIndicator';
import { SceneFallback } from '@/components/landing/hero3d/SceneFallback';
import {
  detectQualityTier,
  QUALITY_TIERS,
} from '@/components/landing/hero3d/config/hero3d.config';

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...filterDomProps(props)}>{children}</div>
    ),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...filterDomProps(props)}>{children}</span>
    ),
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p {...filterDomProps(props)}>{children}</p>
    ),
    section: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement>) => (
      <section {...filterDomProps(props)}>{children}</section>
    ),
    nav: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <nav {...filterDomProps(props)}>{children}</nav>
    ),
    header: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <header {...filterDomProps(props)}>{children}</header>
    ),
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...filterDomProps(props)}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
  const domProps: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (
      key === 'children' ||
      key === 'className' ||
      key === 'style' ||
      key === 'role' ||
      key.startsWith('aria-') ||
      key.startsWith('data-') ||
      key.startsWith('on') ||
      key === 'id' ||
      key === 'tabIndex' ||
      key === 'href' ||
      key === 'target' ||
      key === 'rel' ||
      key === 'type' ||
      key === 'name' ||
      key === 'value' ||
      key === 'placeholder' ||
      key === 'disabled' ||
      key === 'expanded' ||
      key === 'onClick' ||
      key === 'onKeyDown' ||
      key === 'ref'
    ) {
      domProps[key] = props[key];
    }
  }
  return domProps;
}

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('@/hooks/useMousePosition', () => ({
  useMousePosition: () => ({ x: 0, y: 0, normalX: 0, normalY: 0 }),
}));

jest.mock('@/components/landing/hero3d/Hero3DCanvas', () => ({
  Hero3DCanvas: () => <div data-testid="hero-3d-canvas" />,
}));

jest.mock('@/components/landing/hero3d/HeroMetrics3D', () => ({
  HeroMetrics3D: ({ tier }: { tier: string }) => (
    <div data-testid="hero-metrics-3d" data-tier={tier} />
  ),
}));

jest.mock('@techfusion/ui', () => ({
  Button: ({
    children,
    variant,
    size,
    className,
    ...props
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <button className={className} {...filterDomProps(props)}>
      {children}
    </button>
  ),
  cn: (...args: (string | boolean | undefined | null)[]) =>
    args.filter(Boolean).join(' '),
}));

describe('Landing Page - Hero', () => {
  it('renders without blocking content', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('displays the correct heading text', () => {
    render(<Hero />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(/AI.*That.*Understands.*Your.*Infrastructure/);
  });

  it('displays the Enterprise AI Platform badge', () => {
    render(<Hero />);
    expect(screen.getByText('Enterprise AI Platform')).toBeInTheDocument();
  });

  it('displays the subtitle', () => {
    render(<Hero />);
    expect(
      screen.getByText(/Unified device intelligence/),
    ).toBeInTheDocument();
  });

  it('has working CTA links', () => {
    render(<Hero />);
    const getStartedLink = screen.getByRole('link', { name: /get started/i });
    expect(getStartedLink).toHaveAttribute('href', '/signup');
  });

  it('renders the Watch Demo button', () => {
    render(<Hero />);
    expect(
      screen.getByRole('button', { name: /watch demo/i }),
    ).toBeInTheDocument();
  });

  it('opens demo modal when Watch Demo is clicked', async () => {
    const user = userEvent.setup();
    render(<Hero />);
    const demoButton = screen.getByRole('button', { name: /watch demo/i });
    await user.click(demoButton);
    expect(screen.getByRole('dialog', { name: /product demo/i })).toBeInTheDocument();
  });

  it('has the hero section with accessible aria-label', () => {
    render(<Hero />);
    expect(screen.getByRole('region', { name: /hero section/i })).toBeInTheDocument();
  });

  it('renders the 3D canvas component', () => {
    render(<Hero />);
    expect(screen.getByTestId('hero-3d-canvas')).toBeInTheDocument();
  });

  it('renders the metrics component', () => {
    render(<Hero />);
    expect(screen.getByTestId('hero-metrics-3d')).toBeInTheDocument();
  });

  it('has an aria-hidden canvas container', () => {
    render(<Hero />);
    const canvasContainer = screen.getByTestId('hero-3d-canvas');
    expect(canvasContainer.closest('[aria-hidden="true"]')).toBeInTheDocument();
  });
});

describe('Landing Page - DemoModal', () => {
  it('renders when open', () => {
    render(<DemoModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: /product demo/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<DemoModal isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<DemoModal isOpen={true} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has a close button', () => {
    render(<DemoModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByRole('button', { name: /close demo/i })).toBeInTheDocument();
  });

  it('has aria-modal attribute', () => {
    render(<DemoModal isOpen={true} onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('displays demo preview content', () => {
    render(<DemoModal isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('Real-time AI Dashboard')).toBeInTheDocument();
  });

  it('has a Get Started link in the footer', () => {
    render(<DemoModal isOpen={true} onClose={jest.fn()} />);
    const link = screen.getByRole('link', { name: /get started/i });
    expect(link).toHaveAttribute('href', '/signup');
  });
});

describe('Landing Page - HeroBackground', () => {
  it('renders background layers without errors', () => {
    const { container } = render(<HeroBackground />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('has aria-hidden on all background elements', () => {
    const { container } = render(<HeroBackground />);
    const ariaHiddenElements = container.querySelectorAll('[aria-hidden="true"]');
    expect(ariaHiddenElements.length).toBeGreaterThan(0);
  });
});

describe('Landing Page - ScrollIndicator', () => {
  it('renders the scroll indicator', () => {
    render(<ScrollIndicator />);
    expect(screen.getByText('Scroll')).toBeInTheDocument();
  });

  it('is hidden from screen readers', () => {
    const { container } = render(<ScrollIndicator />);
    const indicator = container.querySelector('[aria-hidden="true"]');
    expect(indicator).toBeInTheDocument();
  });
});

describe('Landing Page - SceneFallback', () => {
  it('renders the fallback visualization', () => {
    const { container } = render(<SceneFallback />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('is decorative and hidden', () => {
    const { container } = render(<SceneFallback />);
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).toBeInTheDocument();
  });
});

describe('Landing Page - Quality Tier Detection', () => {
  it('detects reduced motion tier', () => {
    expect(detectQualityTier(1440, true)).toBe('reduced');
  });

  it('detects low tier for small viewports', () => {
    expect(detectQualityTier(390, false)).toBe('low');
  });

  it('detects medium tier for tablet viewports', () => {
    expect(detectQualityTier(768, false)).toBe('medium');
  });

  it('detects high tier for desktop viewports', () => {
    expect(detectQualityTier(1440, false)).toBe('high');
  });

  it('has all quality tier configurations', () => {
    expect(QUALITY_TIERS).toHaveProperty('high');
    expect(QUALITY_TIERS).toHaveProperty('medium');
    expect(QUALITY_TIERS).toHaveProperty('low');
    expect(QUALITY_TIERS).toHaveProperty('reduced');
  });

  it('has correct DPR settings per tier', () => {
    expect(QUALITY_TIERS.high.dprMax).toBe(2);
    expect(QUALITY_TIERS.medium.dprMax).toBe(1.5);
    expect(QUALITY_TIERS.low.dprMax).toBe(1.2);
    expect(QUALITY_TIERS.reduced.dprMax).toBe(1);
  });

  it('reduced tier disables all animations', () => {
    const reduced = QUALITY_TIERS.reduced;
    expect(reduced.enablePostProcessing).toBe(false);
    expect(reduced.enableScanLines).toBe(false);
    expect(reduced.enableEnergyRings).toBe(false);
    expect(reduced.enableFormationParticles).toBe(false);
    expect(reduced.enableBackgroundParticles).toBe(false);
    expect(reduced.particleCount).toBe(0);
  });
});

describe('Landing Page - Navbar Links', () => {
  it('renders all navigation links', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /techfusion ai - home/i })).toHaveAttribute('href', '/');
    expect(screen.getByText('Home', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Features', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Solutions', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Pricing', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Documentation', { exact: true })).toBeInTheDocument();
  });

  it('has working Sign In and Get Started links', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/signup');
  });

  it('has proper aria-label on navigation', () => {
    const { container } = render(<Navbar />);
    const nav = container.querySelector('nav[aria-label="Main navigation"]');
    expect(nav).toBeInTheDocument();
  });

  it('has the logo with home link', () => {
    render(<Navbar />);
    const logo = screen.getByRole('link', { name: /techfusion ai - home/i });
    expect(logo).toHaveAttribute('href', '/');
  });
});
