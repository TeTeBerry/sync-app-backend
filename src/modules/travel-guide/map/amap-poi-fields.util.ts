/** Normalize Amap text fields that may arrive as string or string[]. */
export function formatAmapTextField(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((item) => formatAmapTextField(item))
      .filter(Boolean)
      .join('');
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '[]' ? '' : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

/** Parse Amap `location` ("lng,lat") which may arrive as string or string[]. */
export function parseAmapLocation(
  location?: unknown,
): { lat: number; lng: number } | null {
  const normalized = formatAmapTextField(location);
  if (!normalized) return null;
  const [lng, lat] = normalized.split(',').map((v) => Number(v.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Normalize Amap POI `biz_ext.cost` (string | number | array) to yuan per person. */
export function parseAmapCost(
  cost?: string | number | string[],
): number | undefined {
  if (cost == null) return undefined;
  if (typeof cost === 'number') {
    if (!Number.isFinite(cost) || cost <= 0) return undefined;
    return cost;
  }
  if (Array.isArray(cost)) {
    for (const item of cost) {
      const parsed = parseAmapCost(item);
      if (parsed != null) return parsed;
    }
    return undefined;
  }
  if (typeof cost !== 'string') return undefined;
  const trimmed = cost.trim();
  if (!trimmed || trimmed === '[]') return undefined;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num;
}
