import {
  airportEndpoint,
  buildRollingGoFlightSearchArgs,
  cityCodeForAirportIata,
  cityEndpoint,
  listFlightEndpointQueryModes,
  listFlightEndpointSearchModes,
} from '@src/modules/travel-guide/domain/rollinggo-flight-endpoint.util';
import { pickFlightEndpoint } from '@src/modules/travel-guide/infra/rollinggo/rollinggo-mcp.client';

describe('rollinggo-flight-endpoint.util', () => {
  it('builds official searchFlights args with airport fields', () => {
    expect(
      buildRollingGoFlightSearchArgs({
        adultNumber: 1,
        childNumber: 0,
        cabinGrade: 'ECONOMY',
        tripType: 'ONE_WAY',
        fromDate: '2026-10-01',
        from: airportEndpoint('BKK')!,
        to: airportEndpoint('ICN')!,
      }),
    ).toEqual({
      adultNumber: 1,
      childNumber: 0,
      cabinGrade: 'ECONOMY',
      tripType: 'ONE_WAY',
      fromDate: '2026-10-01',
      fromAirport: 'BKK',
      toAirport: 'ICN',
    });
  });

  it('builds official searchFlights args with city fields and retDate', () => {
    expect(
      buildRollingGoFlightSearchArgs({
        adultNumber: 2,
        childNumber: 0,
        cabinGrade: 'ECONOMY',
        tripType: 'ROUND_TRIP',
        fromDate: '2026-10-01',
        retDate: '2026-10-05',
        from: cityEndpoint('HGH')!,
        to: cityEndpoint('CTU')!,
      }),
    ).toEqual({
      adultNumber: 2,
      childNumber: 0,
      cabinGrade: 'ECONOMY',
      tripType: 'ROUND_TRIP',
      fromDate: '2026-10-01',
      retDate: '2026-10-05',
      fromCity: 'HGH',
      toCity: 'CTU',
    });
  });

  it('maps multi-airport metros to distinct city codes', () => {
    expect(cityCodeForAirportIata('PVG')).toBe('SHA');
    expect(cityCodeForAirportIata('ICN')).toBe('SEL');
    expect(cityCodeForAirportIata('CMH')).toBe('CMH');
  });

  it('lists real city codes before airport IATAs (never fromCity=PVG)', () => {
    expect(
      listFlightEndpointQueryModes(
        airportEndpoint('PVG')!,
        airportEndpoint('CMH')!,
      ),
    ).toEqual([
      {
        from: { kind: 'city', code: 'SHA' },
        to: { kind: 'city', code: 'CMH' },
      },
      {
        from: { kind: 'airport', code: 'PVG' },
        to: { kind: 'airport', code: 'CMH' },
      },
    ]);
  });

  it('reuses preferred mode first when searching', () => {
    const preferred = {
      from: { kind: 'airport' as const, code: 'PVG' },
      to: { kind: 'airport' as const, code: 'CMH' },
    };
    expect(
      listFlightEndpointSearchModes(
        airportEndpoint('PVG')!,
        airportEndpoint('CMH')!,
        preferred,
      )[0],
    ).toEqual(preferred);
  });

  it('pickFlightEndpoint prefers cityCode for fromCity/toCity', () => {
    expect(
      pickFlightEndpoint([
        {
          iataCode: 'PVG',
          cityCode: 'SHA',
          airportName: 'Pudong',
          subType: 'AIRPORT',
        },
      ]),
    ).toEqual({ kind: 'city', code: 'SHA' });
  });

  it('pickFlightEndpoint falls back to airport IATA with metro cityCode', () => {
    expect(
      pickFlightEndpoint([
        { iataCode: 'CMH', airportName: 'Columbus', subType: 'AIRPORT' },
      ]),
    ).toEqual({ kind: 'airport', code: 'CMH', cityCode: 'CMH' });
  });
});
