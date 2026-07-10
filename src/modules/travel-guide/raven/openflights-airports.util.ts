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
    title: `${record.city}, ${record.country}`,
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
 * Keyword search for departure UX step 1: city rows (+ direct IATA/airport hits).
 * Selecting a city should then call listAirportsForCity for the full airport list.
 */
export function searchOpenFlightsPlaceSuggestions(
  records: OpenFlightsAirportRecord[],
  keyword: string,
  limit = 12,
): RavenPlaceSuggestion[] {
  const q = normalizeQuery(keyword);
  if (!q) return [];

  const useful = records.filter(isUsefulAirport);

  // Direct airport-code / airport-name hits (e.g. PVG, Heathrow).
  const airportHits = useful
    .map((record) => ({ record, score: scoreAirportCode(record, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return sortAirports(a.record, b.record);
    });

  // City aggregation from matching city/country names.
  const cityBest = new Map<
    string,
    { score: number; record: OpenFlightsAirportRecord }
  >();
  for (const record of useful) {
    const score = scoreCity(record.city, record.country, q);
    if (score <= 0) continue;
    const key = `${record.city.toLowerCase()}|${record.country.toLowerCase()}`;
    const prev = cityBest.get(key);
    if (
      !prev ||
      score > prev.score ||
      (score === prev.score && sortAirports(record, prev.record) < 0)
    ) {
      cityBest.set(key, { score, record });
    }
  }

  const cityHits = [...cityBest.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.record.city.localeCompare(b.record.city);
  });

  const out: RavenPlaceSuggestion[] = [];
  const seenAirport = new Set<string>();

  // Prefer cities for typed place names; still surface exact IATA first when relevant.
  const preferAirportFirst =
    q.length <= 4 && airportHits.some((h) => h.score >= 850);

  if (preferAirportFirst) {
    for (const { record } of airportHits) {
      if (out.length >= limit) break;
      const key = record.iata || record.icao || String(record.id);
      if (seenAirport.has(key)) continue;
      seenAirport.add(key);
      out.push(toAirportSuggestion(record));
    }
  }

  for (const { record } of cityHits) {
    if (out.length >= limit) break;
    out.push(toCitySuggestion(record));
  }

  if (!preferAirportFirst) {
    for (const { record } of airportHits) {
      if (out.length >= limit) break;
      const key = record.iata || record.icao || String(record.id);
      if (seenAirport.has(key)) continue;
      seenAirport.add(key);
      out.push(toAirportSuggestion(record));
    }
  }

  return out.slice(0, limit);
}

/**
 * Return city row + every useful airport for that city (optional country).
 * No limit truncation — frontend needs the full set after city selection.
 *
 * Example titles:
 * - Shanghai, China
 * - Shanghai Pudong International Airport · PVG
 * - Shanghai Hongqiao International Airport · SHA
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

  // Deduplicate by IATA (fallback ICAO/id).
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
