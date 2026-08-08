import {
  DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS,
  PresenceState,
  PRESENCE_STATE_LABELS,
  derivePresenceState,
  isPresenceReachable,
} from '@/lib/device-presence-state';
import { DEVICE_ONLINE_THRESHOLD_MS } from '@/lib/device-presence';

describe('Device Presence State (frontend)', () => {
  describe('DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS', () => {
    it('is 15 minutes (900,000 ms) matching the backend', () => {
      expect(DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS).toBe(15 * 60 * 1000);
      expect(DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS).toBe(900_000);
    });
  });

  describe('derivePresenceState', () => {
    const now = new Date('2026-08-06T12:00:00.000Z');

    it('returns ONLINE for a device seen within the online threshold', () => {
      expect(derivePresenceState(new Date(now.getTime() - 60_000), now)).toBe('ONLINE');
    });

    it('returns ONLINE at the exact online threshold boundary', () => {
      expect(derivePresenceState(new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS), now)).toBe('ONLINE');
    });

    it('returns DEGRADED just past the online threshold', () => {
      expect(derivePresenceState(new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS - 1), now)).toBe('DEGRADED');
    });

    it('returns DEGRADED at the exact offline threshold boundary', () => {
      expect(derivePresenceState(new Date(now.getTime() - DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS), now)).toBe('DEGRADED');
    });

    it('returns OFFLINE just past the offline threshold', () => {
      expect(derivePresenceState(new Date(now.getTime() - DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS - 1), now)).toBe('OFFLINE');
    });

    it('returns UNKNOWN for null/undefined/malformed/future timestamps', () => {
      expect(derivePresenceState(null, now)).toBe('UNKNOWN');
      expect(derivePresenceState(undefined, now)).toBe('UNKNOWN');
      expect(derivePresenceState('', now)).toBe('UNKNOWN');
      expect(derivePresenceState('not-a-date', now)).toBe('UNKNOWN');
      expect(derivePresenceState(new Date(now.getTime() + 60_000), now)).toBe('UNKNOWN');
    });

    it('accepts ISO string timestamps', () => {
      expect(derivePresenceState(new Date(now.getTime() - 30_000).toISOString(), now)).toBe('ONLINE');
    });

    it('uses current time when now is omitted', () => {
      expect(derivePresenceState(new Date(Date.now() - 1000).toISOString())).toBe('ONLINE');
    });
  });

  describe('isPresenceReachable', () => {
    it('ONLINE and DEGRADED are reachable; OFFLINE and UNKNOWN are not', () => {
      expect(isPresenceReachable('ONLINE')).toBe(true);
      expect(isPresenceReachable('DEGRADED')).toBe(true);
      expect(isPresenceReachable('OFFLINE')).toBe(false);
      expect(isPresenceReachable('UNKNOWN')).toBe(false);
    });
  });

  it('exposes a label for every presence state', () => {
    const states: PresenceState[] = ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN'];
    for (const state of states) {
      expect(PRESENCE_STATE_LABELS[state]).toBeTruthy();
    }
  });
});
