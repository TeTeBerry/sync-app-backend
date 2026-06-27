import {
  deleteDjDiscogsMapEntry,
  lineupNameKeyFor,
} from './dj-discogs-map.mjs';
import {
  findV4BundleForLineupName,
  loadV4RunBundles,
  resolveLatestV4RunJsonPath,
} from './v4-run-bundle-index.mjs';
import {
  expandRealSoloArtistTargets,
  hasMappedRealArtistData,
} from './lineup-real-artist-catalog.mjs';
import { shouldSkipV4BundleForLineup } from './lineup-billing-guards.mjs';
import {
  allocateSyntheticDiscogsId,
  buildWebOnlyDjRecord,
  isSyntheticDiscogsId,
  precomputeDisplayGenresFromHermesEvidence,
} from './web-only-dj-profile.mjs';
import { verifyLineupDiscogsMatch } from './verify-lineup-discogs-match.mjs';
import {
  CURATED_WEB_ONLY_LINEUP,
  isLineupDiscogsRejected,
} from './lineup-rejected-discogs.mjs';

const CONFIDENCE_RANK = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function confidenceToMatchScore(confidence) {
  switch (confidence) {
    case 'high':
      return 200;
    case 'medium':
      return 170;
    case 'low':
      return 140;
    default:
      return 120;
  }
}

export function buildHermesEvidenceFromV4Bundle(bundle) {
  return {
    web: bundle.web ?? [],
    musicbrainz: bundle.musicbrainz
      ? {
          name: bundle.musicbrainz.name,
          url:
            bundle.musicbrainz.url ??
            (bundle.musicbrainz.mbid
              ? `https://musicbrainz.org/artist/${bundle.musicbrainz.mbid}`
              : undefined),
        }
      : undefined,
    sourcedFacts: bundle.sourcedFacts ?? [],
    integratedReport: bundle.integratedReport ?? '',
  };
}

export function shouldApplyV4Bundle(bundle, options = {}) {
  const minConfidence = options.minConfidence ?? 'medium';
  const minRank = CONFIDENCE_RANK[minConfidence] ?? CONFIDENCE_RANK.medium;
  const rank = CONFIDENCE_RANK[bundle.confidence ?? 'none'] ?? 0;

  if (!bundle.discogs?.id) {
    return false;
  }

  if (bundle.decision !== 'pending_review' && bundle.decision !== 'mapped') {
    return false;
  }

  return rank >= minRank;
}

export function planV4PendingLandings({
  missingArtists,
  v4RunPath,
  minConfidence = 'medium',
  runsDir,
}) {
  const jsonPath = v4RunPath ?? resolveLatestV4RunJsonPath(runsDir);
  if (!jsonPath) {
    throw new Error('No v4 run JSON found');
  }

  const v4Run = loadV4RunBundles(jsonPath);
  const planned = [];
  const skipped = [];

  for (const missingArtist of missingArtists) {
    const { bundle, matchedVia, sourceDisplay } = findV4BundleForLineupName(
      missingArtist.lineupName,
      v4Run,
    );

    if (!bundle) {
      skipped.push({
        lineupName: missingArtist.lineupName,
        reason: 'no_v4_bundle',
      });
      continue;
    }

    if (!shouldApplyV4Bundle(bundle, { minConfidence })) {
      skipped.push({
        lineupName: missingArtist.lineupName,
        reason: 'below_min_confidence_or_no_discogs',
        v4Decision: bundle.decision,
        v4Confidence: bundle.confidence,
        discogsId: bundle.discogs?.id ?? null,
      });
      continue;
    }

    const applyGuard = shouldSkipV4BundleForLineup({
      lineupName: missingArtist.lineupName,
      matchedVia,
      sourceDisplay,
      discogsName: bundle.discogs?.name ?? '',
      expandRealSoloArtistTargets,
    });
    if (applyGuard.skip) {
      skipped.push({
        lineupName: missingArtist.lineupName,
        reason: applyGuard.reason,
        matchedVia,
        sourceDisplay: sourceDisplay ?? null,
        discogsId: bundle.discogs?.id ?? null,
        discogsName: bundle.discogs?.name ?? null,
      });
      continue;
    }

    planned.push({
      lineupName: missingArtist.lineupName,
      issue: missingArtist.issue,
      matchedVia,
      sourceDisplay: sourceDisplay ?? null,
      v4Decision: bundle.decision,
      v4Confidence: bundle.confidence,
      discogsId: bundle.discogs.id,
      discogsName: bundle.discogs.name,
      bundle,
    });
  }

  return {
    v4RunPath: v4Run.path,
    v4RunId: v4Run.runId,
    planned,
    skipped,
  };
}

