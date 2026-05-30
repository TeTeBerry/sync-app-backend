import {
  isMockProfileUser,
  MOCK_PROFILE_SEED_ACTIVITY_LEGACY_ID,
  MOCK_PROFILE_SEED_USER_ID,
  resolveProfilePackageOwnerId,
} from '@src/modules/profile/domain/mock-profile-user.util';
import { DEMO_OWNER_USER_ID } from '@src/common/utils/demo-owner.util';

describe('mock-profile-user.util', () => {
  it('recognizes demo owner user id', () => {
    expect(isMockProfileUser(DEMO_OWNER_USER_ID, undefined)).toBe(true);
  });

  it('recognizes Zara author names', () => {
    expect(isMockProfileUser(undefined, 'Zara')).toBe(true);
    expect(isMockProfileUser(undefined, 'Zara Chen')).toBe(true);
  });

  it('defaults to mock when no identity is provided', () => {
    expect(isMockProfileUser(undefined, undefined)).toBe(true);
  });

  it('exports seed constants for pro demo', () => {
    expect(MOCK_PROFILE_SEED_USER_ID).toBe(DEMO_OWNER_USER_ID);
    expect(MOCK_PROFILE_SEED_ACTIVITY_LEGACY_ID).toBe(4);
  });

  it('maps Zara author name to demo-zara for package entitlements', () => {
    expect(
      resolveProfilePackageOwnerId('random-session-id', 'Zara Chen'),
    ).toBe(DEMO_OWNER_USER_ID);
    expect(resolveProfilePackageOwnerId(undefined, 'Zara')).toBe(
      DEMO_OWNER_USER_ID,
    );
  });

  it('keeps non-mock user ids unchanged', () => {
    expect(resolveProfilePackageOwnerId('user-abc', 'Alex')).toBe('user-abc');
  });
});
