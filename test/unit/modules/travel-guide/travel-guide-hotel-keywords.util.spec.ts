import { hotelSearchKeywordsForBudgetTier } from '../../../../src/modules/travel-guide/map/travel-guide-hotel-keywords.util';

describe('hotelSearchKeywordsForBudgetTier', () => {
  it('uses economy keywords for budget tier', () => {
    expect(hotelSearchKeywordsForBudgetTier('economy')).toEqual([
      '快捷酒店',
      '经济型酒店',
    ]);
  });

  it('uses business keywords for standard tier', () => {
    expect(hotelSearchKeywordsForBudgetTier('standard')).toEqual([
      '商务酒店',
      '酒店',
    ]);
  });

  it('uses luxury keywords for comfort tier', () => {
    expect(hotelSearchKeywordsForBudgetTier('comfort')).toEqual([
      '五星级酒店',
      '豪华酒店',
    ]);
  });

  it('uses abroad economy keywords for overseas budget tier', () => {
    expect(
      hotelSearchKeywordsForBudgetTier('economy', { abroad: true }),
    ).toEqual(['hostel', 'guesthouse']);
  });
});
