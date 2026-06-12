export type LiveInfoZoneConfig = {
  id: string;
  label: string;
};

export const LIVE_INFO_VENUE_ZONE_ID = 'venue';

export const DEFAULT_LIVE_INFO_ZONES: LiveInfoZoneConfig[] = [
  { id: LIVE_INFO_VENUE_ZONE_ID, label: '全场' },
];

export const STORM_DEMO_LIVE_INFO_ZONES: LiveInfoZoneConfig[] = [
  { id: 'stage_a', label: 'A区' },
  { id: 'stage_b', label: 'B区' },
  { id: 'vip_booth', label: '卡座' },
  { id: LIVE_INFO_VENUE_ZONE_ID, label: '全场' },
];

export function resolveLiveInfoZones(
  activity?: { liveInfoZones?: LiveInfoZoneConfig[] } | null,
): LiveInfoZoneConfig[] {
  const configured = activity?.liveInfoZones?.filter(
    (z) => z.id?.trim() && z.label?.trim(),
  );
  if (configured?.length) {
    return configured.map((z) => ({
      id: z.id.trim(),
      label: z.label.trim(),
    }));
  }
  return [...DEFAULT_LIVE_INFO_ZONES];
}

export function zoneLabelForTag(
  zones: LiveInfoZoneConfig[],
  zoneTag?: string,
): string {
  const id = normalizeZoneTag(zoneTag);
  return zones.find((z) => z.id === id)?.label ?? '全场';
}

export function normalizeZoneTag(zoneTag?: string): string {
  const trimmed = zoneTag?.trim();
  return trimmed || LIVE_INFO_VENUE_ZONE_ID;
}

export function assertZoneTagAllowed(
  zoneTag: string,
  zones: LiveInfoZoneConfig[],
): void {
  const id = normalizeZoneTag(zoneTag);
  if (!zones.some((z) => z.id === id)) {
    throw new Error(`Invalid zoneTag: ${id}`);
  }
}

export function isZoneTagAllowed(
  zoneTag: string,
  zones: LiveInfoZoneConfig[],
): boolean {
  const id = normalizeZoneTag(zoneTag);
  return zones.some((z) => z.id === id);
}
