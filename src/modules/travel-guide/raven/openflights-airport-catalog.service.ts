import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import {
  listAirportsForCity,
  parseOpenFlightsAirportsDat,
  resolveOpenFlightsFlightAirportIatas,
  searchOpenFlightsPlaceSuggestions,
} from './openflights-airports.util';
import {
  OPENFLIGHTS_AIRPORTS_FALLBACK_URLS,
  OPENFLIGHTS_AIRPORTS_URL,
  type OpenFlightsAirportRecord,
  type RavenPlaceSuggestion,
} from './raven-place-suggestions.types';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
/** Remote OpenFlights mirrors can be slow (esp. via CDN); keep generous. */
const FETCH_TIMEOUT_MS = 45_000;

@Injectable()
export class OpenFlightsAirportCatalogService {
  private readonly logger = new Logger(OpenFlightsAirportCatalogService.name);
  private readonly url: string;
  private readonly ttlMs: number;

  private records: OpenFlightsAirportRecord[] = [];
  private loadedAt = 0;
  private loadPromise: Promise<void> | null = null;
  private remoteRefreshPromise: Promise<void> | null = null;

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

  /**
   * Ranked commercial IATAs for RollingGo flight quotes when the static
   * departure map has no entry (e.g. Sydney, Paris).
   */
  async resolveFlightAirportIatas(
    cityLabel: string,
    limit = 4,
  ): Promise<string[]> {
    await this.ensureLoaded();
    return resolveOpenFlightsFlightAirportIatas(this.records, cityLabel, limit);
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

    // Bundled catalog first: raw.githubusercontent is often unreachable (e.g. CN),
    // and CDN mirrors can exceed request budgets. Local/dev must not 503.
    const bundled = await this.loadBundledAirportsDat();
    if (bundled.length) {
      this.records = bundled;
      this.loadedAt = Date.now();
      this.logger.log(
        `OpenFlights airports loaded from bundled catalog count=${bundled.length} durationMs=${Date.now() - started}`,
      );
      this.scheduleRemoteRefresh();
      return;
    }

    const remote = await this.tryFetchRemote();
    if (remote?.length) {
      this.records = remote;
      this.loadedAt = Date.now();
      this.logger.log(
        `OpenFlights airports loaded from remote count=${remote.length} durationMs=${Date.now() - started}`,
      );
      return;
    }

    if (this.records.length) {
      this.loadedAt = Date.now();
      this.logger.warn(
        'OpenFlights reload failed; continuing with stale in-memory catalog',
      );
      return;
    }

    throw new ServiceUnavailableException(
      'Airport catalog temporarily unavailable',
    );
  }

  private scheduleRemoteRefresh(): void {
    if (this.remoteRefreshPromise) return;
    this.remoteRefreshPromise = this.tryFetchRemote()
      .then((remote) => {
        if (!remote?.length) return;
        this.records = remote;
        this.loadedAt = Date.now();
        this.logger.log(
          `OpenFlights airports refreshed from remote count=${remote.length}`,
        );
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `OpenFlights background remote refresh failed: ${message}`,
        );
      })
      .finally(() => {
        this.remoteRefreshPromise = null;
      });
  }

  private remoteCandidateUrls(): string[] {
    const urls = [this.url, ...OPENFLIGHTS_AIRPORTS_FALLBACK_URLS];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of urls) {
      const trimmed = url.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
    return out;
  }

  private async tryFetchRemote(): Promise<OpenFlightsAirportRecord[] | null> {
    for (const url of this.remoteCandidateUrls()) {
      try {
        const parsed = await this.fetchAndParse(url);
        if (parsed.length) return parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `OpenFlights remote fetch failed url=${url}: ${message}`,
        );
      }
    }
    return null;
  }

  private async fetchAndParse(
    url: string,
  ): Promise<OpenFlightsAirportRecord[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
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
    return parsed;
  }

  private async loadBundledAirportsDat(): Promise<OpenFlightsAirportRecord[]> {
    const path = resolveBundledAirportsPath();
    if (!path) {
      this.logger.warn('OpenFlights bundled airports.dat not found on disk');
      return [];
    }

    try {
      const raw = await readFile(path, 'utf8');
      const parsed = parseOpenFlightsAirportsDat(raw);
      if (!parsed.length) {
        this.logger.warn(
          `OpenFlights bundled airports.dat parsed zero rows path=${path}`,
        );
        return [];
      }
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `OpenFlights bundled airports.dat read failed path=${path}: ${message}`,
      );
      return [];
    }
  }
}

/** Exported for unit tests. */
export function resolveBundledAirportsPath(): string | null {
  const candidates = [
    // Next to compiled JS when nest assets outDir matches tsc emit (dist/src/...).
    join(__dirname, 'data', 'airports.dat'),
    // nest default asset emit (dist/modules/...) when JS lives under dist/src/modules/...
    join(__dirname, '../../../../modules/travel-guide/raven/data/airports.dat'),
    join(process.cwd(), 'src/modules/travel-guide/raven/data/airports.dat'),
    join(
      process.cwd(),
      'dist/src/modules/travel-guide/raven/data/airports.dat',
    ),
    join(process.cwd(), 'dist/modules/travel-guide/raven/data/airports.dat'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
