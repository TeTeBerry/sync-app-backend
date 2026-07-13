import type { TasteSignalType } from '@src/database/schemas/taste-signal.schema';

/** Centralized confidence — never hardcode in controllers. */
export const SIGNAL_BASE_WEIGHT: Record<TasteSignalType, number> = {
  artist_saved: 1,
  artist_favorited: 1,
  artist_added_to_lineup: 0.95,
  journey_artist_added: 0.9,
  recommendation_saved: 0.95,
  artist_unsaved: -0.7,
  artist_removed_from_lineup: -0.7,
  journey_artist_removed: -0.6,
  artist_detail_engaged: 0.45,
  constellation_path_explored: 0.4,
  constellation_artist_opened: 0.35,
  journey_generated: 0.35,
  mood_selected: 0.3,
  artist_viewed: 0.12,
  wildcard_opened: 0.15,
  festival_viewed: 0.08,
  festival_saved: 0.55,
};

/** Half-life in days for recency decay. */
export const SIGNAL_HALF_LIFE_DAYS: Record<TasteSignalType, number> = {
  artist_saved: 120,
  artist_favorited: 120,
  artist_added_to_lineup: 90,
  journey_artist_added: 60,
  recommendation_saved: 90,
  artist_unsaved: 30,
  artist_removed_from_lineup: 30,
  journey_artist_removed: 30,
  artist_detail_engaged: 21,
  constellation_path_explored: 14,
  constellation_artist_opened: 14,
  journey_generated: 21,
  mood_selected: 3,
  artist_viewed: 7,
  wildcard_opened: 7,
  festival_viewed: 14,
  festival_saved: 60,
};

export const LEGACY_PERSONALITY_WEIGHT = 0.18;
export const ANONYMOUS_SIGNAL_TTL_DAYS = 90;

/** Discovery ranking baseline when only genres + behavior exist. */
export const DISCOVERY_SCORE_WEIGHTS = {
  explicitAffinity: 0.35,
  lineupJourneyOverlap: 0.25,
  genreSimilarity: 0.2,
  relatedGenre: 0.1,
  recency: 0.05,
  discoveryBonus: 0.05,
} as const;

export function decayedWeight(
  signalType: TasteSignalType,
  baseWeight: number,
  occurredAt: Date,
  now = new Date(),
): number {
  const halfLife = SIGNAL_HALF_LIFE_DAYS[signalType] ?? 30;
  const ageDays = Math.max(
    0,
    (now.getTime() - occurredAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const factor = Math.pow(0.5, ageDays / halfLife);
  return baseWeight * factor;
}
