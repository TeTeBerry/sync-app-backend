import { formatClockTime } from '../../../common/utils/day-time.util';
import type {
  ItineraryDay,
  ItineraryTimelineItem,
} from '../../../database/schemas/user-itinerary.schema';

/** Coerce timeline clock to HH:mm (first match), for save/API validation. */
export function normalizeItineraryTimelineTime(raw: string): string {
  return formatClockTime(raw);
}

function normalizeTimelineItem(
  item: ItineraryTimelineItem,
): ItineraryTimelineItem {
  return {
    ...item,
    time: normalizeItineraryTimelineTime(item.time),
    ...(item.timeTag ? { timeTag: item.timeTag.trim().slice(0, 32) } : {}),
    ...(item.subtitle ? { subtitle: item.subtitle.trim().slice(0, 500) } : {}),
    title: item.title.trim().slice(0, 200),
    id: item.id.trim().slice(0, 64),
  };
}

export function normalizeItineraryDaysForSave(
  days: ItineraryDay[],
): ItineraryDay[] {
  return days.map((day, index) => {
    const items = day.items.map(normalizeTimelineItem);
    const id = day.id.trim().slice(0, 32) || `day-${index}`;
    const label = day.label.trim().slice(0, 32) || id;
    const bannerDateLabel = day.bannerDateLabel?.trim().slice(0, 32) || label;
    return {
      id,
      label,
      bannerDateLabel,
      nodeCount: day.nodeCount ?? items.length,
      items,
    };
  });
}
