import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { OperationalState } from '@/components/command-center/OperationalState';

jest.mock('@techfusion/ui', () => ({
  GlassPanel: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

describe('OperationalState', () => {
  it('announces the label plus reasons in a polite live region', () => {
    render(
      <OperationalState
        status="ATTENTION"
        reasons={['3 alerts need attention', '2 open findings']}
        generatedAt="2026-08-02T12:00:00.000Z"
        stale={false}
      />,
    );

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Attention')).toBeInTheDocument();
    expect(screen.getByText('3 alerts need attention · 2 open findings')).toBeInTheDocument();
  });

  it('renders a stale note without changing the last confirmed state', () => {
    render(
      <OperationalState
        status="OPERATIONAL"
        reasons={['All monitored systems are operating normally.']}
        generatedAt="2026-08-02T12:00:00.000Z"
        stale={true}
      />,
    );

    expect(screen.getByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('stale')).toBeInTheDocument();
    expect(screen.getByText('All monitored systems are operating normally.')).toBeInTheDocument();
  });

  it('maps a fetch failure to UNKNOWN without a fake state', () => {
    render(
      <OperationalState
        status="UNKNOWN"
        reasons={[]}
        generatedAt={null}
        stale={false}
      />,
    );

    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.getByText('Summary is temporarily unavailable. Try again in a moment.')).toBeInTheDocument();
    expect(screen.queryByText('Operational')).toBeNull();
  });

  it('never renders only color to convey state: label text is always present', () => {
    render(
      <OperationalState
        status="CRITICAL"
        reasons={['1 critical alert']}
        generatedAt="2026-08-02T12:00:00.000Z"
        stale={false}
      />,
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('1 critical alert')).toBeInTheDocument();
  });
});
