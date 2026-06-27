/**
 * Curated rejections: lineup display name → Discogs ids that must never be applied.
 * Used by apply-v4-pending-landings and manual fixes.
 */
export const REJECTED_DISCOGS_BY_LINEUP = {
  'AN!KA': [
    {
      discogsId: 1982320,
      reason:
        'Wrong person: Annika Henderson (dub/post-punk) ≠ Bangkok house/techno DJ AN!KA (Tomorrowland Thailand).',
    },
  ],
};

export function isLineupDiscogsRejected(lineupName, discogsId) {
  const upper = lineupName?.trim().toUpperCase();
  const id = Number(discogsId);
  if (!upper || !Number.isFinite(id)) {
    return null;
  }

  const rows = REJECTED_DISCOGS_BY_LINEUP[upper] ?? [];
  return rows.find((row) => row.discogsId === id) ?? null;
}

/** Curated web-only landing when Discogs has no acceptable page. */
export const CURATED_WEB_ONLY_LINEUP = {
  'AN!KA': {
    discogsName: 'AN!KA',
    hermesEvidence: {
      web: [
        {
          source: 'Beatport',
          url: 'https://www.beatport.com/artist/anka/1270927',
          snippet:
            'AN!KA — Bangkok DJ/producer on Pissawong Records (Turn Me On, house/techno).',
          relevance: 'high',
        },
        {
          source: 'Tomorrowland',
          url: 'https://tomorrowlandbelgium.press.tomorrowland.com/',
          snippet:
            'AN!KA on Tomorrowland Thailand Consciencia lineup (local Thai electronic artist).',
          relevance: 'medium',
        },
      ],
      sourcedFacts: [
        {
          claim: 'genre',
          value: 'House · Techno · Minimal',
          source: 'Beatport',
          sourceUrl: 'https://www.beatport.com/artist/anka/1270927',
        },
        {
          claim: 'country',
          value: 'Thailand',
          source: 'Lineup research',
        },
        {
          claim: 'label',
          value: 'Pissawong Records',
          source: 'Beatport',
        },
      ],
      integratedReport:
        'AN!KA is a Bangkok-based DJ and producer (house, disco, minimal, techno), ' +
        'not the British dub artist Anika / Annika Henderson (Discogs #1982320). ' +
        'Releases include Turn Me On on Pissawong Records; billed on Tomorrowland Thailand.',
    },
  },
};
