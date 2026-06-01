import {
  parseActivityLegacyIdHeader,
  parseActivityLegacyIdQuery,
  resolveEffectiveActivityLegacyId,
} from '@src/common/activity/activity-context.util';

describe('activity-context.util', () => {
  it('parses X-Activity-Id header', () => {
    expect(parseActivityLegacyIdHeader({ 'x-activity-id': '9' })).toBe(9);
    expect(parseActivityLegacyIdHeader({})).toBeUndefined();
  });

  it('parses activityLegacyId query', () => {
    expect(parseActivityLegacyIdQuery('4')).toBe(4);
    expect(parseActivityLegacyIdQuery('')).toBeUndefined();
  });

  it('resolves first valid legacy id in order', () => {
    expect(resolveEffectiveActivityLegacyId(undefined, 9, 4)).toBe(9);
    expect(resolveEffectiveActivityLegacyId(undefined, NaN, 4)).toBe(4);
  });
});
