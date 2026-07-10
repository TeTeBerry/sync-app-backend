import { ConfigService } from '@nestjs/config';
import {
  OpenFlightsAirportCatalogService,
  resolveBundledAirportsPath,
} from '@src/modules/travel-guide/raven/openflights-airport-catalog.service';

describe('OpenFlightsAirportCatalogService', () => {
  it('resolves the bundled airports.dat shipped with the repo', () => {
    expect(resolveBundledAirportsPath()).toMatch(/airports\.dat$/);
  });

  it('serves keyword suggestions from the bundled catalog without remote fetch', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network blocked'));

    const config = {
      get: (key: string) => {
        if (key === 'raven.openflightsAirportsUrl') {
          return 'https://example.invalid/airports.dat';
        }
        if (key === 'raven.openflightsCacheTtlMs') return 86_400_000;
        return undefined;
      },
    } as unknown as ConfigService;

    const catalog = new OpenFlightsAirportCatalogService(config);
    const suggestions = await catalog.suggest('London', 8);

    expect(catalog.getRecordCount()).toBeGreaterThan(1000);
    expect(
      suggestions.some((row) => row.kind === 'city' && row.city === 'London'),
    ).toBe(true);
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
