import {
  buildAbroadAccommodationFromHotPath,
  buildPlanHotelByTierFromHotPath,
} from '@src/modules/travel-guide/domain/travel-guide-abroad-accommodation.util';
import { buildAbroadAccommodationMapPayload } from '@src/modules/travel-guide/domain/travel-guide-fallback.builder';

const edcThailand = {
  legacyId: 5,
  region: 'overseas',
  location: '普吉岛 Rhythm Park',
} as const;

describe('travel-guide-abroad-accommodation', () => {
  it('returns curated EDC Thailand hotels instead of generic venue labels', () => {
    const payload = buildAbroadAccommodationFromHotPath(
      edcThailand,
      'standard',
      2,
      3,
    );

    expect(payload.hotels.length).toBeGreaterThanOrEqual(2);
    expect(payload.accommodationSchemes?.length).toBeGreaterThanOrEqual(2);
    expect(
      payload.accommodationSchemes?.every(
        (scheme) => !/场馆周边酒店|市中心\/商圈酒店/.test(scheme.name),
      ),
    ).toBe(true);
    expect(
      payload.accommodationSchemes?.some((scheme) =>
        /Hilton|Pullman|Lub d|Novotel/i.test(scheme.name),
      ),
    ).toBe(true);
  });

  it('varies lead hotels across budget tiers', () => {
    const economy = buildAbroadAccommodationFromHotPath(
      edcThailand,
      'economy',
      2,
      3,
    );
    const comfort = buildAbroadAccommodationFromHotPath(
      edcThailand,
      'comfort',
      2,
      3,
    );

    expect(economy.accommodationSchemes?.[0]?.name).not.toBe(
      comfort.accommodationSchemes?.[0]?.name,
    );
  });

  it('buildAbroadAccommodationMapPayload prefers hot-path over generic fallback', () => {
    const payload = buildAbroadAccommodationMapPayload(
      {
        ...edcThailand,
        name: 'EDC Thailand 2026',
      } as import('../../../../src/database/schemas/activity.schema').Activity,
      'standard',
      2,
      3,
    );

    expect(payload.accommodationSchemes?.[0]?.name).toMatch(
      /Hilton|Pullman|Lub d|Novotel|Holiday Inn/i,
    );
  });

  it('builds hotelByTier for selected overseas budget tier only', () => {
    const hotelByTier = buildPlanHotelByTierFromHotPath(edcThailand, {
      accommodationNights: 3,
      headcount: 2,
      budgetTier: 'standard',
    });

    expect(hotelByTier?.standard?.hotels.length).toBeGreaterThan(0);
    expect(hotelByTier?.economy).toBeUndefined();
    expect(hotelByTier?.comfort).toBeUndefined();
    expect(hotelByTier?.standard?.hotels[0]?.name).toMatch(
      /Hilton|Pullman|Lub d|Novotel|Holiday Inn/i,
    );
  });
});
