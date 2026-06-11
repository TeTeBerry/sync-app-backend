function parseSeedDemoDataFlag(): boolean | null {
  const raw = process.env.SEED_DEMO_DATA?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return null;
}

/** Demo DB writes (posts, comments, live-info, itinerary lineup, demo user profile). */
export function isDemoSeedEnabled(): boolean {
  const explicit = parseSeedDemoDataFlag();
  if (explicit != null) return explicit;
  return process.env.NODE_ENV !== 'production';
}