export async function verifyBundleForApply(bundle, lineupName, options = {}) {
  if (!bundle.discogs?.id) {
    return { accepted: false, reviewReason: 'no discogs id' };
  }

  const rejected = isLineupDiscogsRejected(lineupName, bundle.discogs.id);
  if (rejected) {
    return { accepted: false, reviewReason: rejected.reason };
  }

  const applyGuard = shouldSkipV4BundleForLineup({
    lineupName,
    matchedVia: options.matchedVia ?? null,
    sourceDisplay: options.sourceDisplay ?? null,
    discogsName: bundle.discogs?.name ?? '',
    expandRealSoloArtistTargets,
  });
  if (applyGuard.skip) {
    return { accepted: false, reviewReason: applyGuard.reason };
  }

  if (options.verify === false) {
    return { accepted: true };
  }

  const result = await verifyLineupDiscogsMatch({
    lineupName,
    discogsId: bundle.discogs.id,
    discogsToken: options.discogsToken,
  });

  return {
    accepted: result.accepted,
    reviewReason: result.reviewReason,
    matchScore: result.matchScore,
    discogsName: result.discogsName,
  };
}

export async function purgeAllManualStubMaps({
  mapCollection,
  Dj,
  dryRun = false,
} = {}) {
  const stubs = await mapCollection
    .find({ source: 'manual-stub' })
    .project({ lineupName: 1, discogsId: 1 })
    .toArray();

  const purged = [];
  for (const row of stubs) {
    const lineupName = row.lineupName?.trim();
    if (!lineupName) {
      continue;
    }
    if (dryRun) {
      purged.push(lineupName);
      continue;
    }
    await deleteDjDiscogsMapEntry(mapCollection, lineupName);
    if (row.discogsId) {
      await Dj.deleteOne({ discogsId: row.discogsId });
    }
    purged.push(lineupName);
  }

  return purged;
}

export async function purgeManualStubForLineup({
  mapCollection,
  Dj,
  lineupName,
  dryRun = false,
}) {
  const existing = await mapCollection.findOne({
    lineupNameKey: lineupNameKeyFor(lineupName),
    source: 'manual-stub',
  });
  if (!existing) {
    return false;
  }

  if (dryRun) {
    return true;
  }

  await deleteDjDiscogsMapEntry(mapCollection, lineupName);
  if (existing.discogsId) {
    await Dj.deleteOne({ discogsId: existing.discogsId });
  }
  return true;
}

