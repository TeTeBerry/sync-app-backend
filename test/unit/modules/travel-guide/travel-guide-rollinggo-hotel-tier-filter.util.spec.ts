import { filterRollingGoHotelsForBudgetTier } from '@src/modules/travel-guide/domain/travel-guide-rollinggo-hotel-tier.util';

describe('filterRollingGoHotelsForBudgetTier', () => {
  const hotels = [
    { name: 'Budget', minPrice: 240, starRating: 2.5 },
    { name: 'Business', minPrice: 520, starRating: 4 },
    { name: 'Luxury', minPrice: 1100, starRating: 5 },
  ];

  it('splits hotels by star band', () => {
    expect(
      filterRollingGoHotelsForBudgetTier(hotels, 'economy').map((h) => h.name),
    ).toEqual(expect.arrayContaining(['Budget']));
    expect(
      filterRollingGoHotelsForBudgetTier(hotels, 'standard').map((h) => h.name),
    ).toEqual(expect.arrayContaining(['Business']));
    expect(
      filterRollingGoHotelsForBudgetTier(hotels, 'comfort').map((h) => h.name),
    ).toEqual(expect.arrayContaining(['Luxury']));
  });
});
