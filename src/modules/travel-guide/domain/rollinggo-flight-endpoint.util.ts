/**
 * RollingGo flight endpoints — official searchFlights contract:
 * use fromCity/toCity OR fromAirport/toAirport (mutually exclusive pairs).
 * @see rollinggo-flight CLI FlightSearchInput.to_payload()
 */

export type RollingGoFlightEndpointKind = 'city' | 'airport';

export type RollingGoFlightEndpoint = {
  kind: RollingGoFlightEndpointKind;
  code: string;
  /**
   * Metro city code for official `fromCity`/`toCity` when `kind` is `airport`.
   * Never invent a city query from a raw airport IATA when this differs
   * (e.g. PVG → SHA, not fromCity=PVG).
   */
  cityCode?: string;
};

export type RollingGoFlightSearchArgs = {
  adultNumber: number;
  childNumber: number;
  cabinGrade: string;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  fromDate: string;
  retDate?: string;
  fromCity?: string;
  fromAirport?: string;
  toCity?: string;
  toAirport?: string;
};

export type FlightEndpointQueryMode = {
  from: RollingGoFlightEndpoint;
  to: RollingGoFlightEndpoint;
};

/**
 * Multi-airport metros where airport IATA ≠ RollingGo city code.
 * Unlisted airports default to cityCode === IATA (common single-airport cities).
 */
const AIRPORT_METRO_CITY_CODE: Record<string, string> = {
  PVG: 'SHA',
  SHA: 'SHA',
  PEK: 'BJS',
  PKX: 'BJS',
  TFU: 'CTU',
  CTU: 'CTU',
  ICN: 'SEL',
  GMP: 'SEL',
  HND: 'TYO',
  NRT: 'TYO',
  BKK: 'BKK',
  DMK: 'BKK',
  KIX: 'OSA',
  ITM: 'OSA',
  LPL: 'MAN',
  MAN: 'MAN',
  LHR: 'LON',
  LGW: 'LON',
  STN: 'LON',
  JFK: 'NYC',
  EWR: 'NYC',
  LGA: 'NYC',
};

/** RollingGo city code to use with `fromCity`/`toCity` for an airport IATA. */
export function cityCodeForAirportIata(iata: string): string | undefined {
  const code = iata?.trim().toUpperCase();
  if (!code || code.length !== 3) return undefined;
  return AIRPORT_METRO_CITY_CODE[code] ?? code;
}

export function flightEndpoint(
  kind: RollingGoFlightEndpointKind,
  code: string,
  cityCode?: string,
): RollingGoFlightEndpoint | undefined {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || normalized.length !== 3) return undefined;
  const endpoint: RollingGoFlightEndpoint = { kind, code: normalized };
  if (kind === 'airport') {
    const metro =
      cityCode?.trim().toUpperCase() || cityCodeForAirportIata(normalized);
    if (metro?.length === 3) {
      endpoint.cityCode = metro;
    }
  }
  return endpoint;
}

/** Static catalog / hot-path IATA values are airport codes. */
export function airportEndpoint(
  code: string,
  cityCode?: string,
): RollingGoFlightEndpoint | undefined {
  return flightEndpoint('airport', code, cityCode);
}

export function cityEndpoint(
  code: string,
): RollingGoFlightEndpoint | undefined {
  return flightEndpoint('city', code);
}

export function formatFlightEndpoint(
  endpoint: RollingGoFlightEndpoint,
): string {
  if (endpoint.kind === 'airport' && endpoint.cityCode) {
    return `airport:${endpoint.code}(city:${endpoint.cityCode})`;
  }
  return `${endpoint.kind}:${endpoint.code}`;
}

export function flightEndpointCode(endpoint: RollingGoFlightEndpoint): string {
  return endpoint.code;
}

export function sameFlightEndpoint(
  a: RollingGoFlightEndpoint,
  b: RollingGoFlightEndpoint,
): boolean {
  return a.kind === b.kind && a.code === b.code;
}

export function sameFlightEndpointQueryMode(
  a: FlightEndpointQueryMode,
  b: FlightEndpointQueryMode,
): boolean {
  return sameFlightEndpoint(a.from, b.from) && sameFlightEndpoint(a.to, b.to);
}

/**
 * Official query order: try real city codes first, then airport IATAs.
 * Never stuff airport IATAs into fromCity/toCity when a distinct metro
 * city code is known (PVG → city SHA, then airport PVG).
 */
export function listFlightEndpointQueryModes(
  from: RollingGoFlightEndpoint,
  to: RollingGoFlightEndpoint,
): FlightEndpointQueryMode[] {
  const modes: FlightEndpointQueryMode[] = [];

  const fromCity =
    from.kind === 'city' ? from.code : from.cityCode?.trim().toUpperCase();
  const toCity =
    to.kind === 'city' ? to.code : to.cityCode?.trim().toUpperCase();

  if (fromCity?.length === 3 && toCity?.length === 3) {
    modes.push({
      from: { kind: 'city', code: fromCity },
      to: { kind: 'city', code: toCity },
    });
  }

  const airportPair: FlightEndpointQueryMode = {
    from: { kind: 'airport', code: from.code },
    to: { kind: 'airport', code: to.code },
  };

  if (
    !modes.some(
      (mode) =>
        mode.from.kind === airportPair.from.kind &&
        mode.from.code === airportPair.from.code &&
        mode.to.kind === airportPair.to.kind &&
        mode.to.code === airportPair.to.code,
    )
  ) {
    modes.push(airportPair);
  }

  return modes;
}

/**
 * Prefer a probe-proven mode first; keep remaining official modes as fallback.
 */
export function listFlightEndpointSearchModes(
  from: RollingGoFlightEndpoint,
  to: RollingGoFlightEndpoint,
  preferred?: FlightEndpointQueryMode,
): FlightEndpointQueryMode[] {
  const all = listFlightEndpointQueryModes(from, to);
  if (!preferred) return all;
  return [
    preferred,
    ...all.filter((mode) => !sameFlightEndpointQueryMode(mode, preferred)),
  ];
}

/**
 * Build official searchFlights arguments.
 * Never mixes city + airport on the same side.
 */
export function buildRollingGoFlightSearchArgs(input: {
  adultNumber: number;
  childNumber: number;
  cabinGrade: string;
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  fromDate: string;
  retDate?: string;
  from: RollingGoFlightEndpoint;
  to: RollingGoFlightEndpoint;
}): RollingGoFlightSearchArgs {
  const args: RollingGoFlightSearchArgs = {
    adultNumber: input.adultNumber,
    childNumber: input.childNumber,
    cabinGrade: input.cabinGrade,
    tripType: input.tripType,
    fromDate: input.fromDate,
  };
  if (input.retDate) {
    args.retDate = input.retDate;
  }
  if (input.from.kind === 'city') {
    args.fromCity = input.from.code;
  } else {
    args.fromAirport = input.from.code;
  }
  if (input.to.kind === 'city') {
    args.toCity = input.to.code;
  } else {
    args.toAirport = input.to.code;
  }
  return args;
}
