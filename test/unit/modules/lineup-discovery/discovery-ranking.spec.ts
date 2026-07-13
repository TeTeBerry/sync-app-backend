import {
  buildAffinityFromSignals,
  rankLineupDiscovery,
  type LineupDjInput,
} from '@src/modules/lineup-discovery/utils/discovery-ranking.util';
import {
  canonicalizeGenre,
  relatedGenreWeight,
} from '@src/modules/lineup-discovery/utils/genre-normalization.util';
import { buildFestivalDna } from '@src/modules/lineup-discovery/utils/festival-dna.util';
import { buildConstellationGraph } from '@src/modules/lineup-discovery/utils/constellation.util';
import {
  decayedWeight,
  LEGACY_PERSONALITY_WEIGHT,
  SIGNAL_BASE_WEIGHT,
} from '@src/modules/lineup-discovery/utils/taste-weights';

const roster: LineupDjInput[] = [
  {
    id: 'a1',
    name: 'Alpha',
    genre: 'Melodic Techno',
    genreLabel: 'Melodic Techno',
    popularity: 80,
  },
  {
    id: 'a2',
    name: 'Beta',
    genre: 'Progressive House',
    genreLabel: 'Progressive House',
    popularity: 70,
  },
  {
    id: 'a3',
    name: 'Gamma',
    genre: 'Trance',
    genreLabel: 'Trance',
    popularity: 75,
  },
  {
    id: 'a4',
    name: 'Delta',
    genre: 'Hard Techno',
    genreLabel: 'Hard Techno',
    popularity: 60,
  },
  {
    id: 'a5',
    name: 'Epsilon',
    genre: 'Deep House',
    genreLabel: 'Deep House',
    popularity: 55,
  },
  {
    id: 'a6',
    name: 'Zeta',
    genre: 'Dubstep',
    genreLabel: 'Dubstep',
    popularity: 50,
  },
  {
    id: 'a7',
    name: 'Eta',
    genre: 'Tech House',
    genreLabel: 'Tech House',
    popularity: 65,
  },
];

describe('genre normalization', () => {
  it('maps inconsistent labels to one canonical key', () => {
    expect(canonicalizeGenre('melodic-techno')).toBe('melodic-techno');
    expect(canonicalizeGenre('melodic techno')).toBe('melodic-techno');
    expect(canonicalizeGenre('Melodic Techno')).toBe('melodic-techno');
  });

  it('returns related genre weights from config', () => {
    expect(
      relatedGenreWeight('melodic-techno', 'progressive-house'),
    ).toBeGreaterThanOrEqual(0.8);
    expect(
      relatedGenreWeight('progressive-house', 'trance'),
    ).toBeGreaterThanOrEqual(0.7);
  });
});

describe('taste weights', () => {
  it('gives explicit saves higher base weight than single views', () => {
    expect(SIGNAL_BASE_WEIGHT.artist_saved).toBeGreaterThan(
      SIGNAL_BASE_WEIGHT.artist_viewed,
    );
    expect(SIGNAL_BASE_WEIGHT.artist_added_to_lineup).toBeGreaterThan(
      SIGNAL_BASE_WEIGHT.artist_viewed,
    );
  });

  it('decays views faster than saves', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const save = decayedWeight('artist_saved', 1, thirtyDaysAgo, now);
    const view = decayedWeight('artist_viewed', 0.12, thirtyDaysAgo, now);
    expect(save).toBeGreaterThan(view * 5);
  });

  it('keeps legacy personality weight below explicit saves', () => {
    expect(LEGACY_PERSONALITY_WEIGHT).toBeLessThan(
      SIGNAL_BASE_WEIGHT.artist_saved,
    );
    expect(LEGACY_PERSONALITY_WEIGHT).toBeLessThan(
      SIGNAL_BASE_WEIGHT.artist_added_to_lineup,
    );
  });
});

