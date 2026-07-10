import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  listAirportsForCity,
  parseOpenFlightsAirportsDat,
  searchOpenFlightsPlaceSuggestions,
} from './openflights-airports.util';
import {
  OPENFLIGHTS_AIRPORTS_URL,
  type OpenFlightsAirportRecord,
  type RavenPlaceSuggestion,
} from './raven-place-suggestions.types';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;

@Injectable()
export class OpenFlightsAirportCatalogService {
  private readonly logger = new Logger(OpenFlightsAirportCatalogService.name);
  private readonly url: string;
  private readonly ttlMs: number;

  private records: OpenFlightsAirportRecord[] = [];
  private loadedAt = 0;
  private loadPromise: Promise<void> | null = null;

  constructor(config: ConfigService) {
    this.url =
      config.get<string>('raven.openflightsAirportsUrl')?.trim() ||
      OPENFLIGHTS_AIRPORTS_URL;
    this.ttlMs =
      config.get<number>('raven.openflightsCacheTtlMs') ?? DEFAULT_TTL_MS;
  }

  async suggest(keyword: string, limit = 12): Promise<RavenPlaceSuggestion[]> {
    await this.ensureLoaded();
    return searchOpenFlightsPlaceSuggestions(this.records, keyword, limit);
  }

  async listAirportsByCity(
    city: string,
    country?: string,
  ): Promise<RavenPlaceSuggestion[]> {
    await this.ensureLoaded();
    return listAirportsForCity(this.records, city, country);
  }

  /** Test / ops helper */
  getRecordCount(): number {
    return this.records.length;
  }

  private async ensureLoaded(): Promise<void> {
    const fresh =
      this.records.length > 0 && Date.now() - this.loadedAt < this.ttlMs;
    if (fresh) return;

    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }

    this.loadPromise = this.reload().finally(() => {
      this.loadPromise = null;
    });
    await this.loadPromise;
  }

  private async reload(): Promise<void> {
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(this.url, {
          signal: controller.signal,
          headers: { Accept: 'text/plain,*/*' },
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const raw = await response.text();
      const parsed = parseOpenFlightsAirportsDat(raw);
      if (!parsed.length) {
        throw new Error('parsed zero airport rows');
      }

      this.records = parsed;
      this.loadedAt = Date.now();
      this.logger.log(
        `OpenFlights airports loaded count=${parsed.length} durationMs=${Date.now() - started}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`OpenFlights airports reload failed: ${message}`);
      if (this.records.length) {
        // Keep serving stale cache.
        this.loadedAt = Date.now();
        return;
      }
      throw new ServiceUnavailableException(
        'Airport catalog temporarily unavailable',
      );
    }
  }
}
