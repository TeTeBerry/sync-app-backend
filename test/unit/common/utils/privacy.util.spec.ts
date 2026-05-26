import { canViewPersonalInfo } from '@src/common/utils/privacy.util';

describe('canViewPersonalInfo', () => {
  it('always allows owner', () => {
    expect(canViewPersonalInfo('private', true, false)).toBe(true);
  });

  it('respects public, friends, and private', () => {
    expect(canViewPersonalInfo('public', false, false)).toBe(true);
    expect(canViewPersonalInfo('friends', false, true)).toBe(true);
    expect(canViewPersonalInfo('friends', false, false)).toBe(false);
    expect(canViewPersonalInfo('private', false, true)).toBe(false);
  });
});
