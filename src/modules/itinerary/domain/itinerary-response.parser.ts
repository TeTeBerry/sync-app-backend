import type {
  ItineraryDay,
  ItineraryTimelineDotColor,
  ItineraryTimelineItem,
} from '../../../database/schemas/user-itinerary.schema';

const DOT_COLORS = new Set<ItineraryTimelineDotColor>([
  'pink',
  'cyan',
  'purple',
]);

export interface ParsedItineraryPayload {
  eventMeta: string;
  days: ItineraryDay[];
}

function sanitizeDotColor(raw: unknown): ItineraryTimelineDotColor {
  if (typeof raw === 'string' && DOT_COLORS.has(raw as ItineraryTimelineDotColor)) {
    return raw as ItineraryTimelineDotColor;
  }
  return 'pink';
}

function sanitizeItem(raw: unknown, index: number): ItineraryTimelineItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const time = typeof item.time === 'string' ? item.time.trim() : '';
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!time || !title) return null;

  const dotColor = sanitizeDotColor(item.dotColor);
  const id =
    typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : `item-${index}`;

  const parsed: ItineraryTimelineItem = {
    id,
    time,
    dotColor,
    title,
  };

  if (typeof item.subtitle === 'string' && item.subtitle.trim()) {
    parsed.subtitle = item.subtitle.trim();
  }
  if (typeof item.timeTag === 'string' && item.timeTag.trim()) {
    parsed.timeTag = item.timeTag.trim();
    parsed.timeTagColor = sanitizeDotColor(item.timeTagColor ?? dotColor);
  }
  if (item.pill && typeof item.pill === 'object') {
    const pill = item.pill as Record<string, unknown>;
    const label = typeof pill.label === 'string' ? pill.label.trim() : '';
    const variant = pill.variant === 'pink' ? 'pink' : 'green';
    if (label) parsed.pill = { label, variant };
  }
  if (item.highlighted === true) parsed.highlighted = true;

  return parsed;
}

function sanitizeDay(raw: unknown, index: number): ItineraryDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const day = raw as Record<string, unknown>;
  const id =
    typeof day.id === 'string' && day.id.trim()
      ? day.id.trim()
      : `day-${index}`;
  const label = typeof day.label === 'string' ? day.label.trim() : '';
  const bannerDateLabel =
    typeof day.bannerDateLabel === 'string'
      ? day.bannerDateLabel.trim()
      : label;
  if (!label) return null;

  const rawItems = Array.isArray(day.items) ? day.items : [];
  const items = rawItems
    .map((item, i) => sanitizeItem(item, i))
    .filter((item): item is ItineraryTimelineItem => item != null);

  if (items.length === 0) return null;

  return {
    id,
    label,
    bannerDateLabel: bannerDateLabel || label,
    nodeCount: items.length,
    items,
  };
}

export function parseItineraryGenerationResponse(
  raw: unknown,
  fallbackEventMeta: string,
): ParsedItineraryPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const eventMeta =
    typeof root.eventMeta === 'string' && root.eventMeta.trim()
      ? root.eventMeta.trim()
      : fallbackEventMeta;

  const rawDays = Array.isArray(root.days) ? root.days : [];
  const days = rawDays
    .map((day, i) => sanitizeDay(day, i))
    .filter((day): day is ItineraryDay => day != null);

  if (days.length === 0) return null;
  return { eventMeta, days };
}
