import type { BuddyPostSearchParsed } from '@sync/partner-contracts';

function extractDeparturePhrase(
  parsed: BuddyPostSearchParsed,
): string | undefined {
  if (parsed.departureCity?.trim()) {
    return `${parsed.departureCity.trim()}出发`;
  }

  const keywords = parsed.extraKeywords ?? [];
  const departureKeyword = keywords.find((keyword) => keyword.includes('出发'));
  if (departureKeyword?.trim()) {
    return departureKeyword.trim();
  }

  const eventName = parsed.eventName?.trim();
  if (eventName && !keywords.length) {
    return eventName;
  }

  return undefined;
}

function collectExtraSummaryKeywords(parsed: BuddyPostSearchParsed): string[] {
  const used = new Set<string>();
  const departure = extractDeparturePhrase(parsed);
  if (departure) used.add(departure);

  for (const field of [
    parsed.date,
    parsed.genre,
    parsed.eventName,
    parsed.peopleCount,
  ]) {
    const trimmed = field?.trim();
    if (trimmed) used.add(trimmed);
  }

  return (parsed.extraKeywords ?? [])
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0 && !used.has(keyword));
}

export type BuddyPostSearchParsedSummaryPart =
  | { kind: 'text'; value: string }
  | { kind: 'peopleCount'; value: string };

export function buildBuddyPostSearchParsedSummaryParts(
  parsed: BuddyPostSearchParsed | null | undefined,
): BuddyPostSearchParsedSummaryPart[] {
  if (!parsed) return [];

  const parts: BuddyPostSearchParsedSummaryPart[] = [];
  const departure = extractDeparturePhrase(parsed);
  if (departure) {
    parts.push({ kind: 'text', value: departure });
  }

  const date = parsed.date?.trim();
  if (date) {
    parts.push({ kind: 'text', value: date });
  }

  const peopleCount = parsed.peopleCount?.trim();
  if (peopleCount) {
    parts.push({ kind: 'peopleCount', value: peopleCount });
  }

  const genre = parsed.genre?.trim();
  if (genre) {
    parts.push({ kind: 'text', value: genre });
  }

  const eventName = parsed.eventName?.trim();
  if (eventName && eventName !== departure) {
    parts.push({ kind: 'text', value: eventName });
  }

  for (const keyword of collectExtraSummaryKeywords(parsed)) {
    parts.push({ kind: 'text', value: keyword });
  }

  return parts;
}

export function formatBuddyPostSearchParsedSummary(
  parsed: BuddyPostSearchParsed | null | undefined,
  formatPeopleCount: (count: string) => string = (count) => `${count}人`,
): string | null {
  const parts = buildBuddyPostSearchParsedSummaryParts(parsed);
  if (!parts.length) return null;

  const formatted = parts.map((part) =>
    part.kind === 'peopleCount' ? formatPeopleCount(part.value) : part.value,
  );

  return formatted.join(' · ');
}
