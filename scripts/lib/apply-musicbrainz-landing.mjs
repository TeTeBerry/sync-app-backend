import { lineupNameKeyFor } from './dj-discogs-map.mjs';
import { isLineupDiscogsRejected, isLineupMbRejected } from './lineup-rejected-discogs.mjs';
import { parseDiscogsIdFromUrl } from './musicbrainz-client.mjs';
import { isMbMatchClassLandable } from './musicbrainz-lineup-lookup.mjs';
import { verifyLineupDiscogsMatch } from './verify-lineup-discogs-match.mjs';
import {
  allocateSyntheticDiscogsId,
  buildWebOnlyDjRecord,
  precomputeDisplayGenresFromHermesEvidence,
} from './web-only-dj-profile.mjs';
import { sanitizeCatalogGenreTokens } from './web-only-genre-normalize.mjs';

const MATCH_SCORE = {
  strong_match: 190,
  possible_match: 165,
};

export function buildMusicBrainzHermesEvidence(lineupName, detail) {
  const facts = [
    {
      claim: 'MusicBrainz artist',
      value: detail.name,
      source: 'MusicBrainz',
      sourceUrl: detail.url,
    },
  ];

  if (detail.type) {
    facts.push({
      claim: 'Artist type',
      value: detail.type,
      source: 'MusicBrainz',
      sourceUrl: detail.url,
    });
  }
  if (detail.country) {
    facts.push({
      claim: 'Country',
      value: detail.country,
      source: 'MusicBrainz',
      sourceUrl: detail.url,
    });
  }
  if (detail.disambiguation) {
    facts.push({
      claim: 'Disambiguation',
      value: detail.disambiguation,
      source: 'MusicBrainz',
      sourceUrl: detail.url,
    });
  }
  if (detail.aliases?.length) {
    facts.push({
      claim: 'Aliases',
      value: detail.aliases.join(', '),
      source: 'MusicBrainz',
      sourceUrl: detail.url,
    });
  }
  if (detail.tags?.length) {
    facts.push({
      claim: 'Genre tags',
      value: detail.tags.join(', '),
      source: 'MusicBrainz',
      sourceUrl: detail.url,
    });
  }
  if (detail.discogsUrl) {
    facts.push({
      claim: 'Discogs url-relation',
      value: detail.discogsUrl,
      source: 'MusicBrainz',
      sourceUrl: detail.url,
    });
  }

  const bullets = [
    `- **MusicBrainz**: [${detail.name}](${detail.url})`,
    detail.type ? `- 类型: ${detail.type}` : null,
    detail.disambiguation ? `- 说明: ${detail.disambiguation}` : null,
    detail.country ? `- 国家: ${detail.country}` : null,
    detail.tags?.length ? `- 标签: ${detail.tags.join(', ')}` : null,
    detail.discogsUrl ? `- Discogs 关联: ${detail.discogsUrl}` : null,
  ].filter(Boolean);

  return {
    musicbrainz: {
      name: detail.name,
      url: detail.url,
    },
    sourcedFacts: facts,
    integratedReport: [`### ${lineupName}`, '', ...bullets].join('\n'),
  };
}

export function displayGenresFromMbDetail(detail) {
  return sanitizeCatalogGenreTokens(detail.tags ?? []);
}

export function hasLandableMbProfile(detail) {
  if (!detail) {
    return false;
  }
  if (parseDiscogsIdFromUrl(detail.discogsUrl)) {
    return true;
  }
  if (displayGenresFromMbDetail(detail).length > 0) {
    return true;
  }
  if (detail.disambiguation?.trim()) {
    return true;
  }
  if (detail.type?.trim() && detail.country?.trim()) {
    return true;
  }
  return false;
}

export function planMusicBrainzLanding({
  lineupName,
  lookup,
  minMatch = 'strong',
  allowWebOnly = true,
}) {
  if (!lookup?.topDetail) {
    return {
      lineupName,
      action: 'skip',
      reason: lookup?.matchClass ?? 'no_match',
    };
  }

  if (!isMbMatchClassLandable(lookup.matchClass, minMatch)) {
    return {
      lineupName,
      action: 'skip',
      reason: lookup.matchClass,
    };
  }

  const detail = lookup.topDetail;
  if (detail?.mbid && isLineupMbRejected(lineupName, detail.mbid)) {
    return {
      lineupName,
      action: 'skip',
      reason: 'mb_rejected',
      matchClass: lookup.matchClass,
    };
  }

  const discogsId = parseDiscogsIdFromUrl(detail.discogsUrl);
  if (discogsId) {
    return {
      lineupName,
      action: 'discogs',
      matchClass: lookup.matchClass,
      detail,
      discogsId,
      discogsName: detail.name,
      matchScore: MATCH_SCORE[lookup.matchClass] ?? 165,
    };
  }

  if (!allowWebOnly || !hasLandableMbProfile(detail)) {
    return {
      lineupName,
      action: 'skip',
      reason: 'mb_no_discogs_and_insufficient_tags',
      matchClass: lookup.matchClass,
    };
  }

  return {
    lineupName,
    action: 'mb_web_only',
    matchClass: lookup.matchClass,
    detail,
    matchScore: MATCH_SCORE[lookup.matchClass] ?? 165,
  };
}

