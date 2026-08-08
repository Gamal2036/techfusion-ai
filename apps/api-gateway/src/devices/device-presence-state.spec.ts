import {
  DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS,
  PresenceState,
  derivePresenceState,
  isPresenceReachable,
} from './device-presence-state';
import { DEVICE_ONLINE_THRESHOLD_MS } from './device-presence';

describe('Device Presence State (backend)', () => {
  describe('DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS', () => {
    it('is 15 minutes (900,000 ms)', () => {
      expect(DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS).toBe(15 * 60 * 1000);
    });
  });

  describe('derivePresenceState', () => {
    const now = new Date('2026-08-06T12:00:00.000Z');

    it('returns ONLINE for a device seen within the online threshold', () => {
      const lastSeenAt = new Date(now.getTime() - 60_000);
      expect(derivePresenceState(lastSeenAt, now)).toBe('ONLINE');
    });

    it('returns ONLINE at the exact online threshold boundary', () => {
      const lastSeenAt = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS);
      expect(derivePresenceState(lastSeenAt, now)).toBe('ONLINE');
    });

    it('returns DEGRADED just past the online threshold', () => {
      const lastSeenAt = new Date(now.getTime() - DEVICE_ONLINE_THRESHOLD_MS - 1);
      expect(derivePresenceState(lastSeenAt, now)).toBe('DEGRADED');
    });

    it('returns DEGRADED at the exact offline threshold boundary', () => {
      const lastSeenAt = new Date(now.getTime() - DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS);
      expect(derivePresenceState(lastSeenAt, now)).toBe('DEGRADED');
    });

    it('returns OFFLINE just past the offline threshold', () => {
      const lastSeenAt = new Date(now.getTime() - DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS - 1);
      expect(derivePresenceState(lastSeenAt, now)).toBe('OFFLINE');
    });

    it('returns UNKNOWN for null', () => {
      expect(derivePresenceState(null, now)).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for undefined', () => {
      expect(derivePresenceState(undefined, now)).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for malformed timestamps', () => {
      expect(derivePresenceState('not-a-date', now)).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for future timestamps', () => {
      const future = new Date(now.getTime() + 60_000);
      expect(derivePresenceState(future, now)).toBe('UNKNOWN');
    });

    it('accepts ISO string timestamps', () => {
      const lastSeenAt = new Date(now.getTime() - 30_000).toISOString();
      expect(derivePresenceState(lastSeenAt, now)).toBe('ONLINE');
    });

    it('uses current time when now is omitted', () => {
      const lastSeenAt = new Date(Date.now() - 1000).toISOString();
      expect(derivePresenceState(lastSeenAt)).toBe('ONLINE');
    });
  });

  describe('isPresenceReachable', () => {
    it('treats ONLINE as reachable', () => {
      expect(isPresenceReachable('ONLINE')).toBe(true);
    });

    it('treats DEGRADED as reachable', () => {
      expect(isPresenceReachable('DEGRADED')).toBe(true);
    });

    it('treats OFFLINE as unreachable', () => {
      expect(isPresenceReachable('OFFLINE')).toBe(false);
    });

    it('treats UNKNOWN as unreachable', () => {
      expect(isPresenceReachable('UNKNOWN')).toBe(false);
    });
  });

  it('presence states form the expected enum', () => {
    const states: PresenceState[] = ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN'];
    expect(states).toHaveLength(4);
  });
});
