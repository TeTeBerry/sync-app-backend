import {
  bumpDjCatalogCacheVersion,
  createDjModel,
} from './discogs-crawl.mjs';
import { createDjDiscogsMapModel } from './dj-discogs-map.mjs';
import { normalizeArtistNameKey } from './festival-lineup-fallback.mjs';
import {
  buildHermesCatalogProfileText,
  precomputeDisplayGenresFromHermesEvidence,
} from './web-only-dj-profile.mjs';
import { sanitizeCatalogGenreTokens } from './web-only-genre-normalize.mjs';

const WEAK_GENRE_EXACT = new Set(['electronic', 'dance', 'edm', 'pop']);

function isWeakGenreList(tokens = []) {
  const sanitized = sanitizeCatalogGenreTokens(tokens);
  if (!sanitized.length) {
    return true;
  }
  return sanitized.every((token) => WEAK_GENRE_EXACT.has(token.toLowerCase()));
}

function collectDjGenreTokens(dj) {
  return [...(dj?.styles ?? []), ...(dj?.genres ?? [])];
}

function collectMapGenreTokens(mapRow) {
  return [...(mapRow?.displayStyles ?? []), ...(mapRow?.displayGenres ?? [])];
}

/** True when persisted catalog genres/styles are empty or only weak placeholders. */
export function needsStyleInference(dj, mapRow) {
  return (
    isWeakGenreList(collectDjGenreTokens(dj)) &&
    isWeakGenreList(collectMapGenreTokens(mapRow))
  );
}

function collectInferenceTexts({ hermesEvidence, profileText }) {
  const texts = [];

  for (const fact of hermesEvidence?.sourcedFacts ?? []) {
    const claim = (fact.claim ?? '').trim();
    const value = fact.value?.trim();
    if (!value) {
      continue;
    }
    if (
      /genre|style|hint/i.test(claim) ||
      /^disambiguation$/i.test(claim)
    ) {
      texts.push(value);
    }
  }

  const report = hermesEvidence?.integratedReport?.trim();
  if (report) {
    texts.push(report);
  }

  for (const row of hermesEvidence?.web ?? []) {
    if (row.relevance === 'high' || row.relevance === 'medium') {
      const snippet = row.snippet?.trim();
      if (snippet) {
        texts.push(snippet);
      }
    }
  }

  const profile = profileText?.trim();
  if (profile) {
    texts.push(profile);
  }

  return texts;
}

/** Rule-based genre/style inference from Hermes evidence and/or profile bio text. */
export function inferCatalogGenresFromArtistContext({
  hermesEvidence = null,
  profileText = '',
} = {}) {
  const fromHermes = precomputeDisplayGenresFromHermesEvidence(hermesEvidence);
  const tokens = new Set(fromHermes.displayStyles);

  if (!tokens.size) {
    for (const text of collectInferenceTexts({ hermesEvidence, profileText })) {
      for (const token of sanitizeCatalogGenreTokens([text])) {
        tokens.add(token);
      }
    }
  }

  const genres = [...tokens];
  return {
    genres,
    styles: genres,
  };
}

function resolveLineupNameKeyFilter(lineupNames = []) {
  if (!lineupNames?.length) {
    return null;
  }
  return new Set(
    lineupNames
      .map((name) => normalizeArtistNameKey(name))
      .filter(Boolean),
  );
}

function resolveProfileText(mapRow, dj) {
  const djProfile = dj?.profile?.trim();
  if (djProfile) {
    return djProfile;
  }
  return buildHermesCatalogProfileText(mapRow?.hermesEvidence) || '';
}

/**
 * Infer and persist catalog genres/styles for mapped artists with profile bio
 * but empty or weak styles. Does not overwrite specific Discogs-derived styles.
 */
export async function inferDjStylesFromProfile({
  mongoose,
  dryRun = false,
  lineupNames = [],
  bumpCache = true,
  log = console.log,
} = {}) {
  const Dj = createDjModel(mongoose);
  const mapCollection = createDjDiscogsMapModel(mongoose).collection;
  const lineupNameKeyFilter = resolveLineupNameKeyFilter(lineupNames);

  const query = {
    status: 'mapped',
    discogsId: { $exists: true, $ne: null },
  };
  if (lineupNameKeyFilter) {
    query.lineupNameKey = { $in: [...lineupNameKeyFilter] };
  }

  const rows = await mapCollection.find(query).toArray();

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const dj = await Dj.findOne({ discogsId: row.discogsId }).lean();
    if (!dj) {
      skipped += 1;
      continue;
    }

    if (!needsStyleInference(dj, row)) {
      skipped += 1;
      continue;
    }

    const profileText = resolveProfileText(row, dj);
    if (!profileText) {
      skipped += 1;
      continue;
    }

    const inferred = inferCatalogGenresFromArtistContext({
      hermesEvidence: row.hermesEvidence,
      profileText,
    });
    if (!inferred.genres.length) {
      skipped += 1;
      continue;
    }

    log(
      `${dryRun ? '[dry-run] ' : ''}${row.lineupName} → #${row.discogsId}: ` +
        `styles=${inferred.styles.join(', ')}`,
    );

    if (!dryRun) {
      await Dj.updateOne(
        { discogsId: row.discogsId },
        {
          $set: {
            genres: inferred.genres,
            styles: inferred.styles,
          },
        },
      );
      await mapCollection.updateOne(
        { lineupNameKey: row.lineupNameKey },
        {
          $set: {
            displayGenres: inferred.genres,
            displayStyles: inferred.styles,
          },
        },
      );
    }

    updated += 1;
  }

  if (!dryRun && bumpCache && updated > 0) {
    await bumpDjCatalogCacheVersion();
  }

  return { updated, skipped, scanned: rows.length };
}
