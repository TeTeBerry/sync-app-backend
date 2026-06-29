export const HOTEL_NIGHTLY_PRICE_MIN_CNY = 80;
export const HOTEL_NIGHTLY_PRICE_MAX_CNY = 12_000;
export const FLIGHT_PRICE_MIN_CNY = 100;
export const FLIGHT_PRICE_MAX_CNY = 50_000;

export function isPlausibleHotelNightlyPrice(
  value: number,
  currency = 'CNY',
): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (currency === 'USD') {
    return value >= 20 && value <= 3_000;
  }
  return (
    value >= HOTEL_NIGHTLY_PRICE_MIN_CNY && value <= HOTEL_NIGHTLY_PRICE_MAX_CNY
  );
}

export function isPlausibleFlightPrice(
  value: number,
  currency = 'CNY',
): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (currency === 'USD') {
    return value >= 50 && value <= 15_000;
  }
  return value >= FLIGHT_PRICE_MIN_CNY && value <= FLIGHT_PRICE_MAX_CNY;
}
