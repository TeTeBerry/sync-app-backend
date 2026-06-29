import type { TravelQuoteQuery } from '../ports/travel-quote.types';

/** RollingGo searchHotels originQuery — 通用活动/场馆，不绑定单一电音节。 */
export function buildRollingGoHotelOriginQuery(
  query: TravelQuoteQuery,
): string {
  const venue = query.venueTitle?.trim();
  const activity = query.activityName?.trim();
  const city = query.destinationCity.trim();

  if (venue && activity && !venue.includes(activity)) {
    return `${city} ${activity} ${venue} 酒店`;
  }
  if (venue) {
    return `${city} ${venue} 酒店`;
  }
  if (activity) {
    return `${city} ${activity} 酒店`;
  }
  return `${city} 酒店`;
}
