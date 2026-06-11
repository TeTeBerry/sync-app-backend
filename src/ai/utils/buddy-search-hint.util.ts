/** Detect zone/day scoped buddy search phrasing (policy routing only). */
export function inferBuddySearchHintKind(
  displayLabel: string,
): 'zone' | 'event_day' | 'day_or_zone' | undefined {
  const label = displayLabel.trim();
  if (!label) return undefined;
  if (/（或.+区）/.test(label)) return 'day_or_zone';
  if (/\d+月\d+日/.test(label) && /区/.test(label)) return 'day_or_zone';
  if (/\d+月\d+日/.test(label)) return 'event_day';
  if (/[A-Za-z]区/.test(label) || /\d+号[A-Za-z]区/.test(label)) return 'zone';
  if (/\d+号/.test(label)) return 'event_day';
  return undefined;
}
