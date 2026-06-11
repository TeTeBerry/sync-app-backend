import type { ItineraryDay, ItineraryTimelineItem } from './types';

/** Normalize clock text to HH:mm (first segment of ranges like `20:30-22:00`). */
export function formatClockTime(raw: string, maxFallbackLength = 32): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  const segment = trimmed.match(/\d{1,2}:\d{2}/)?.[0];
  if (!segment) {
    return trimmed.slice(0, maxFallbackLength);
  }

  const [hours, minutes] = segment.split(':');
  return `${hours!.padStart(2, '0')}:${minutes}`;
}

function normalizeTimelineItem(
  item: ItineraryTimelineItem,
): ItineraryTimelineItem {
  const dotColor =
    item.dotColor === 'cyan' || item.dotColor === 'purple'
      ? item.dotColor
      : 'pink';
  const timeTagColor =
    item.timeTagColor === 'cyan' || item.timeTagColor === 'purple'
      ? item.timeTagColor
      : dotColor;

  return {
    ...item,
    id: item.id.trim().slice(0, 64),
    time: formatClockTime(item.time),
    title: item.title.trim().slice(0, 200),
    dotColor,
    ...(item.subtitle ? { subtitle: item.subtitle.trim().slice(0, 500) } : {}),
    ...(item.timeTag
      ? { timeTag: item.timeTag.trim().slice(0, 32), timeTagColor }
      : {}),
    ...(item.pill
      ? {
          pill: {
            label: item.pill.label.trim().slice(0, 64),
            variant: item.pill.variant === 'pink' ? 'pink' : 'green',
          },
        }
      : {}),
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
