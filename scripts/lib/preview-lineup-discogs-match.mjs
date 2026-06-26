/**
 * Read-only v3 Discogs presearch for Hermes v4 (no Mongo writes).
 */
import { createDiscogsClient, getCrawlConfig } from './discogs-crawl.mjs';

/**
 * @param {{ lineupName: string; discogsToken?: string }} input
 */
export async function previewLineupDiscogsMatch({ lineupName, discogsToken }) {
  const config = getCrawlConfig();
  if (discogsToken?.trim()) {
    config.discogsToken = discogsToken.trim();
  }
  if (!config.discogsToken) {
    throw new Error('DISCOGS_TOKEN is required for presearch');
  }

  const client = createDiscogsClient(config);
  const result = await client.previewArtistMatch(lineupName);

  const candidateScores = Array.isArray(result.candidateScores)
    ? result.candidateScores.map((row) => ({
        discogsId: row.discogsId,
        name: row.name ?? '',
        score: row.total ?? 0,
      }))
    : [];

  return {
    status: result.status,
    discogsId: result.discogsId,
    discogsName: result.discogsName,
    matchScore: result.matchScore,
    reviewReason: result.reviewReason,
    searchQuery: result.searchQuery,
    discoveryStrategyId: result.discoveryStrategyId,
    candidates: candidateScores,
    profileExcerpt: result.prefetchedArtist?.profile?.slice(0, 280),
  };
}
