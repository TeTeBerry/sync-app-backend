const ACTIVITY_LEGACY_ID_HEADER = 'x-activity-id';

function parsePositiveLegacyId(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const text = Array.isArray(raw) ? raw[0] : String(raw);
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/** Parse `X-Activity-Id` from HTTP headers (case-insensitive on Node). */
export function parseActivityLegacyIdHeader(
  headers: Record<string, string | string[] | undefined>,
): number | undefined {
  const raw =
    headers[ACTIVITY_LEGACY_ID_HEADER] ??
    headers['X-Activity-Id'] ??
    headers['X-ACTIVITY-ID'];
  return parsePositiveLegacyId(raw);
}

/** Parse `activityLegacyId` query param. */
export function parseActivityLegacyIdQuery(raw?: string): number | undefined {
  return parsePositiveLegacyId(raw);
}

/** First valid legacy id wins (body > connection scope > header). */
export function resolveEffectiveActivityLegacyId(
  ...sources: Array<number | undefined>
): number | undefined {
  for (const id of sources) {
    if (id != null && !Number.isNaN(id) && id > 0) {
      return Math.floor(id);
    }
  }
  return undefined;
}
