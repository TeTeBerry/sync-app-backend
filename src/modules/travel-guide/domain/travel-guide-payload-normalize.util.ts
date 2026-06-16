import type {
  LlmTravelGuidePayload,
  TravelGuideAccommodationScheme,
  TravelGuideBudgetItem,
  TravelGuideHotelItem,
  TravelGuideSpotItem,
  TravelGuideTicketChannel,
  TravelGuideVenueTransportOption,
} from './travel-guide.types';

/** Coerce LLM / JSON drift into a single display line. */
export function coerceGuideLine(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (
    value == null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    const text = String(value).trim();
    return text || null;
  }
  if (typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const detail =
    typeof record.detail === 'string'
      ? record.detail.trim()
      : typeof record.note === 'string'
        ? record.note.trim()
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
    typeof record.name === 'string'
      ? record.name.trim()
      : typeof record.title === 'string'
        ? record.title.trim()
        : '';
  const note =
    typeof record.note === 'string'
      ? record.note.trim()
      : (coerceGuideLine(record.description) ?? '');
  if (!name) return null;
  const bookingHint =
    typeof record.bookingHint === 'string'
      ? record.bookingHint.trim()
      : typeof record.booking_hint === 'string'
        ? record.booking_hint.trim()
        : undefined;
  return {
    name,
    note: note || '详见地图平台',
    bookingHint: bookingHint || undefined,
  };
}

function normalizeAccommodationScheme(
  item: unknown,
): TravelGuideAccommodationScheme | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const label =
    typeof record.label === 'string'
      ? record.label.trim()
      : typeof record.scheme === 'string'
        ? record.scheme.trim()
        : '';
  const name =
    typeof record.name === 'string'
      ? record.name.trim()
      : typeof record.title === 'string'
        ? record.title.trim()
        : '';
  const note =
    typeof record.note === 'string'
      ? record.note.trim()
      : (coerceGuideLine(record.description) ?? '');
  const reason =
    typeof record.reason === 'string'
      ? record.reason.trim()
      : (coerceGuideLine(record.rationale) ?? '');
  if (!name) return null;
  const bookingHint =
    typeof record.bookingHint === 'string'
      ? record.bookingHint.trim()
      : undefined;
  return {
    label: label || '住宿方案',
    name,
    note: note || '详见地图平台',
    reason: reason || '综合距离、预算与配套选择。',
    bookingHint: bookingHint || undefined,
  };
}

function normalizeSpot(item: unknown): TravelGuideSpotItem | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const name =
    typeof record.name === 'string'
      ? record.name.trim()
      : typeof record.title === 'string'
        ? record.title.trim()
        : '';
  const note =
    typeof record.note === 'string'
      ? record.note.trim()
      : (coerceGuideLine(record.description) ?? '');
  if (!name) return null;
  return { name, note: note || '详见地图平台' };
}

function normalizeTicketChannel(
  item: unknown,
): TravelGuideTicketChannel | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const name =
    typeof record.name === 'string'
      ? record.name.trim()
      : typeof record.channel === 'string'
        ? record.channel.trim()
        : '';
  const note =
    typeof record.note === 'string'
      ? record.note.trim()
      : (coerceGuideLine(record.description) ?? '');
  if (!name) return null;
  return { name, note: note || '以官方信息为准' };
}

function normalizeVenueTransportOption(
  item: unknown,
): TravelGuideVenueTransportOption | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const label =
    typeof record.label === 'string'
      ? record.label.trim()
      : typeof record.mode === 'string'
        ? record.mode.trim()
        : '';
  const lines = normalizeGuideLines(record.lines ?? record.items);
  if (!label || !lines.length) return null;
  return { label, lines };
}

function normalizeBudgetItem(item: unknown): TravelGuideBudgetItem | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const label =
    typeof record.label === 'string'
      ? record.label.trim()
      : typeof record.name === 'string'
        ? record.name.trim()
        : '';
  const range =
    typeof record.range === 'string'
      ? record.range.trim()
      : typeof record.amount === 'string'
        ? record.amount.trim()
        : '';
  if (!label || !range) return null;
  const note = typeof record.note === 'string' ? record.note.trim() : undefined;
  return { label, range, note: note || undefined };
}

function normalizeEssentials(
  raw: unknown,
): LlmTravelGuidePayload['essentials'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const network = normalizeGuideLines(record.network);
  const payment = normalizeGuideLines(record.payment);
  const apps = normalizeGuideLines(record.apps);
  if (!network.length && !payment.length && !apps.length) return undefined;
  return { network, payment, apps };
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
  const accommodationSchemes = Array.isArray(raw.accommodationSchemes)
    ? raw.accommodationSchemes
        .map((item) => normalizeAccommodationScheme(item))
        .filter((item): item is TravelGuideAccommodationScheme => item != null)
    : undefined;
  const parkingLines = raw.parkingLines
    ? normalizeGuideLines(raw.parkingLines)
    : undefined;
  const nightlifeSpots = Array.isArray(raw.nightlifeSpots)
    ? raw.nightlifeSpots
        .map((item) => normalizeSpot(item))
        .filter((item): item is TravelGuideSpotItem => item != null)
    : [];
  const tipItems = normalizeGuideLines(raw.tipItems);
  const documentItems = raw.documentItems
    ? normalizeGuideLines(raw.documentItems)
    : undefined;
  const ticketChannels = Array.isArray(raw.ticketChannels)
    ? raw.ticketChannels
        .map((item) => normalizeTicketChannel(item))
        .filter((item): item is TravelGuideTicketChannel => item != null)
    : undefined;
  const essentials = normalizeEssentials(raw.essentials);
  const venueTransportOptions = Array.isArray(raw.venueTransportOptions)
    ? raw.venueTransportOptions
        .map((item) => normalizeVenueTransportOption(item))
        .filter((item): item is TravelGuideVenueTransportOption => item != null)
    : undefined;
  const budgetItems = Array.isArray(raw.budgetItems)
    ? raw.budgetItems
        .map((item) => normalizeBudgetItem(item))
        .filter((item): item is TravelGuideBudgetItem => item != null)
    : undefined;

  return {
    transportLines,
    hotels,
    accommodationSchemes,
    parkingLines,
    nightlifeSpots,
    tipItems,
    documentItems,
    ticketChannels,
    essentials,
    venueTransportOptions,
    budgetItems,
  };
}
