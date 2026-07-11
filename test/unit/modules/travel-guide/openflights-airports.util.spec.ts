import {
  listAirportsForCity,
  parseOpenFlightsAirportsDat,
  searchOpenFlightsPlaceSuggestions,
  splitOpenFlightsCsvLine,
} from '@src/modules/travel-guide/raven/openflights-airports.util';

const SAMPLE_DAT = `
507,"London Heathrow Airport","London","United Kingdom","LHR","EGLL",51.4706,-0.461941,83,0,"E","Europe/London","airport","OurAirports"
509,"London Gatwick Airport","London","United Kingdom","LGW","EGKK",51.148102,-0.190278,202,0,"E","Europe/London","airport","OurAirports"
510,"London Stansted Airport","London","United Kingdom","STN","EGSS",51.884998,0.235,348,0,"E","Europe/London","airport","OurAirports"
3406,"Shanghai Pudong International Airport","Shanghai","China","PVG","ZSPD",31.1434,121.805,13,8,"U","Asia/Shanghai","airport","OurAirports"
3391,"Beijing Capital International Airport","Beijing","China","PEK","ZBAA",40.080101,116.584999,116,8,"U","Asia/Shanghai","airport","OurAirports"
1,"Goroka Airport","Goroka","Papua New Guinea","GKA","AYGA",-6.08,145.39,5282,10,"U","Pacific/Port_Moresby","airport","OurAirports"
`.trim();

describe('openflights-airports.util', () => {
  it('splits quoted CSV fields with commas', () => {
    const fields = splitOpenFlightsCsvLine(
      '1,"Foo, Bar Airport","City","Country","ABC","XXXX",1,2,3,0,"U","Tz","airport","OurAirports"',
    );
    expect(fields[1]).toBe('Foo, Bar Airport');
    expect(fields[4]).toBe('ABC');
  });

  it('parses airports.dat rows', () => {
    const records = parseOpenFlightsAirportsDat(SAMPLE_DAT);
    expect(records.length).toBe(6);
    expect(records.find((r) => r.iata === 'PVG')?.city).toBe('Shanghai');
  });

  it('keyword search returns city rows only for place names', () => {
    const records = parseOpenFlightsAirportsDat(SAMPLE_DAT);
    const suggestions = searchOpenFlightsPlaceSuggestions(records, 'London', 8);

    expect(suggestions.every((s) => s.kind === 'city')).toBe(true);
    expect(suggestions[0]?.city).toBe('London');
    expect(suggestions[0]?.title).toBe('London');
  });

  it('resolves IATA matches to the parent city (no airport rows)', () => {
    const records = parseOpenFlightsAirportsDat(SAMPLE_DAT);
    const suggestions = searchOpenFlightsPlaceSuggestions(records, 'PVG', 5);
    expect(suggestions[0]?.kind).toBe('city');
    expect(suggestions[0]?.city).toBe('Shanghai');
    expect(suggestions[0]?.title).toBe('Shanghai');
  });

  it('returns empty for blank keyword', () => {
    const records = parseOpenFlightsAirportsDat(SAMPLE_DAT);
    expect(searchOpenFlightsPlaceSuggestions(records, '  ')).toEqual([]);
  });

  it('lists city + all airports for a selected city', () => {
    const records = parseOpenFlightsAirportsDat(SAMPLE_DAT);
    const rows = listAirportsForCity(records, 'London', 'United Kingdom');

    expect(rows[0]).toMatchObject({
      kind: 'city',
      title: 'London',
      city: 'London',
    });
    expect(rows.slice(1).every((s) => s.kind === 'airport')).toBe(true);
    expect(
      rows
        .slice(1)
        .map((s) => s.iata)
        .sort(),
    ).toEqual(['LGW', 'LHR', 'STN']);
    expect(rows.find((s) => s.iata === 'LHR')?.title).toBe(
      'London Heathrow Airport · LHR',
    );
  });

  it('formats city title as city name only', () => {
    const records = parseOpenFlightsAirportsDat(SAMPLE_DAT);
    const suggestions = searchOpenFlightsPlaceSuggestions(
      records,
      'Shanghai',
      5,
    );
    expect(suggestions[0]?.title).toBe('Shanghai');
    expect(suggestions[0]?.country).toBe('China');
  });

  it('disambiguates same city name via country', () => {
    const records = parseOpenFlightsAirportsDat(SAMPLE_DAT);
    expect(listAirportsForCity(records, 'London', 'China')).toEqual([]);
    expect(
      listAirportsForCity(records, 'Shanghai')
        .filter((s) => s.kind === 'airport')
        .map((s) => s.iata),
    ).toEqual(['PVG']);
  });
});
