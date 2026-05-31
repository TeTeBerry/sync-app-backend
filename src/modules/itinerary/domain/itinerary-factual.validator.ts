import type { ItineraryTimelineItem } from '../../../database/schemas/user-itinerary.schema';
import type { ParsedItineraryPayload } from './itinerary-response.parser';
import type { PromptPerformance } from './itinerary-prompt.builder';

/**
 * Ensures LLM output uses official start times for each selected DJ performance.
 * Non-performance nodes (出行/餐饮) are not checked.
 */
export function validateItineraryAgainstFactualSchedule(
  itinerary: ParsedItineraryPayload,
  performances: PromptPerformance[],
  selectedDjIds: string[],
): boolean {
  if (performances.length === 0 || selectedDjIds.length === 0) return false;

  const selected = new Set(selectedDjIds);
  const officialByArtist = new Map<
    string,
    { startTime: string; stageLabel: string; artistName: string }
  >();

  for (const perf of performances) {
    if (!selected.has(perf.artistId)) continue;
    officialByArtist.set(perf.artistId, {
      startTime: perf.startTime,
      stageLabel: perf.stageLabel,
      artistName: perf.artistName,
    });
  }

  const allItems: ItineraryTimelineItem[] = [];
  for (const day of itinerary.days) {
    allItems.push(...day.items);
  }

  for (const [artistId, official] of officialByArtist) {
    const performanceItems = allItems.filter(
      item =>
        item.highlighted === true ||
        item.title.includes(official.artistName) ||
        (item.subtitle?.includes(official.stageLabel) ?? false),
    );

    const hasOfficialSlot = performanceItems.some(
      item => item.time === official.startTime,
    );
    if (!hasOfficialSlot) return false;
  }

  const allowedPerformanceTimes = new Set(
    performances
      .filter(p => selected.has(p.artistId))
      .map(p => `${p.artistId}:${p.startTime}`),
  );

  for (const item of allItems) {
    if (item.highlighted !== true) continue;
    const matched = performances.find(
      p =>
        selected.has(p.artistId) &&
        item.title.includes(p.artistName) &&
        item.time === p.startTime,
    );
    if (!matched) return false;
    if (!allowedPerformanceTimes.has(`${matched.artistId}:${item.time}`)) {
      return false;
    }
  }

  return true;
}
