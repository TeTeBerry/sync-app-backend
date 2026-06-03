import {
  buildLightApplyInitialMessage,
  formatLightApplyBody,
  lightApplyToBuddyPreview,
  normalizeLightApplyInput,
} from '@src/modules/partner/light-apply.util';

describe('light-apply.util', () => {
  it('normalizes light apply fields', () => {
    expect(
      normalizeLightApplyInput({
        departureCity: ' 广州 ',
        tripDays: 2,
        genderPref: '女生优先',
      }),
    ).toEqual({
      departureCity: '广州',
      tripDays: 2,
      genderPref: '女生优先',
    });
  });

  it('builds initial message with optional note', () => {
    const fields = normalizeLightApplyInput({
      departureCity: '上海',
      tripDays: 3,
      genderPref: '不限',
    })!;
    expect(buildLightApplyInitialMessage(fields, '可以一起拼房')).toBe(
      '从上海出发，活动 3 天；补充：可以一起拼房',
    );
  });

  it('maps to buddy preview', () => {
    const preview = lightApplyToBuddyPreview({
      departureCity: '深圳',
      genderPref: '男生优先',
    });
    expect(preview.body).toBe(
      formatLightApplyBody({
        departureCity: '深圳',
        genderPref: '男生优先',
      }),
    );
    expect(preview.location).toBe('深圳');
    expect(preview.tags).toEqual(['#组队']);
  });
});
