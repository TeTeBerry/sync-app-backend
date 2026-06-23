import { applyTravelGuideAccommodationPreference } from '../../../../src/modules/travel-guide/domain/travel-guide-accommodation-preference.util';
import type { TravelGuidePlan } from '../../../../src/modules/travel-guide/domain/travel-guide.types';
import { isFuzzyTravelGuideParamsMatch } from '../../../../src/modules/travel-guide/domain/travel-guide-generation-cache.util';

const basePlan: TravelGuidePlan = {
  activityName: 'Storm',
  venue: '深圳',
  eventDates: '06/13',
  departure: '深圳',
  headcount: 2,
  budgetLabel: '舒适',
  accommodationNights: 2,
  selfDrive: false,
  transport: { title: '交通', lines: ['地铁'] },
  accommodation: {
    title: '住宿推荐',
    hotels: [{ name: '酒店A', note: 'n' }],
    schemes: [
      {
        label: '就近方案',
        name: '酒店A',
        note: 'n',
        reason: 'r',
      },
    ],
  },
  nightlife: { title: '散场', spots: [{ name: '夜宵', note: 'n' }] },
  tips: { title: '提示', items: ['tip'] },
  budget: {
    title: '预算',
    items: [
      { label: '门票', range: '约 ¥800' },
      { label: '住宿', range: '约 ¥900' },
      { label: '合计参考（全员）', range: '约 ¥2000' },
    ],
  },
};

describe('applyTravelGuideAccommodationPreference', () => {
  it('strips hotels and hotel budget when nights are zero', () => {
    const next = applyTravelGuideAccommodationPreference(basePlan, 0);
    expect(next.accommodationNights).toBe(0);
    expect(next.accommodation.hotels).toEqual([]);
    expect(next.accommodation.schemes).toBeUndefined();
    expect(next.budget?.items.map((item) => item.label)).not.toContain('住宿');
  });

  it('keeps accommodation when nights are positive', () => {
    const next = applyTravelGuideAccommodationPreference(basePlan, 2);
    expect(next.accommodation.hotels).toHaveLength(1);
    expect(next.budget?.items.map((item) => item.label)).toContain('住宿');
  });
});

describe('isFuzzyTravelGuideParamsMatch accommodation', () => {
  const base = {
    activityLegacyId: 4,
    departure: '上海',
    departureCity: '',
    headcount: 2,
    budgetTier: 'standard' as const,
    selfDrive: false,
    accommodationNights: 2,
  };

  it('does not fuzzy-match zero nights with positive nights', () => {
    expect(
      isFuzzyTravelGuideParamsMatch(
        { ...base, accommodationNights: 0 },
        { ...base, accommodationNights: 1 },
      ),
    ).toBe(false);
    expect(
      isFuzzyTravelGuideParamsMatch(
        { ...base, accommodationNights: 0 },
        { ...base, accommodationNights: 2 },
      ),
    ).toBe(false);
  });
});
