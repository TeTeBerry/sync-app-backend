import {
  applyFlightTierQuoteToPlan,
  buildPlanFlightByTier,
  normalizeFlightTierQuotesMonotonic,
} from '@src/modules/travel-guide/domain/travel-guide-flight-tier.util';
import type { FlightQuoteSnapshot } from '@src/modules/travel-guide/ports/travel-quote.types';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

function flightQuote(
  tier: 'economy' | 'standard' | 'comfort',
  min: number,
  max: number,
): FlightQuoteSnapshot {
  const cabinLabel =
    tier === 'economy'
      ? '经济舱'
      : tier === 'standard'
        ? '超级经济舱'
        : '公务舱';
  return {
    fromCityCode: 'PVG',
    toCityCode: 'ICN',
    outboundDate: '2026-07-01',
    returnDate: '2026-07-05',
    currency: 'CNY',
    minPricePerAdult: min,
    maxPricePerAdult: max,
    sampleLines: [],
    cabinLabel,
    fetchedAt: '2026-06-01T00:00:00.000Z',
    source: 'rollinggo',
  };
}

function basePlan(): TravelGuidePlan {
  return {
    activityName: 'Test',
    venue: 'Venue',
    eventDates: '2026-07-02',
    departure: '上海',
    headcount: 2,
    budgetLabel: '舒适',
    accommodationNights: 2,
    selfDrive: false,
    transport: {
      title: '交通',
      lines: ['国际航班参考'],
      flightOffers: [
        {
          pricePerAdult: 1800,
          currency: 'CNY',
          cabinLabel: '经济舱',
          outbound: {
            route: 'PVG→ICN',
            stopsLabel: '直飞',
          },
        },
      ],
    },
    accommodation: { title: '住宿', hotels: [] },
    nightlife: { title: '夜生活', spots: [] },
    tips: { title: '提示', items: [] },
    budget: {
      title: '预算',
      items: [
        {
          label: '机票 · PVG→ICN',
          range: '约 ¥3600–4000',
          note: '经济舱',
        },
        { label: '住宿', range: '约 ¥800' },
        { label: '合计参考（全员）', range: '约 ¥4400–4800' },
      ],
    },
    flightByTier: {
      economy: {
        cabinLabel: '经济舱',
        minPricePerAdult: 1800,
        maxPricePerAdult: 2000,
        currency: 'CNY',
        fromCityCode: 'PVG',
        toCityCode: 'ICN',
      },
      standard: {
        cabinLabel: '超级经济舱',
        minPricePerAdult: 2600,
        maxPricePerAdult: 2900,
        currency: 'CNY',
        fromCityCode: 'PVG',
        toCityCode: 'ICN',
        flightOffers: [
          {
            pricePerAdult: 2600,
            currency: 'CNY',
            cabinLabel: '超级经济舱',
            outbound: { route: 'PVG→ICN', stopsLabel: '直飞' },
          },
        ],
      },
      comfort: {
        cabinLabel: '公务舱',
        minPricePerAdult: 5200,
        maxPricePerAdult: 5800,
        currency: 'CNY',
        fromCityCode: 'PVG',
        toCityCode: 'ICN',
      },
    },
  };
}

describe('travel-guide-flight-tier.util', () => {
  it('buildPlanFlightByTier maps snapshots to plan quotes', () => {
    const planFlightByTier = buildPlanFlightByTier({
      economy: flightQuote('economy', 1800, 2000),
      comfort: flightQuote('comfort', 5200, 5800),
    });

    expect(planFlightByTier?.economy?.cabinLabel).toBe('经济舱');
    expect(planFlightByTier?.comfort?.minPricePerAdult).toBe(5200);
  });

  it('normalizeFlightTierQuotesMonotonic keeps cabin tier identity while separating prices', () => {
    const normalized = normalizeFlightTierQuotesMonotonic({
      economy: {
        cabinLabel: '经济舱',
        minPricePerAdult: 3000,
        maxPricePerAdult: 3200,
        currency: 'CNY',
      },
      standard: {
        cabinLabel: '超级经济舱',
        minPricePerAdult: 2800,
        maxPricePerAdult: 3100,
        currency: 'CNY',
      },
      comfort: {
        cabinLabel: '公务舱',
        minPricePerAdult: 5000,
        maxPricePerAdult: 5200,
        currency: 'CNY',
      },
    });

    expect(normalized.economy!.cabinLabel).toBe('经济舱');
    expect(normalized.standard!.cabinLabel).toBe('超级经济舱');
    expect(normalized.standard!.minPricePerAdult).toBeGreaterThanOrEqual(
      normalized.economy!.maxPricePerAdult,
    );
  });

  it('normalizeFlightTierQuotesMonotonic keeps identical tier quotes unchanged', () => {
    const normalized = normalizeFlightTierQuotesMonotonic({
      economy: {
        cabinLabel: '经济舱',
        minPricePerAdult: 3350,
        maxPricePerAdult: 5300,
        currency: 'CNY',
      },
      standard: {
        cabinLabel: '经济舱',
        minPricePerAdult: 3350,
        maxPricePerAdult: 5300,
        currency: 'CNY',
        cabinFallback: true,
        requestedCabinLabel: '超级经济舱',
      },
      comfort: {
        cabinLabel: '经济舱',
        minPricePerAdult: 3350,
        maxPricePerAdult: 5300,
        currency: 'CNY',
        cabinFallback: true,
        requestedCabinLabel: '公务舱',
      },
    });

    expect(normalized.standard!.minPricePerAdult).toBe(3350);
    expect(normalized.comfort!.maxPricePerAdult).toBe(5300);
  });

  it('applyFlightTierQuoteToPlan replaces stale flight cards when tier has no offers array', () => {
    const plan = basePlan();
    const updated = applyFlightTierQuoteToPlan(plan, 'comfort', {
      headcount: 2,
      regionKind: 'overseas',
      interCity: true,
    });

    expect(updated.transport.flightOffers?.[0]?.cabinLabel).toBe('公务舱');
    expect(updated.transport.flightOffers?.[0]?.pricePerAdult).toBe(5200);
    expect(updated.budget?.items[0]?.range).toContain('10400');
  });

  it('applyFlightTierQuoteToPlan swaps flight budget and offers', () => {
    const plan = basePlan();
    const updated = applyFlightTierQuoteToPlan(plan, 'standard', {
      headcount: 2,
      regionKind: 'overseas',
      interCity: true,
    });

    expect(updated.transport.flightOffers?.[0]?.cabinLabel).toBe('超级经济舱');
    expect(updated.transport.flightOffers?.[0]?.pricePerAdult).toBe(2600);
    expect(updated.budget?.items[0]?.range).toContain('5200');
  });
});