export async function applyMusicBrainzLanding({
  plan,
  mapCollection,
  Dj,
  discogs,
  discogsToken,
  verify = true,
  dryRun = false,
}) {
  if (plan.action === 'skip') {
    return { ...plan, status: 'skipped' };
  }

  const { lineupName, detail, matchScore } = plan;
  const hermesEvidence = buildMusicBrainzHermesEvidence(lineupName, detail);
  const mbDisplayGenres = displayGenresFromMbDetail(detail);
  const { displayGenres: evidenceGenres, displayStyles } =
    precomputeDisplayGenresFromHermesEvidence(hermesEvidence);
  const displayGenres = [
    ...new Set([...mbDisplayGenres, ...evidenceGenres]),
  ];
  const now = new Date();

  if (plan.action === 'discogs') {
    const rejected = isLineupDiscogsRejected(lineupName, plan.discogsId);
    if (rejected) {
      return {
        ...plan,
        status: 'rejected',
        reason: rejected.reason,
      };
    }

    if (verify) {
      const verifyResult = await verifyLineupDiscogsMatch({
        lineupName,
        discogsId: plan.discogsId,
        discogsToken,
      });
      if (!verifyResult.accepted) {
        return {
          ...plan,
          status: 'verify_rejected',
          reason: verifyResult.reviewReason,
          discogsName: verifyResult.discogsName,
        };
      }
    }

    if (dryRun) {
      return {
        ...plan,
        status: 'dry_run',
        landing: 'discogs',
        displayGenres,
      };
    }

    const data = await discogs.buildDjRecord(plan.discogsId);
    if (!discogs.isVerifiableDiscogsDjRecord(data)) {
      const mergedGenres = [
        ...new Set([...(data.genres ?? []), ...displayGenres]),
      ];
      const mergedStyles = [
        ...new Set([...(data.styles ?? []), ...displayStyles, ...displayGenres]),
      ];
      if (!mergedGenres.length && !mergedStyles.length && !data.profile?.trim()) {
        return {
          ...plan,
          status: 'skip',
          reason: 'thin_discogs_record',
        };
      }
      if (mergedGenres.length) {
        data.genres = mergedGenres;
      }
      if (mergedStyles.length) {
        data.styles = mergedStyles;
      }
    }

    await Dj.updateOne(
      { discogsId: plan.discogsId },
      { $set: { ...data, crawledAt: now } },
      { upsert: true },
    );

    await mapCollection.updateOne(
      { lineupNameKey: lineupNameKeyFor(lineupName) },
      {
        $set: {
          lineupName: lineupName.trim(),
          lineupNameKey: lineupNameKeyFor(lineupName),
          status: 'mapped',
          discogsId: plan.discogsId,
          discogsName: data.name || plan.discogsName,
          matchScore,
          searchQuery: `mb:${detail.mbid}`,
          discoveryStrategyId: 'musicbrainz-discogs',
          reviewReason: '',
          source: 'musicbrainz-discogs',
          mappedAt: now,
          reviewedAt: now,
          hermesEvidence,
          displayGenres,
          displayStyles: displayStyles.length ? displayStyles : displayGenres,
          candidateScores: [
            {
              discogsId: plan.discogsId,
              name: data.name || plan.discogsName,
              total: matchScore,
            },
          ],
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    return {
      ...plan,
      status: 'applied',
      landing: 'discogs',
      discogsName: data.name,
      displayGenres,
    };
  }

  if (plan.action === 'mb_web_only') {
    const syntheticId = allocateSyntheticDiscogsId(lineupName);
    const djRecord = buildWebOnlyDjRecord({
      lineupName,
      discogsName: detail.name,
      hermesEvidence,
      discogsId: syntheticId,
    });

    if (dryRun) {
      return {
        ...plan,
        status: 'dry_run',
        landing: 'mb_web_only',
        discogsId: syntheticId,
        displayGenres,
      };
    }

    await Dj.updateOne(
      { discogsId: syntheticId },
      { $set: { ...djRecord, crawledAt: now } },
      { upsert: true },
    );

    await mapCollection.updateOne(
      { lineupNameKey: lineupNameKeyFor(lineupName) },
      {
        $set: {
          lineupName: lineupName.trim(),
          lineupNameKey: lineupNameKeyFor(lineupName),
          status: 'mapped',
          discogsId: syntheticId,
          discogsName: detail.name,
          matchScore,
          searchQuery: `mb:${detail.mbid}`,
          discoveryStrategyId: 'musicbrainz-web',
          reviewReason: '',
          source: 'musicbrainz-web',
          mappedAt: now,
          reviewedAt: now,
          hermesEvidence,
          displayGenres,
          displayStyles: displayGenres,
          updatedAt: now,
        },
        $unset: { candidateScores: '' },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    return {
      ...plan,
      status: 'applied',
      landing: 'mb_web_only',
      discogsId: syntheticId,
      displayGenres,
    };
  }

  return { ...plan, status: 'skipped', reason: 'unknown_action' };
}
