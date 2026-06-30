import { travelGuideFormToRecruitSearchQuery } from '../../../../src/modules/travel-guide/domain/travel-guide-recruit-search-query.util';

describe('travelGuideFormToRecruitSearchQuery', () => {
  it('builds a Chinese search query from guide form slots', () => {
    const query = travelGuideFormToRecruitSearchQuery(
      {
        departure: '上海',
        headcount: 3,
        budgetTier: 'standard',
        accommodationNights: 2,
      },
      '2026-07-18',
    );

    expect(query).toContain('上海出发');
    expect(query).toContain('07/18');
    expect(query).toContain('还差2个名额');
    expect(query).toContain('舒适');
  });

  it('omits empty departure and date segments', () => {
    const query = travelGuideFormToRecruitSearchQuery(
      {
        departure: '',
        headcount: 1,
        budgetTier: 'economy',
        accommodationNights: 0,
      },
      '',
    );

    expect(query).toBe('还差1个名额 · 经济(¥150-300/晚)');
  });
});
