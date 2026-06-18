import type { ActivityLookupRecord } from './ports/activity-lookup.port';

export interface ActivityLookupCacheSnapshot {
  all: ActivityLookupRecord[];
  byLegacyId: Map<number, ActivityLookupRecord>;
  byCode: Map<string, ActivityLookupRecord>;
}

export function buildActivityLookupCache(
  records: ActivityLookupRecord[],
): ActivityLookupCacheSnapshot {
  const sorted = [...records].sort((a, b) => a.legacyId - b.legacyId);
  const byLegacyId = new Map<number, ActivityLookupRecord>();
  const byCode = new Map<string, ActivityLookupRecord>();

  for (const record of sorted) {
    byLegacyId.set(record.legacyId, record);
    if (record.code?.trim()) {
      byCode.set(record.code.toLowerCase().trim(), record);
    }
  }

  return { all: sorted, byLegacyId, byCode };
}
