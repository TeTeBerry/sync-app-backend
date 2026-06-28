import { getLineupVerifyNameVariants } from './lineup-real-artist-catalog.mjs';
import {
  extractDiscogsUrlFromArtist,
  lineupNameMatchesMbArtist,
} from './musicbrainz-client.mjs';

export function classifyMbMatch(lineupName, hits) {
  if (!hits.length) {
    return 'no_match';
  }

  const top = hits[0];
  if (Number(top.score) >= 95 || lineupNameMatchesMbArtist(lineupName, top)) {
    return 'strong_match';
  }
  if (Number(top.score) >= 80) {
    return 'possible_match';
  }
  return 'weak_match';
}

export function summarizeMbArtist(artist) {
  const aliases = (artist.aliases ?? [])
    .slice(0, 8)
    .map((row) => row.name)
    .filter(Boolean);
  const tags = (artist.tags ?? [])
    .slice(0, 8)
    .map((row) => row.name)
    .filter(Boolean);

  return {
    mbid: artist.id,
    name: artist.name,
    sortName: artist['sort-name'] ?? '',
    type: artist.type ?? '',
    country: artist.country ?? '',
    disambiguation: artist.disambiguation ?? '',
    score: artist.score ?? null,
    aliases,
    tags,
    url: artist.id ? `https://musicbrainz.org/artist/${artist.id}` : '',
    discogsUrl: extractDiscogsUrlFromArtist(artist),
  };
}

export async function searchLineupArtistOnMusicBrainz(mb, lineupName) {
  const variants = getLineupVerifyNameVariants(lineupName);
  const queries = [...new Set(variants)].slice(0, 4);
  let bestHits = [];
  let usedQuery = '';

  for (const queryName of queries) {
    const query = mb.buildArtistQuery(queryName);
    const payload = await mb.searchArtists(query, { limit: 5 });
    const artists = payload.artists ?? [];
    if (!artists.length) {
      continue;
    }

    if (!bestHits.length || Number(artists[0].score) > Number(bestHits[0].score)) {
      bestHits = artists;
      usedQuery = queryName;
    }

    if (Number(artists[0].score) >= 95) {
      break;
    }
  }

  const matchClass = classifyMbMatch(lineupName, bestHits);
  let topDetail = null;

  if (
    bestHits.length &&
    (matchClass === 'strong_match' || matchClass === 'possible_match')
  ) {
    try {
      const detail = await mb.lookupArtist(bestHits[0].id, {
        inc: 'aliases+tags+url-rels',
      });
      topDetail = summarizeMbArtist({ ...detail, score: bestHits[0].score });
    } catch (error) {
      topDetail = {
        ...summarizeMbArtist(bestHits[0]),
        lookupError: error.message ?? String(error),
      };
    }
  }

  return {
    lineupName,
    searchQueries: queries,
    usedQuery,
    matchClass,
    hitCount: bestHits.length,
    topHits: bestHits.slice(0, 3).map(summarizeMbArtist),
    topDetail,
  };
}

export function isMbMatchClassLandable(matchClass, minMatch = 'strong') {
  if (matchClass === 'strong_match') {
    return true;
  }
  if (minMatch === 'possible' && matchClass === 'possible_match') {
    return true;
  }
  return false;
}
