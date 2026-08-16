import {
  normalizeRecoveryCode,
  isValidRecoveryCode,
  normalizeTotp,
  isValidTotp,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_GROUPS,
  RECOVERY_CODE_GROUP_LENGTH,
  RECOVERY_CODE_ALPHABET,
} from '@/lib/mfa-client';

describe('MFA client normalization helpers (mirror backend recovery-codes.util.ts)', () => {
  describe('normalizeRecoveryCode', () => {
    it('strips separators and uppercases input', () => {
      expect(normalizeRecoveryCode('abcd-efgh-ijkl-mnop')).toBe('ABCDEFGHIJKLMNOP');
      expect(normalizeRecoveryCode('a b c d  1 2 3 4')).toBe('ABCD1234');
    });

    it('handles mixed case', () => {
      expect(normalizeRecoveryCode('aBcD-eFgH')).toBe('ABCDEFGH');
    });
  });

  describe('isValidRecoveryCode', () => {
    it('accepts exactly 16 chars from the canonical alphabet', () => {
      expect(isValidRecoveryCode('ABCD-EFGH-IJKL-MNOP')).toBe(true);
      expect(isValidRecoveryCode('QRST-UVWX-YZ23-4567')).toBe(true);
    });

    it('rejects wrong lengths', () => {
      expect(isValidRecoveryCode('ABCDEFGH')).toBe(false);
      expect(isValidRecoveryCode('ABCD-EFGH-IJKL-MNOP-XXXX')).toBe(false);
    });

    it('rejects digits outside the base32 alphabet', () => {
      expect(isValidRecoveryCode('1111-1111-1111-1111')).toBe(false);
      expect(isValidRecoveryCode('0000-0000-0000-0000')).toBe(false);
    });

    it('rejects characters outside A-Z and 2-7', () => {
      expect(isValidRecoveryCode('AB!D-EFGH-IJKL-MNOP')).toBe(false);
      expect(isValidRecoveryCode('ABCD-EFGH-IJKL-MNO8')).toBe(false);
    });

    it('rejects empty input', () => {
      expect(isValidRecoveryCode('')).toBe(false);
    });
  });

  describe('normalizeTotp', () => {
    it('strips non-digits and truncates to 6', () => {
      expect(normalizeTotp('123456')).toBe('123456');
      expect(normalizeTotp('12-34-56')).toBe('123456');
      expect(normalizeTotp('123456789')).toBe('123456');
      expect(normalizeTotp('abc123')).toBe('123');
    });

    it('returns empty string when no digits', () => {
      expect(normalizeTotp('abc')).toBe('');
    });
  });

  describe('isValidTotp', () => {
    it('accepts exactly six digits', () => {
      expect(isValidTotp('123456')).toBe(true);
    });

    it('rejects wrong lengths and non-digits', () => {
      expect(isValidTotp('12345')).toBe(false);
      expect(isValidTotp('1234567')).toBe(false);
      expect(isValidTotp('abcdef')).toBe(false);
      expect(isValidTotp('')).toBe(false);
    });
  });

  describe('recovery-code constants', () => {
    it('are consistent with the backend spec', () => {
      expect(RECOVERY_CODE_COUNT).toBe(10);
      expect(RECOVERY_CODE_GROUPS).toBe(4);
      expect(RECOVERY_CODE_GROUP_LENGTH).toBe(4);
      expect(RECOVERY_CODE_ALPHABET).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567');
    });
  });
});
