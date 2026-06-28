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
  'WES S': [
    {
      discogsId: 171280,
      reason:
        'Wrong person: v4 mapped to Partyraiser; WES S is a separate DnB alias (Bulletproof set), not the Partyraiser hardcore page.',
    },
  ],
  LARSTIG: [
    {
      discogsId: 16949755,
      reason:
        'Wrong person: Lars Ravenshorst ≠ hardstyle DJ LARSTIG (solo billing; duo page is LARSTIG & GASDROP).',
    },
  ],
  FIFI: [
    {
      discogsId: 883720,
      reason:
        'Wrong person: Fifi (6) is South African hip-hop/spoken-word, not LA DJ Sophia Ziskin (FIFI).',
    },
    {
      discogsId: 8056074,
      reason:
        'Wrong person: Fifi (26) is 2014–2015 European house compilations vocalist, not Sophia Ziskin.',
    },
  ],
  'DJ SALLY': [
    {
      discogsId: 4341801,
      reason:
        'Wrong person: Las Vegas DJ Sally Tuazon Zito ≠ Chinese tech house DJ SALLY (Tomorrowland / EDC China).',
    },
  ],
};

/** MusicBrainz MBIDs that must never be applied for a lineup display name. */
export const REJECTED_MB_BY_LINEUP = {
  'DJ SALLY': [
    {
      mbid: 'a1b332ba-592a-45df-bf12-b3f0e3c98fd4',
      reason:
        'Wrong person: Las Vegas DJ Sally Tuazon Zito ≠ Chinese tech house DJ SALLY.',
    },
  ],
};

/** Prefer this MB artist when multiple name matches exist (festival lineup context). */
export const PREFERRED_MB_BY_LINEUP = {
  'DJ SALLY': {
    mbid: '125f75fd-e2a9-4978-8099-02d9646fe1dd',
    reason: 'Chinese tech house DJ SALLY (Loop Goddess); no Discogs page.',
  },
};

export function isLineupMbRejected(lineupName, mbid) {
  const upper = lineupName?.trim().toUpperCase();
  const id = mbid?.trim();
  if (!upper || !id) {
    return null;
  }

  const rows = REJECTED_MB_BY_LINEUP[upper] ?? [];
  return rows.find((row) => row.mbid === id) ?? null;
}

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
  FIFI: {
    discogsName: 'FIFI',
    hermesEvidence: {
      web: [
        {
          source: 'Resident Advisor (via EDM Life)',
          url: 'https://edmlife.com/hollywood-park-is-about-to-get-very-loud-hard-summer-2026-lineup-revealed/',
          snippet:
            'HARD Summer 2026 lineup includes Fifi alongside house/techno selectors like Omar+, Sally C, Vintage Culture.',
          relevance: 'high',
        },
        {
          source: 'Web (WECANDANCE)',
          url: 'https://www.wecandance.be/artists/fifi',
          snippet:
            'Los Angeles DJ Sophia Ziskin, also known as FIFI — reggaeton, afrobeats, chunky house and pop.',
          relevance: 'high',
        },
        {
          source: 'Web (Rinse FM)',
          url: 'https://www.rinse.fm/shows/fifi',
          snippet:
            'Sophia Ziskin, better known as Fifi — house DJ; opened for Charli XCX, Jamie xx, Disclosure.',
          relevance: 'high',
        },
      ],
      sourcedFacts: [
        {
          claim: 'real_name',
          value: 'Sophia Ziskin',
          source: 'Web',
          sourceUrl: 'https://www.wecandance.be/artists/fifi',
        },
        {
          claim: 'genre',
          value: 'House · Club · Afro House',
          source: 'Web',
          sourceUrl: 'https://www.culturedmag.com/article/2025/07/08/muse-report-sophia-ziskin/',
        },
        {
          claim: 'country',
          value: 'United States',
          source: 'Web',
        },
      ],
      integratedReport:
        'FIFI is the stage name of Sophia Ziskin, an LA-based house/club DJ and producer. ' +
        'Discogs has no credible page for this artist; v3 candidate Fifi (6) #883720 is the wrong person (South African hip-hop). ' +
        'Web sources (HARD Summer 2026 lineup, WECANDANCE, Rinse FM) confirm identity, electronic DJ role, and festival context.',
    },
  },
};
