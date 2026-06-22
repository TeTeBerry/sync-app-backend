import {
  appendDevProfileStormActivity,
  buildDevProfileStormActivityItem,
  DEV_PROFILE_STORM_LEGACY_ID,
  isDevProfileStormEnabled,
  shouldInjectDevProfileStorm,
} from '@src/modules/profile/utils/dev-profile-storm-activity.util';

describe('dev-profile-storm-activity.util', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDisable = process.env.DISABLE_DEV_PROFILE_STORM;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDisable === undefined) {
      delete process.env.DISABLE_DEV_PROFILE_STORM;
    } else {
      process.env.DISABLE_DEV_PROFILE_STORM = originalDisable;
    }
  });

  it('is enabled only outside production when not explicitly disabled', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DISABLE_DEV_PROFILE_STORM;
    expect(isDevProfileStormEnabled()).toBe(true);

    process.env.DISABLE_DEV_PROFILE_STORM = 'true';
    expect(isDevProfileStormEnabled()).toBe(false);

    process.env.NODE_ENV = 'production';
    delete process.env.DISABLE_DEV_PROFILE_STORM;
    expect(isDevProfileStormEnabled()).toBe(false);
  });

  it('injects storm when dev enabled and user has not registered storm', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DISABLE_DEV_PROFILE_STORM;

    expect(shouldInjectDevProfileStorm([1, 2])).toBe(true);
    expect(shouldInjectDevProfileStorm([DEV_PROFILE_STORM_LEGACY_ID])).toBe(
      false,
    );
  });

  it('builds storm profile activity item from catalog record', () => {
    const item = buildDevProfileStormActivityItem({
      legacyId: DEV_PROFILE_STORM_LEGACY_ID,
      code: 'storm',
      name: '风暴电音节 深圳站 2026',
      date: '06/13-14',
      location: '深圳国际会展中心',
      image: 'static/activity/storm.webp',
    } as never);

    expect(item).toEqual({
      id: '4',
      title: '风暴电音节 深圳站 2026',
      date: '06/13-14',
      location: '深圳国际会展中心',
      image: 'static/activity/storm.webp',
      status: 'attended',
      activityLegacyId: '4',
    });
  });

  it('appends storm to activity list in dev when missing', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DISABLE_DEV_PROFILE_STORM;

    const existing = [
      {
        id: '1',
        title: 'Tomorrowland',
        date: '07/18-20',
        location: '泰国',
        image: 'tml.jpg',
        status: 'registered' as const,
        activityLegacyId: '1',
      },
    ];

    const result = appendDevProfileStormActivity(
      existing,
      {
        legacyId: DEV_PROFILE_STORM_LEGACY_ID,
        code: 'storm',
        name: '风暴电音节 深圳站 2026',
        date: '06/13-14',
        location: '深圳国际会展中心',
        image: 'static/activity/storm.webp',
      } as never,
      [1],
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.title).toBe('Tomorrowland');
    expect(result[1]?.title).toBe('风暴电音节 深圳站 2026');
  });
});
