/**
 * Smoke RollingGo MCP (requires ROLLINGGO_API_KEY in sync-app-backend/.env).
 * Usage: node scripts/smoke-rollinggo-mcp.mjs
 */

const FLIGHT_URL = 'https://mcp.rollinggo.cn/mcp/flight';
const HOTEL_URL = 'https://mcp.rollinggo.cn/mcp';

async function callTool(url, name, args) {
  const apiKey = process.env.ROLLINGGO_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Set ROLLINGGO_API_KEY in sync-app-backend/.env');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name, arguments: args },
      id: 1,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${name} HTTP ${response.status}: ${raw.slice(0, 300)}`);
  }

  const envelope = JSON.parse(raw);
  const text = envelope.result?.content?.find((c) => c.type === 'text')?.text ?? '';
  const payload = text ? JSON.parse(text) : null;
  return { status: response.status, payload };
}

function pickCityCode(list = []) {
  const airport =
    list.find((item) => /机场|airport/i.test(item.airportName ?? '')) ?? list[0];
  const code = airport?.cityCode ?? airport?.airportCode;
  return code?.length === 3 ? code.toUpperCase() : undefined;
}

function summarizeFlights(list = []) {
  const prices = list
    .map((item) => item.totalAdultPrice)
    .filter((n) => typeof n === 'number' && n > 0)
    .sort((a, b) => a - b);
  return {
    count: list.length,
    min: prices[0] ?? 0,
    max: prices[prices.length - 1] ?? 0,
  };
}

console.log('RollingGo MCP smoke test\n');

const from = await callTool(FLIGHT_URL, 'searchAirports', { keyword: '深圳' });
const to = await callTool(FLIGHT_URL, 'searchAirports', { keyword: '曼谷' });
const fromCity = pickCityCode(from.payload?.airPortInformationList);
const toCity = pickCityCode(to.payload?.airPortInformationList);
console.log('✓ searchAirports', { fromCity, toCity });

if (!fromCity || !toCity) {
  throw new Error('Could not resolve airport city codes');
}

const flights = await callTool(FLIGHT_URL, 'searchFlights', {
  adultNumber: 1,
  childNumber: 0,
  cabinGrade: 'ECONOMY',
  tripType: 'ONE_WAY',
  fromCity,
  toCity,
  fromDate: '2026-10-01',
});
const flightSummary = summarizeFlights(flights.payload?.flightInformationList);
console.log('✓ searchFlights', flightSummary);

if (!flightSummary.min) {
  throw new Error('Flight prices not parsed');
}

const hotels = await callTool(HOTEL_URL, 'searchHotels', {
  originQuery: '曼谷 EDC 酒店',
  place: '曼谷',
  placeType: '城市',
  countryCode: 'TH',
  checkInParam: { checkInDate: '2026-10-01', stayNights: 2 },
  size: 3,
});
const hotelCount =
  hotels.payload?.hotelInformationList?.length ??
  hotels.payload?.hotels?.length ??
  0;
console.log('✓ searchHotels', { count: hotelCount, success: hotels.payload?.success });

console.log('\nRollingGo MCP OK — backend can use quote enrichment when ROLLINGGO_ENABLED=true');
