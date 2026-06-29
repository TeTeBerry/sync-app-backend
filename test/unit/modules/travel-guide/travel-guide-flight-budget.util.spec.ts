import { buildRollingGoFlightBudgetItem } from '@src/modules/travel-guide/domain/travel-guide-flight-budget.util';

describe('travel-guide-flight-budget.util', () => {
  const flight = {
    fromCityCode: 'SHA',
    toCityCode: 'BKK',
    outboundDate: '2026-12-10',
    returnDate: '2026-12-14',
    currency: 'CNY' as const,
    minPricePerAdult: 2100,
    maxPricePerAdult: 2850,
    sampleLines: [
      'MU123 SHA→BKK · 直飞 · 约 ¥2100/人',
      'CZ456 PVG→BKK · 1 次中转 · 约 ¥2450/人',
    ],
    fetchedAt: '2026-06-29T00:00:00.000Z',
    source: 'rollinggo' as const,
  };

  it('buildRollingGoFlightBudgetItem includes route and sample flights', () => {
    const item = buildRollingGoFlightBudgetItem(flight, {
      headcount: 2,
      regionKind: 'overseas',
    });

    expect(item.label).toBe('机票（往返） · SHA→BKK');
    expect(item.range).toBe('约 ¥4200–5700');
    expect(item.note).toContain('约 ¥2100–2850/人');
    expect(item.note).toContain('12-10 去 · 12-14 返');
    expect(item.details).toHaveLength(2);
  });

  it('omits sample flight details when structured flightOffers exist', () => {
    const item = buildRollingGoFlightBudgetItem(
      {
        ...flight,
        flightOffers: [
          {
            pricePerAdult: 2100,
            currency: 'CNY',
            outbound: { route: 'SHA→BKK', stopsLabel: '直飞' },
          },
        ],
      },
      {
        headcount: 2,
        regionKind: 'overseas',
      },
    );

    expect(item.details).toBeUndefined();
  });
});
