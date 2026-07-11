import type {
  OpenFlightsAirportRecord,
  RavenPlaceSuggestion,
} from './raven-place-suggestions.types';

/** Minimal CSV splitter that respects double-quoted fields. */
export function splitOpenFlightsCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

export function parseOpenFlightsAirportsDat(
  raw: string,
): OpenFlightsAirportRecord[] {
  const records: OpenFlightsAirportRecord[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields = splitOpenFlightsCsvLine(trimmed);
    if (fields.length < 8) continue;

    const id = Number(fields[0]);
    const name = (fields[1] ?? '').trim();
    const city = (fields[2] ?? '').trim();
    const country = (fields[3] ?? '').trim();
    const iataRaw = (fields[4] ?? '').trim().toUpperCase();
    const icaoRaw = (fields[5] ?? '').trim().toUpperCase();
    const lat = Number(fields[6]);
    const lng = Number(fields[7]);
    const type = (fields[12] ?? 'airport').trim().toLowerCase() || 'airport';

    if (!Number.isFinite(id) || !name || !city) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const iata = iataRaw === '\\N' || iataRaw === 'N' ? '' : iataRaw;
    const icao = icaoRaw === '\\N' || icaoRaw === 'N' ? '' : icaoRaw;

    records.push({
      id,
      name,
      city,
      country,
      iata,
      icao,
      lat,
      lng,
      type,
    });
  }

  return records;
}

function normalizeQuery(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function isUsefulAirport(record: OpenFlightsAirportRecord): boolean {
  if (record.type && record.type !== 'airport') return false;
  return Boolean(record.iata) || Boolean(record.icao);
}

function toAirportSuggestion(
  record: OpenFlightsAirportRecord,
): RavenPlaceSuggestion {
  return {
    kind: 'airport',
    title: record.iata ? `${record.name} · ${record.iata}` : record.name,
    city: record.city,
    country: record.country,
    airportName: record.name,
    lat: record.lat,
    lng: record.lng,
    ...(record.iata ? { iata: record.iata } : {}),
    ...(record.icao ? { icao: record.icao } : {}),
  };
}

function toCitySuggestion(
  record: OpenFlightsAirportRecord,
): RavenPlaceSuggestion {
  return {
    kind: 'city',
    title: record.city,
    city: record.city,
    country: record.country,
    lat: record.lat,
    lng: record.lng,
    ...(record.iata ? { iata: record.iata } : {}),
  };
}

function scoreCity(city: string, country: string, q: string): number {
  const c = city.toLowerCase();
  const countryLower = country.toLowerCase();
  if (c === q) return 1000;
  if (c.startsWith(q)) return 800;
  if (c.includes(q)) return 600;
  if (countryLower.startsWith(q)) return 200;
  if (countryLower.includes(q)) return 100;
  return 0;
}

function scoreAirportCode(record: OpenFlightsAirportRecord, q: string): number {
  const iata = record.iata.toLowerCase();
  const icao = record.icao.toLowerCase();
  const name = record.name.toLowerCase();
  if (iata && iata === q) return 1000;
  if (icao && icao === q) return 950;
  if (iata && iata.startsWith(q)) return 850;
  if (name.startsWith(q)) return 700;
  if (name.includes(q)) return 500;
  return 0;
}

function sortAirports(
  a: OpenFlightsAirportRecord,
  b: OpenFlightsAirportRecord,
) {
  if (Boolean(a.iata) !== Boolean(b.iata)) return a.iata ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/**
 * Keyword search for departure UX: city rows only (city name as title).
 * IATA / airport-name hits resolve to their city so the picker stays single-select.
 */
export function searchOpenFlightsPlaceSuggestions(
  records: OpenFlightsAirportRecord[],
  keyword: string,
  limit = 12,
): RavenPlaceSuggestion[] {
  const q = normalizeQuery(keyword);
  if (!q) return [];

  const useful = records.filter(isUsefulAirport);

  // Airport-code / airport-name hits map to the parent city (no airport rows in results).
  const airportHits = useful
    .map((record) => ({ record, score: scoreAirportCode(record, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return sortAirports(a.record, b.record);
    });

  const cityBest = new Map<
    string,
    { score: number; record: OpenFlightsAirportRecord }
  >();

  const upsertCity = (
    record: OpenFlightsAirportRecord,
    score: number,
  ): void => {
    if (score <= 0) return;
    const key = `${record.city.toLowerCase()}|${record.country.toLowerCase()}`;
    const prev = cityBest.get(key);
    if (
      !prev ||
      score > prev.score ||
      (score === prev.score && sortAirports(record, prev.record) < 0)
    ) {
      cityBest.set(key, { score, record });
    }
  };

  for (const record of useful) {
    upsertCity(record, scoreCity(record.city, record.country, q));
  }

  // Exact / strong IATA hits boost that city to the top.
  for (const { record, score } of airportHits) {
    if (score >= 850) {
      upsertCity(record, score + 50);
    }
  }

  return [...cityBest.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.record.city.localeCompare(b.record.city);
    })
    .slice(0, limit)
    .map(({ record }) => toCitySuggestion(record));
}

/**
 * Return city row + every useful airport for that city (optional country).
 * Kept for API compatibility; Raven departure UX uses city-only keyword search.
 */
export function listAirportsForCity(
  records: OpenFlightsAirportRecord[],
  city: string,
  country?: string,
): RavenPlaceSuggestion[] {
  const cityQ = normalizeQuery(city);
  if (!cityQ) return [];
  const countryQ = country ? normalizeQuery(country) : '';

  const matches = records
    .filter(isUsefulAirport)
    .filter((record) => {
      if (record.city.toLowerCase() !== cityQ) return false;
      if (countryQ && record.country.toLowerCase() !== countryQ) return false;
      return true;
    })
    .sort(sortAirports);

  if (!matches.length) return [];

  const seen = new Set<string>();
  const airports: RavenPlaceSuggestion[] = [];
  for (const record of matches) {
    const key = record.iata || record.icao || String(record.id);
    if (seen.has(key)) continue;
    seen.add(key);
    airports.push(toAirportSuggestion(record));
  }

  return [toCitySuggestion(matches[0]!), ...airports];
}