export async function applyV4DiscogsLanding({
  mapCollection,
  Dj,
  discogs,
  lineupName,
  bundle,
  v4RunId,
  dryRun = false,
}) {
  const discogsId = Number(bundle.discogs.id);
  const discogsName = bundle.discogs?.name?.trim() ?? '';
  const hermesEvidence = buildHermesEvidenceFromV4Bundle(bundle);
  const { displayGenres, displayStyles } =
    precomputeDisplayGenresFromHermesEvidence(hermesEvidence);
  const now = new Date();
  const matchScore = confidenceToMatchScore(bundle.confidence);

  if (dryRun) {
    return {
      status: 'dry_run',
      lineupName,
      discogsId,
      discogsName,
    };
  }

  const data = await discogs.buildDjRecord(discogsId);
  if (!discogs.isVerifiableDiscogsDjRecord(data)) {
    throw new Error(`Discogs #${discogsId} 资料未通过校验`);
  }

  await Dj.updateOne(
    { discogsId },
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
        discogsId,
        discogsName: discogsName || data.name,
        matchScore,
        searchQuery: `v4-apply:#${discogsId}`,
        discoveryStrategyId: 'hermes-v4-apply',
        reviewReason: '',
        source: 'hermes-v4-apply',
        mappedAt: now,
        reviewedAt: now,
        hermesV4RunId: v4RunId,
        hermesV4ResearchedAt: bundle.researchedAt ?? now.toISOString(),
        hermesEvidence,
        displayGenres,
        displayStyles,
        candidateScores: [
          {
            discogsId,
            name: discogsName || data.name,
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
    status: 'applied',
    lineupName,
    discogsId,
    discogsName: discogsName || data.name,
  };
}

export async function applyV4PendingLandings({
  missingArtists,
  mapCollection,
  Dj,
  discogs,
  v4RunPath,
  minConfidence = 'medium',
  dryRun = false,
  purgeStub = true,
  limit = 0,
  nameFilter = null,
  verify = true,
  discogsToken,
  mapByKey = null,
  djById = null,
}) {
  const plan = planV4PendingLandings({
    missingArtists,
    v4RunPath,
    minConfidence,
  });

  let targets = plan.planned;
  if (nameFilter?.length) {
    const allowed = new Set(nameFilter.map((name) => name.trim().toUpperCase()));
    targets = targets.filter((row) =>
      allowed.has(row.lineupName.trim().toUpperCase()),
    );
  }
  if (limit > 0) {
    targets = targets.slice(0, limit);
  }

  const results = {
    v4RunPath: plan.v4RunPath,
    v4RunId: plan.v4RunId,
    applied: [],
    stubPurged: [],
    failed: [],
    verifyRejected: [],
    skipped: plan.skipped,
  };

  for (const target of targets) {
    try {
      if (mapByKey && djById) {
        const mapRow = mapByKey.get(lineupNameKeyFor(target.lineupName)) ?? null;
        const dj = mapRow?.discogsId ? djById.get(mapRow.discogsId) ?? null : null;
        if (hasMappedRealArtistData(mapRow, dj)) {
          results.skipped.push({
            lineupName: target.lineupName,
            reason: 'already_has_real_profile',
          });
          continue;
        }
      }

      const verification = await verifyBundleForApply(target.bundle, target.lineupName, {
        verify,
        discogsToken,
        matchedVia: target.matchedVia,
        sourceDisplay: target.sourceDisplay,
      });
      if (!verification.accepted) {
        results.verifyRejected.push({
          lineupName: target.lineupName,
          discogsId: target.discogsId,
          reviewReason: verification.reviewReason ?? 'verify rejected',
        });
        continue;
      }

      if (purgeStub && target.issue === 'manual_stub') {
        const purged = await purgeManualStubForLineup({
          mapCollection,
          Dj,
          lineupName: target.lineupName,
          dryRun,
        });
        if (purged) {
          results.stubPurged.push(target.lineupName);
        }
      }

      const outcome = await applyV4DiscogsLanding({
        mapCollection,
        Dj,
        discogs,
        lineupName: target.lineupName,
        bundle: target.bundle,
        v4RunId: plan.v4RunId,
        dryRun,
      });
      results.applied.push({
        ...outcome,
        v4Confidence: target.v4Confidence,
        matchedVia: target.matchedVia,
        sourceDisplay: target.sourceDisplay,
        verifyMatchScore: verification.matchScore,
      });
    } catch (error) {
      results.failed.push({
        lineupName: target.lineupName,
        discogsId: target.discogsId,
        error: error.message ?? String(error),
      });
    }
  }

  return results;
}

export async function applyCuratedWebOnlyLineup({
  mapCollection,
  Dj,
  lineupName,
  dryRun = false,
  purgeDiscogsIds = [],
}) {
  const upper = lineupName.trim().toUpperCase();
  const curated = CURATED_WEB_ONLY_LINEUP[upper];
  if (!curated) {
    throw new Error(`No curated web-only profile for ${lineupName}`);
  }

  const now = new Date();
  const discogsId = allocateSyntheticDiscogsId(lineupName);
  const hermesEvidence = curated.hermesEvidence;
  const { displayGenres, displayStyles } =
    precomputeDisplayGenresFromHermesEvidence(hermesEvidence);
  const djRecord = buildWebOnlyDjRecord({
    lineupName,
    discogsName: curated.discogsName ?? lineupName,
    hermesEvidence,
    discogsId,
  });

  if (dryRun) {
    return {
      status: 'dry_run',
      lineupName,
      discogsId,
      discogsName: djRecord.name,
    };
  }

  const existing = await mapCollection.findOne({
    lineupNameKey: lineupNameKeyFor(lineupName),
  });
  const oldDiscogsId = existing?.discogsId;

  await mapCollection.updateOne(
    { lineupNameKey: lineupNameKeyFor(lineupName) },
    {
      $set: {
        lineupName: lineupName.trim(),
        lineupNameKey: lineupNameKeyFor(lineupName),
        status: 'mapped',
        discogsId,
        discogsName: djRecord.name,
        source: 'hermes-v4-web',
        discoveryStrategyId: 'curated-web-only',
        searchQuery: 'curated-web-only',
        reviewReason: '',
        matchScore: 180,
        mappedAt: now,
        reviewedAt: now,
        hermesEvidence,
        displayGenres,
        displayStyles,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
      $unset: { hermesV4RunId: '', hermesV4ResearchedAt: '' },
    },
    { upsert: true },
  );

  await Dj.updateOne({ discogsId }, { $set: djRecord }, { upsert: true });

  const idsToPurge = new Set(
    [
      oldDiscogsId,
      ...purgeDiscogsIds,
      ...(existing?.source === 'hermes-v4-apply' ? [existing.discogsId] : []),
    ].filter((id) => Number.isFinite(Number(id)) && !isSyntheticDiscogsId(id)),
  );

  for (const id of idsToPurge) {
    const stillUsed = await mapCollection.countDocuments({ discogsId: id });
    if (!stillUsed) {
      await Dj.deleteOne({ discogsId: id });
    }
  }

  return {
    status: 'applied',
    lineupName,
    discogsId,
    discogsName: djRecord.name,
    purgedDiscogsIds: [...idsToPurge],
  };
}
