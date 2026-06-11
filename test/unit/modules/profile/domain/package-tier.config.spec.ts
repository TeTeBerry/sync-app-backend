import {
  getPackageTierDefinition,
  listPackageTierDefinitions,
  PROFILE_PACKAGE_TIERS,
} from '@src/modules/profile/domain/package-tier.config';

describe('package-tier.config', () => {
  it('defines pro, pro_plus, ultra with expected limits', () => {
    expect(PROFILE_PACKAGE_TIERS.map((t) => t.id)).toEqual([
      'pro',
      'pro_plus',
      'ultra',
    ]);

    expect(getPackageTierDefinition('pro').limits).toMatchObject({
      contactUnlockCount: 5,
      mapDays: 7,
      postPinCount: 0,
      basicExposure: true,
    });

    expect(getPackageTierDefinition('pro_plus').limits).toMatchObject({
      contactUnlockCount: 12,
      mapDays: 15,
      postPinCount: 1,
      basicExposure: false,
    });

    expect(getPackageTierDefinition('ultra').limits).toMatchObject({
      contactUnlockCount: null,
      mapDays: 30,
      postPinCount: 2,
      basicExposure: false,
    });
  });

  it('returns defensive copies from listPackageTierDefinitions', () => {
    const tiers = listPackageTierDefinitions();
    tiers[0].limits.contactUnlockCount = 999;
    expect(getPackageTierDefinition('pro').limits.contactUnlockCount).toBe(5);
  });
});
