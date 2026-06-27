import { normalizeArtistNameKey } from './festival-lineup-fallback.mjs';

/** Lineup / Discogs name looks like a multi-artist billing (duo, B2B, ft). */
export function isDuoBillingLineupName(name) {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) {
    return false;
  }
  return (
    /\s+&\s+/i.test(trimmed) ||
    /\s+b2b\s+/i.test(trimmed) ||
    /\s+ft\.?\s+/i.test(trimmed) ||
    /\s+vs\.?\s+/i.test(trimmed)
  );
}

/** Solo festival name mapped to a duo/group Discogs page — common apply mistake. */
export function isSoloLineupMappedToDuoDiscogs(lineupName, discogsName) {
  const lineup = lineupName?.trim() ?? '';
  const discogs = discogsName?.trim() ?? '';
  if (!lineup || !discogs) {
    return false;
  }
  if (!isDuoBillingLineupName(discogs)) {
    return false;
  }
  return !isDuoBillingLineupName(lineup);
}

export function resolveAvatarSearchName(lineupName, discogsName) {
  const lineup = lineupName?.trim() ?? '';
  const discogs = discogsName?.trim() ?? '';
  if (!discogs) {
    return lineup;
  }
  if (isSoloLineupMappedToDuoDiscogs(lineup, discogs)) {
    return lineup;
  }
  return discogs;
}

/**
 * Block v4 apply when a combo display bundle would land on an extracted solo,
 * or when Discogs is a duo page for a solo lineup key.
 */
export function shouldSkipV4BundleForLineup({
  lineupName,
  matchedVia,
  sourceDisplay,
  discogsName,
  expandRealSoloArtistTargets,
}) {
  if (matchedVia === 'expanded_from_display' && sourceDisplay?.trim()) {
    const solos = expandRealSoloArtistTargets(sourceDisplay);
    if (solos.length > 1) {
      return { skip: true, reason: 'combo_bundle_expanded_to_solo' };
    }
  }

  if (isSoloLineupMappedToDuoDiscogs(lineupName, discogsName)) {
    return { skip: true, reason: 'solo_lineup_duo_discogs' };
  }

  return { skip: false };
}

/** Solo lineup key that plausibly owns this Discogs page (not a duo page). */
export function lineupMatchesDiscogsSoloPage(lineupName, discogsName) {
  if (isSoloLineupMappedToDuoDiscogs(lineupName, discogsName)) {
    return false;
  }
  const lineupKey = normalizeArtistNameKey(lineupName);
  const discogsKey = normalizeArtistNameKey(discogsName);
  return lineupKey.length > 0 && lineupKey === discogsKey;
}

/**
 * Rows to purge after hermes-v4-apply combo/solo mistakes.
 * Returns map rows with reason.
 */
export function findMisappliedHermesV4Maps(rows) {
  const byDiscogsId = new Map();
  for (const row of rows) {
    const discogsId = row.discogsId;
    if (!discogsId) {
      continue;
    }
    if (!byDiscogsId.has(discogsId)) {
      byDiscogsId.set(discogsId, []);
    }
    byDiscogsId.get(discogsId).push(row);
  }

  const purgeByKey = new Map();

  const mark = (row, reason) => {
    const key = row.lineupNameKey ?? row.lineupName?.trim().toLowerCase();
    if (!key) {
      return;
    }
    purgeByKey.set(key, {
      lineupName: row.lineupName?.trim() ?? '',
      discogsId: row.discogsId,
      discogsName: row.discogsName ?? '',
      source: row.source ?? '',
      reason,
    });
  };

  for (const row of rows) {
    if (
      isSoloLineupMappedToDuoDiscogs(row.lineupName, row.discogsName)
    ) {
      mark(row, 'solo_lineup_duo_discogs');
    }
  }

  for (const group of byDiscogsId.values()) {
    if (group.length < 2) {
      continue;
    }
    const applyRows = group.filter((row) => row.source === 'hermes-v4-apply');
    if (applyRows.length < 2) {
      continue;
    }

    const discogsName = applyRows[0]?.discogsName ?? '';
    if (isDuoBillingLineupName(discogsName)) {
      for (const row of applyRows) {
        if (!isDuoBillingLineupName(row.lineupName)) {
          mark(row, 'combo_discogs_shared_across_solos');
        }
      }
      continue;
    }

    const keepers = applyRows.filter((row) =>
      lineupMatchesDiscogsSoloPage(row.lineupName, discogsName),
    );
    if (keepers.length === 1) {
      for (const row of applyRows) {
        if (row !== keepers[0]) {
          mark(row, 'combo_bundle_wrong_solo_discogs');
        }
      }
      continue;
    }

    if (keepers.length === 0) {
      for (const row of applyRows) {
        mark(row, 'combo_bundle_no_solo_owner');
      }
    }
  }

  return [...purgeByKey.values()];
}
