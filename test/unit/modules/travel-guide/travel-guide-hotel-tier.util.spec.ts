import {
  applyHotelTierAccommodationToPlan,
  buildPlanHotelByTierFromQuotes,
} from '@src/modules/travel-guide/domain/travel-guide-hotel-tier.util';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

function basePlan(): TravelGuidePlan {
  return {
    activityName: 'Test',
    venue: 'Tokyo',
    eventDates: '07/04',
    departure: '昆明',
    headcount: 2,
    budgetLabel: '舒适',
    accommodationNights: 3,
    selfDrive: false,
    transport: { title: '交通', lines: [] },
    accommodation: {
      title: '住宿',
      hotels: [{ name: 'Old Hotel', note: 'old' }],
    },
    nightlife: { title: '夜生活', spots: [] },
    tips: { title: '提示', items: [] },
  };
}

describe('travel-guide-hotel-tier.util', () => {
  it('buildPlanHotelByTierFromQuotes maps recommendations per tier', () => {
    const hotelByTier = buildPlanHotelByTierFromQuotes(
      {
        economy: {
          minPricePerNight: 300,
          maxPricePerNight: 400,
          currency: 'CNY',
          sampleCount: 2,
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
          recommendations: [{ name: 'Economy Hotel', minPricePerNight: 320 }],
        },
        comfort: {
          minPricePerNight: 900,
          maxPricePerNight: 1200,
          currency: 'CNY',
          sampleCount: 2,
          fetchedAt: '2026-06-29T00:00:00.000Z',
          source: 'rollinggo',
          recommendations: [{ name: 'Luxury Hotel', minPricePerNight: 980 }],
        },
      },
      { accommodationNights: 3, headcount: 2 },
    );

    expect(hotelByTier?.economy?.hotels[0]?.name).toBe('Economy Hotel');
    expect(hotelByTier?.comfort?.hotels[0]?.name).toBe('Luxury Hotel');
  });

  it('applyHotelTierAccommodationToPlan swaps visible hotel list', () => {
    const plan = applyHotelTierAccommodationToPlan(
      {
        ...basePlan(),
        hotelByTier: {
          comfort: {
            hotels: [{ name: 'Luxury Hotel', note: 'luxury' }],
            schemes: [
              {
                label: '场馆周边',
                name: 'Luxury Hotel',
                note: 'luxury',
                reason: 'test',
              },
            ],
          },
        },
      },
      'comfort',
    );

    expect(plan.accommodation.hotels[0]?.name).toBe('Luxury Hotel');
    expect(plan.accommodation.schemes?.[0]?.name).toBe('Luxury Hotel');
  });
});
