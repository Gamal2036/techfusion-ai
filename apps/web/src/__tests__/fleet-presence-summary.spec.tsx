import React from 'react';
import { render, screen } from '@testing-library/react';
import { FleetPresenceSummary } from '@/components/command-center/FleetPresenceSummary';
import { PRESENCE_STATE_LABELS } from '@/lib/device-presence-state';

describe('FleetPresenceSummary', () => {
  it('renders all four presence bands with labels and counts', () => {
    render(
      <FleetPresenceSummary counts={{ ONLINE: 3, DEGRADED: 1, OFFLINE: 2, UNKNOWN: 0 }} />,
    );

    expect(screen.getByText(PRESENCE_STATE_LABELS.ONLINE)).toBeTruthy();
    expect(screen.getByText(PRESENCE_STATE_LABELS.DEGRADED)).toBeTruthy();
    expect(screen.getByText(PRESENCE_STATE_LABELS.OFFLINE)).toBeTruthy();
    expect(screen.getByText(PRESENCE_STATE_LABELS.UNKNOWN)).toBeTruthy();

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('defaults missing bands to zero', () => {
    render(<FleetPresenceSummary counts={{ ONLINE: 5 }} />);

    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getAllByText('0')).toHaveLength(3);
  });

  it('keeps colors in sync with the shared dot class map', () => {
    const { container } = render(
      <FleetPresenceSummary counts={{ ONLINE: 1, DEGRADED: 1, OFFLINE: 1, UNKNOWN: 1 }} />,
    );

    const dots = container.querySelectorAll('span[aria-hidden="true"]');
    expect(dots).toHaveLength(4);
    expect(dots[0].className).toContain('bg-success');
    expect(dots[1].className).toContain('bg-warning');
    expect(dots[2].className).toContain('bg-danger');
    expect(dots[3].className).toContain('bg-text-muted');
  });
});
