import type {
  LlmTravelGuidePayload,
  TravelGuideHotelItem,
  TravelGuideSpotItem,
} from './travel-guide.types';

/** Coerce LLM / JSON drift into a single display line. */
export function coerceGuideLine(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    return text || null;
  }
  if (typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title =
    typeof record.title === 'string' ? record.title.trim() : '';
  const detail =
    typeof record.detail === 'string' ? record.detail.trim()
    : typeof record.note === 'string' ? record.note.trim()
    : '';
  if (title && detail) {
    return `${title}：${detail}`;
  }

  for (const key of [
    'text',
    'content',
    'line',
    'description',
    'hint',
    'summary',
    'detail',
    'message',
  ]) {
    const part = record[key];
    if (typeof part === 'string' && part.trim()) {
      return part.trim();
    }
  }

  if (title) return title;

  return null;
}

export function normalizeGuideLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) {
    const single = coerceGuideLine(lines);
    return single ? [single] : [];
  }
  const out: string[] = [];
  for (const item of lines) {
    const line = coerceGuideLine(item);
    if (line) out.push(line);
  }
  return out;
}

function normalizeHotel(item: unknown): TravelGuideHotelItem | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const name =
    typeof record.name === 'string' ? record.name.trim()
    : typeof record.title === 'string' ? record.title.trim()
    : '';
  const note =
    typeof record.note === 'string' ? record.note.trim()
    : coerceGuideLine(record.description) ?? '';
  if (!name) return null;
  const bookingHint =
    typeof record.bookingHint === 'string' ? record.bookingHint.trim()
    : typeof record.booking_hint === 'string' ? record.booking_hint.trim()
    : undefined;
  return { name, note: note || '详见地图平台', bookingHint: bookingHint || undefined };
}

function normalizeSpot(item: unknown): TravelGuideSpotItem | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const name =
    typeof record.name === 'string' ? record.name.trim()
    : typeof record.title === 'string' ? record.title.trim()
    : '';
  const note =
    typeof record.note === 'string' ? record.note.trim()
    : coerceGuideLine(record.description) ?? '';
  if (!name) return null;
  return { name, note: note || '详见地图平台' };
}

/** Normalize LLM JSON so UI never sees `[object Object]`. */
export function sanitizeLlmTravelGuidePayload(
  raw: LlmTravelGuidePayload | null | undefined,
): LlmTravelGuidePayload | null {
  if (!raw) return null;

  const transportLines = normalizeGuideLines(raw.transportLines);
  const hotels = Array.isArray(raw.hotels)
    ? raw.hotels
        .map((item) => normalizeHotel(item))
        .filter((item): item is TravelGuideHotelItem => item != null)
    : [];
  const parkingLines = raw.parkingLines
    ? normalizeGuideLines(raw.parkingLines)
    : undefined;
  const nightlifeSpots = Array.isArray(raw.nightlifeSpots)
    ? raw.nightlifeSpots
        .map((item) => normalizeSpot(item))
        .filter((item): item is TravelGuideSpotItem => item != null)
    : [];
  const tipItems = normalizeGuideLines(raw.tipItems);

  return {
    transportLines,
    hotels,
    parkingLines,
    nightlifeSpots,
    tipItems,
  };
}
