import {
  areRelatedCanonical,
  canonicalizeGenre,
  relatedGenreWeight,
} from './genre-normalization.util';
import type {
  LineupDjInput,
  RankedDiscoveryArtist,
} from './discovery-ranking.util';

export type ConstellationNode = {
  id: string;
  type: 'artist';
  artistId: string;
  label: string;
  category: 'picked' | 'adjacent' | 'wildcard' | 'neutral';
  relevance?: number;
  primaryGenre?: string;
  saved?: boolean;
};

export type ConstellationEdge = {
  source: string;
  target: string;
  strength: number;
  relationship:
    | 'taste-affinity'
    | 'genre-similarity'
    | 'related-genre'
    | 'saved-artist-similarity'
    | 'mood-connection'
    | 'festival-context';
  reasons: string[];
};

export type ConstellationGraph = {
  center: { id: 'user'; type: 'user'; label: 'YOU' };
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  nextExpansion?: { available: boolean; cursor?: string };
};

/**
 * Progressive semantic constellation — no layout coordinates.
 */
export function buildConstellationGraph(input: {
  roster: LineupDjInput[];
  discovery: {
    pickedForYou: RankedDiscoveryArtist[];
    newDiscoveries: RankedDiscoveryArtist[];
    wildcard?: RankedDiscoveryArtist;
  };
  savedIds: string[];
  focusArtistId?: string;
  mood?: string | null;
  limit?: number;
}): ConstellationGraph {
  const limit = input.limit ?? 5;
  const saved = new Set(input.savedIds);
  const byId = new Map(input.roster.map((dj) => [dj.id, dj]));

  const seed: RankedDiscoveryArtist[] = [
    ...input.discovery.pickedForYou,
    ...input.discovery.newDiscoveries,
    ...(input.discovery.wildcard ? [input.discovery.wildcard] : []),
  ];

  if (!input.focusArtistId) {
    const nodes: ConstellationNode[] = seed.slice(0, limit).map((artist) => ({
      id: artist.artistId,
      type: 'artist',
      artistId: artist.artistId,
      label: artist.name,
      category:
        artist.category === 'picked'
          ? 'picked'
          : artist.category === 'discovery'
            ? 'adjacent'
            : 'wildcard',
      relevance: artist.score,
      primaryGenre: artist.primaryGenre,
      saved: saved.has(artist.artistId),
    }));

    const edges: ConstellationEdge[] = nodes.map((node) => ({
      source: 'user',
      target: node.id,
      strength:
        node.category === 'picked'
          ? 0.9
          : node.category === 'adjacent'
            ? 0.62
            : 0.42,
      relationship: 'taste-affinity',
      reasons: [
        node.category === 'picked'
          ? 'Closest to artists you saved'
          : node.category === 'adjacent'
            ? 'A natural bridge from your recent path'
            : 'A defensible surprise on your edge',
      ],
    }));

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const ga = canonicalizeGenre(a.primaryGenre);
        const gb = canonicalizeGenre(b.primaryGenre);
        if (!ga || !gb || !areRelatedCanonical(ga, gb)) continue;
        edges.push({
          source: a.id,
          target: b.id,
          strength: relatedGenreWeight(ga, gb),
          relationship: ga === gb ? 'genre-similarity' : 'related-genre',
          reasons: [`Shared path through ${a.primaryGenre ?? ga}`],
        });
      }
    }

    return {
      center: { id: 'user', type: 'user', label: 'YOU' },
      nodes,
      edges,
      nextExpansion: {
        available: seed.length > limit || input.roster.length > limit,
        cursor: 'expand',
      },
    };
  }

  const focus = byId.get(input.focusArtistId);
  if (!focus) {
    return buildConstellationGraph({ ...input, focusArtistId: undefined });
  }

  const focusGenre = canonicalizeGenre(focus.genreLabel || focus.genre);
  const nearby = input.roster
    .filter((dj) => dj.id !== focus.id)
    .map((dj) => {
      const genre = canonicalizeGenre(dj.genreLabel || dj.genre);
      const bridge =
        focusGenre && genre ? relatedGenreWeight(focusGenre, genre) : 0;
      return { dj, bridge, genre };
    })
    .filter((item) => item.bridge >= 0.35 || saved.has(item.dj.id))
    .sort((a, b) => b.bridge - a.bridge)
    .slice(0, 6);

  const nodes: ConstellationNode[] = [
    {
      id: focus.id,
      type: 'artist',
      artistId: focus.id,
      label: focus.name,
      category: 'picked',
      relevance: 1,
      primaryGenre: focus.genreLabel || focus.genre,
      saved: saved.has(focus.id),
    },
    ...nearby.map((item) => ({
      id: item.dj.id,
      type: 'artist' as const,
      artistId: item.dj.id,
      label: item.dj.name,
      category: (saved.has(item.dj.id) ? 'picked' : 'adjacent') as
        | 'picked'
        | 'adjacent',
      relevance: item.bridge,
      primaryGenre: item.dj.genreLabel || item.dj.genre,
      saved: saved.has(item.dj.id),
    })),
  ];

  const edges: ConstellationEdge[] = [
    {
      source: 'user',
      target: focus.id,
      strength: 0.85,
      relationship: 'taste-affinity',
      reasons: ['Focused exploration from YOU'],
    },
    ...nearby.map((item) => ({
      source: focus.id,
      target: item.dj.id,
      strength: item.bridge,
      relationship: (item.bridge >= 0.9
        ? 'genre-similarity'
        : 'related-genre') as ConstellationEdge['relationship'],
      reasons: [
        item.genre && focusGenre
          ? `Connected through ${focus.genreLabel || focusGenre}`
          : 'Related sound in this festival',
      ],
    })),
  ];

  if (input.mood) {
    edges.push({
      source: 'user',
      target: focus.id,
      strength: 0.35,
      relationship: 'mood-connection',
      reasons: [`Fits the selected ${input.mood} mood`],
    });
  }

  return {
    center: { id: 'user', type: 'user', label: 'YOU' },
    nodes,
    edges,
    nextExpansion: { available: nearby.length >= 6, cursor: focus.id },
  };
}
