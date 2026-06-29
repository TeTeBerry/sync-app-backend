import {
  mapSyncBudgetTierToRollingGoHotelGrade,
  rollingGoHotelGradeStarRatings,
} from '@src/modules/travel-guide/domain/travel-guide-rollinggo-hotel-tier.util';

describe('travel-guide-rollinggo-hotel-tier.util', () => {
  it('maps SYNC tiers to RollingGo grades one-to-one', () => {
    expect(mapSyncBudgetTierToRollingGoHotelGrade('economy')).toBe('economy');
    expect(mapSyncBudgetTierToRollingGoHotelGrade('standard')).toBe('comfort');
    expect(mapSyncBudgetTierToRollingGoHotelGrade('comfort')).toBe('luxury');
  });

  it('uses RollingGo grade star bands for hotel search', () => {
    expect(rollingGoHotelGradeStarRatings('economy')).toEqual([2.0, 3.0]);
    expect(rollingGoHotelGradeStarRatings('comfort')).toEqual([3.0, 4.0]);
    expect(rollingGoHotelGradeStarRatings('upscale')).toEqual([4.0, 4.5]);
    expect(rollingGoHotelGradeStarRatings('luxury')).toEqual([4.5, 5.0]);
  });

  it('maps SYNC tier to RollingGo star bands', () => {
    expect(
      rollingGoHotelGradeStarRatings(
        mapSyncBudgetTierToRollingGoHotelGrade('economy'),
      ),
    ).toEqual([2.0, 3.0]);
    expect(
      rollingGoHotelGradeStarRatings(
        mapSyncBudgetTierToRollingGoHotelGrade('standard'),
      ),
    ).toEqual([3.0, 4.0]);
    expect(
      rollingGoHotelGradeStarRatings(
        mapSyncBudgetTierToRollingGoHotelGrade('comfort'),
      ),
    ).toEqual([4.5, 5.0]);
  });
});
