import {
  canViewPersonalInfo,
  normalizePrivacyLevel,
} from '@src/common/utils/privacy.util';

describe('privacy.util', () => {
  describe('normalizePrivacyLevel', () => {
    it('maps legacy friends to private', () => {
      expect(normalizePrivacyLevel('friends')).toBe('private');
      expect(normalizePrivacyLevel('private')).toBe('private');
      expect(normalizePrivacyLevel('public')).toBe('public');
    });
  });

  describe('canViewPersonalInfo', () => {
    it('always allows owner', () => {
      expect(canViewPersonalInfo('private', true, false)).toBe(true);
    });

    it('respects public and private', () => {
      expect(canViewPersonalInfo('public', false, false)).toBe(true);
      expect(canViewPersonalInfo('private', false, false)).toBe(false);
      expect(canViewPersonalInfo('friends', false, true)).toBe(false);
      expect(canViewPersonalInfo('friends', false, false)).toBe(false);
    });
  });
});
