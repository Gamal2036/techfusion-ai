import {
  derivePresenceState,
  isPresenceReachable,
  DEVICE_PRESENCE_ONLINE_THRESHOLD_MS,
  DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS,
} from '../presence-state';

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

describe('worker presence state', () => {
  describe('derivePresenceState', () => {
    it('returns ONLINE while the device is within the online threshold', () => {
      expect(derivePresenceState(minutesAgo(5), new Date())).toBe('ONLINE');
      expect(derivePresenceState(minutesAgo(0), new Date())).toBe('ONLINE');
    });

    it('returns DEGRADED just past the online threshold', () => {
      const now = new Date();
      const lastSeen = new Date(now.getTime() - DEVICE_PRESENCE_ONLINE_THRESHOLD_MS - 1000);
      expect(derivePresenceState(lastSeen, now)).toBe('DEGRADED');
    });

    it('returns DEGRADED at the exact offline threshold boundary', () => {
      const now = new Date();
      const lastSeen = new Date(now.getTime() - DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS);
      expect(derivePresenceState(lastSeen, now)).toBe('DEGRADED');
    });

    it('returns OFFLINE just past the offline threshold', () => {
      const now = new Date();
      const lastSeen = new Date(now.getTime() - DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS - 1000);
      expect(derivePresenceState(lastSeen, now)).toBe('OFFLINE');
    });

    it('returns UNKNOWN for null, undefined, malformed and future timestamps', () => {
      expect(derivePresenceState(null, new Date())).toBe('UNKNOWN');
      expect(derivePresenceState(undefined, new Date())).toBe('UNKNOWN');
      expect(derivePresenceState('not-a-date', new Date())).toBe('UNKNOWN');
      expect(derivePresenceState(new Date(Date.now() + 60_000), new Date())).toBe('UNKNOWN');
    });

    it('accepts ISO string timestamps', () => {
      expect(derivePresenceState(minutesAgo(1).toISOString(), new Date())).toBe('ONLINE');
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
});
