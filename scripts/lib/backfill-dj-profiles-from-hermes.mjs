import {
  bumpDjCatalogCacheVersion,
  createDjModel,
} from './discogs-crawl.mjs';
import { createDjDiscogsMapModel } from './dj-discogs-map.mjs';
import { normalizeArtistNameKey } from './festival-lineup-fallback.mjs';
import {
  buildHermesCatalogProfileText,
  isHermesWebOnlyMap,
} from './web-only-dj-profile.mjs';

function collectUrls(hermesEvidence) {
  const urls = new Set();
  for (const row of hermesEvidence?.web ?? []) {
    if (row.url?.trim()) {
      urls.add(row.url.trim());
    }
  }
  if (hermesEvidence?.musicbrainz?.url?.trim()) {
    urls.add(hermesEvidence.musicbrainz.url.trim());
  }
  for (const fact of hermesEvidence?.sourcedFacts ?? []) {
    if (fact.sourceUrl?.trim()) {
      urls.add(fact.sourceUrl.trim());
    }
  }
  return [...urls];
}

function resolveCountry(sourcedFacts = []) {
  for (const fact of sourcedFacts) {
    if (/country|origin|based/i.test(fact.claim ?? '')) {
      const value = fact.value?.trim();
      if (value) {
        return value;
      }
    }
  }
  return '';
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

/**
 * Copy stored Hermes evidence on mapped Discogs rows into `djs.profile`.
 * Web-only maps are handled by rebuild-web-only-djs.
 */
export async function backfillDjProfilesFromHermes({
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
    hermesEvidence: { $exists: true, $ne: null },
  };
  if (lineupNameKeyFilter) {
    query.lineupNameKey = { $in: [...lineupNameKeyFilter] };
  }

  const rows = await mapCollection.find(query).toArray();

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isHermesWebOnlyMap(row) || !row.hermesEvidence || !row.discogsId) {
      skipped += 1;
      continue;
    }

    const profile = buildHermesCatalogProfileText(row.hermesEvidence);
    if (!profile) {
      skipped += 1;
      continue;
    }

    const dj = await Dj.findOne({ discogsId: row.discogsId }).lean();
    if (!dj) {
      skipped += 1;
      continue;
    }

    if (dj.profile?.trim()) {
      skipped += 1;
      continue;
    }

    const patch = { profile };
    const country = resolveCountry(row.hermesEvidence.sourcedFacts);
    if (!dj.country?.trim() && country) {
      patch.country = country;
    }

    const extraUrls = collectUrls(row.hermesEvidence);
    if (extraUrls.length) {
      patch.urls = [...new Set([...(dj.urls ?? []), ...extraUrls])];
    }

    log(
      `${dryRun ? '[dry-run] ' : ''}${row.lineupName} → #${row.discogsId}: profile=${profile.slice(0, 60)}…`,
    );

    if (!dryRun) {
      await Dj.updateOne({ discogsId: row.discogsId }, { $set: patch });
    }
    updated += 1;
  }

  if (!dryRun && bumpCache && updated > 0) {
    await bumpDjCatalogCacheVersion();
  }

  return { updated, skipped, scanned: rows.length };
}
