import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/auth/public.decorator';
import { PublicApiRateLimitService } from '../../../common/rate-limit/public-api-rate-limit.service';
import { OpenFlightsAirportCatalogService } from './openflights-airport-catalog.service';

/**
 * Raven / sync-web departure suggestions (OpenFlights).
 *
 * Flow:
 * 1) `?keyword=` → city suggestions (+ direct IATA hits)
 * 2) `?city=&country=` → all airports for that city
 *
 * Mini program continues to use GET /api/travel-guide/place-suggestions (Amap).
 */
@Public()
@Controller('raven')
export class RavenPlaceSuggestionsController {
  constructor(
    private readonly catalog: OpenFlightsAirportCatalogService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Get('place-suggestions')
  async placeSuggestions(
    @Query('keyword') keyword = '',
    @Query('city') city = '',
    @Query('country') country = '',
    @Query('limit') limitRaw?: string,
    @Req() req?: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'raven_place_suggestions',
      req ?? ({} as Request),
    );

    const cityQ = city.trim();
    if (cityQ) {
      const data = await this.catalog.listAirportsByCity(
        cityQ,
        country.trim() || undefined,
      );
      return { data };
    }

    const q = keyword.trim();
    if (!q) {
      return { data: [] };
    }

    const limit = clampLimit(limitRaw);
    const data = await this.catalog.suggest(q, limit);
    return { data };
  }
}

function clampLimit(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 12;
  return Math.max(1, Math.min(30, Math.floor(n)));
}