describe('discovery ranking', () => {
  it('does not require personality data for festival fallback', () => {
    const affinity = buildAffinityFromSignals({
      artistWeights: {},
      genreWeights: {},
      authenticated: false,
      hasClientSignals: false,
    });
    const result = rankLineupDiscovery({ roster, affinity });
    expect(result.mode).toBe('festival-fallback');
    expect(result.pickedForYou.length).toBeGreaterThan(0);
    expect(result.summary.pickedCount).toBe(result.pickedForYou.length);
  });

  it('personalizes from explicit saves without personality', () => {
    const affinity = buildAffinityFromSignals({
      artistWeights: { a1: 1 },
      genreWeights: { 'melodic-techno': 1 },
      authenticated: true,
      hasClientSignals: true,
    });
    const result = rankLineupDiscovery({ roster, affinity });
    expect(result.mode).toBe('personalized');
    expect(result.pickedForYou.every((a) => a.artistId !== 'a1')).toBe(true);
    const ids = [
      ...result.pickedForYou.map((a) => a.artistId),
      ...result.newDiscoveries.map((a) => a.artistId),
      ...(result.wildcard ? [result.wildcard.artistId] : []),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps categories distinct and wildcard defensible', () => {
    const affinity = buildAffinityFromSignals({
      artistWeights: { a1: 1, a2: 0.9 },
      genreWeights: {
        'melodic-techno': 1,
        'progressive-house': 0.9,
      },
      authenticated: false,
      hasClientSignals: true,
    });
    const result = rankLineupDiscovery({ roster, affinity, limit: 3 });
    const picked = new Set(result.pickedForYou.map((a) => a.artistId));
    for (const d of result.newDiscoveries) {
      expect(picked.has(d.artistId)).toBe(false);
      expect(d.category).toBe('discovery');
    }
    if (result.wildcard) {
      expect(picked.has(result.wildcard.artistId)).toBe(false);
      expect(result.wildcard.reasons).toContain('wildcard_bridge');
    }
  });

  it('applies mood as temporary ranking context', () => {
    const affinity = buildAffinityFromSignals({
      artistWeights: {},
      genreWeights: {},
      authenticated: false,
      hasClientSignals: false,
    });
    const heavy = rankLineupDiscovery({ roster, affinity, mood: 'heavy' });
    const heavyIds = [
      ...heavy.pickedForYou,
      ...heavy.newDiscoveries,
      ...(heavy.wildcard ? [heavy.wildcard] : []),
    ].map((a) => a.artistId);
    expect(heavyIds.some((id) => id === 'a4' || id === 'a6')).toBe(true);
    expect(
      [...heavy.pickedForYou, ...heavy.newDiscoveries].some((a) =>
        a.reasons.includes('mood_fit'),
      ),
    ).toBe(true);
  });

  it('lets recent explicit affinity outweigh empty personality', () => {
    const withSaves = buildAffinityFromSignals({
      artistWeights: { a1: 1 },
      genreWeights: { 'melodic-techno': 1 },
      authenticated: true,
      hasClientSignals: true,
    });
    const withLegacyOnly = buildAffinityFromSignals({
      artistWeights: {},
      genreWeights: { 'hard-techno': LEGACY_PERSONALITY_WEIGHT },
      authenticated: true,
      hasClientSignals: false,
    });
    const saved = rankLineupDiscovery({ roster, affinity: withSaves });
    const legacy = rankLineupDiscovery({ roster, affinity: withLegacyOnly });
    expect(saved.mode).toBe('personalized');
    expect(legacy.pickedForYou[0]?.artistId).not.toBe(
      saved.pickedForYou[0]?.artistId,
    );
  });
});

describe('festival dna', () => {
  it('is independent of user taste and reports coverage', () => {
    const dna = buildFestivalDna(roster);
    expect(dna.dataCoverage.artistCount).toBe(roster.length);
    expect(dna.dimensions.length).toBeGreaterThan(0);
    expect(
      dna.dimensions.every((d) => d.strength >= 0 && d.strength <= 1),
    ).toBe(true);
  });

  it('lowers confidence when metadata is sparse', () => {
    const sparse = buildFestivalDna([
      { id: 'x', name: 'Unknown', genre: '', genreLabel: '' },
      { id: 'y', name: 'Also', genre: 'Techno', genreLabel: 'Techno' },
    ]);
    expect(sparse.dataCoverage.enrichedArtistCount).toBe(1);
    if (sparse.dimensions.length) {
      expect(['low', 'medium']).toContain(sparse.dimensions[0]!.confidence);
    }
  });
});

describe('constellation', () => {
  it('returns progressive initial graph without layout coordinates', () => {
    const affinity = buildAffinityFromSignals({
      artistWeights: { a1: 1 },
      genreWeights: { 'melodic-techno': 1 },
      authenticated: false,
      hasClientSignals: true,
    });
    const discovery = rankLineupDiscovery({ roster, affinity, limit: 4 });
    const graph = buildConstellationGraph({
      roster,
      discovery,
      savedIds: ['a1'],
      limit: 5,
    });
    expect(graph.center.label).toBe('YOU');
    expect(graph.nodes.length).toBeLessThanOrEqual(5);
    expect(graph.nodes.every((n) => !('x' in n) && !('y' in n))).toBe(true);
    expect(graph.edges.some((e) => e.source === 'user')).toBe(true);
  });

  it('expands around focusArtistId with path explanations', () => {
    const affinity = buildAffinityFromSignals({
      artistWeights: { a1: 1 },
      genreWeights: { 'melodic-techno': 1 },
      authenticated: false,
      hasClientSignals: true,
    });
    const discovery = rankLineupDiscovery({ roster, affinity });
    const graph = buildConstellationGraph({
      roster,
      discovery,
      savedIds: ['a1'],
      focusArtistId: 'a2',
    });
    expect(graph.nodes.some((n) => n.artistId === 'a2')).toBe(true);
    expect(graph.edges.every((e) => e.reasons.length > 0)).toBe(true);
  });
});
