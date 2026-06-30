import {
  buildTransitRouteSummary,
  parseAmapTransitRouteSteps,
} from '../../../../src/modules/travel-guide/map/amap-transit-route.util';

const sampleAmapTransitResponse = {
  status: '1',
  route: {
    transits: [
      {
        distance: '12500',
        duration: '2400',
        segments: [
          {
            walking: {
              distance: '350',
              duration: '300',
              steps: [{ instruction: '步行350米' }],
            },
            entrance: { name: '世博大道站' },
          },
          {
            bus: {
              buslines: [
                {
                  name: '地铁13号线',
                  type: '地铁线路',
                  distance: '8000',
                  duration: '1200',
                  departure_stop: { name: '世博大道' },
                  arrival_stop: { name: '世博会博物馆' },
                  via_num: '3',
                },
              ],
            },
            entrance: { name: '世博大道' },
          },
          {
            walking: {
              distance: '420',
              duration: '360',
              steps: [{ instruction: '步行420米到达会场' }],
            },
            exit: { name: '世博会博物馆' },
          },
        ],
      },
    ],
  },
};

describe('amap-transit-route.util', () => {
  it('parses subway segments with walking legs', () => {
    const steps = parseAmapTransitRouteSteps(sampleAmapTransitResponse);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.some((s) => s.mode === 'walking')).toBe(true);
    expect(
      steps.some((s) => s.mode === 'subway' && /地铁13号线/.test(s.summary)),
    ).toBe(true);
    const subway = steps.find((s) => s.mode === 'subway');
    expect(subway?.summary).toMatch(/世博大道.*世博会博物馆/);
    expect(subway?.viaStops).toBe(3);
  });

  it('builds transit route summary with detail lines', () => {
    const summary = buildTransitRouteSummary(sampleAmapTransitResponse);
    expect(summary).not.toBeNull();
    expect(summary!.distanceKm).toBe(12.5);
    expect(summary!.durationMin).toBe(40);
    expect(summary!.detailLines.length).toBeGreaterThanOrEqual(3);
    expect(summary!.detailLines.join(' ')).toMatch(/地铁13号线/);
    expect(summary!.detailLines.join(' ')).toMatch(/步行/);
  });

  it('returns null for empty or failed responses', () => {
    expect(buildTransitRouteSummary(null)).toBeNull();
    expect(buildTransitRouteSummary({ status: '0' })).toBeNull();
    expect(
      buildTransitRouteSummary({
        status: '1',
        route: { transits: [{ distance: '0', duration: '0', segments: [] }] },
      }),
    ).toBeNull();
  });
});
