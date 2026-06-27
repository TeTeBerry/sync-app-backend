import {
  expandFestivalArtistName,
  normalizeArtistNameKey,
} from './festival-lineup-fallback.mjs';
import { precomputeDisplayGenresFromHermesEvidence } from './web-only-dj-profile.mjs';
import { sanitizeCatalogGenreTokens } from './web-only-genre-normalize.mjs';

const B2B_PATTERN = /\s+B2B\s+/i;
const AMPERSAND_PATTERN = /\s+&\s+/;
const COLLAB_X_PATTERN = /\s+[X×]\s+/i;
const FT_PATTERN = /\s+FT\.?\s+/i;
const PRESENTS_PATTERN = /\s+PRESENTS?\b[\s:.\-]/i;

const NON_ARTIST_LABEL_PATTERN =
  /\b(?:STAGE|CONTEST|ENDSHOW|CEREMONY|TAKEOVER|SHOWCASE|EXPERIENCE|LEGENDS|ROAD\s+TO|SIGNATURE\s+SHOW|WHEEL\s+OF|OPENING|WARMING[- ]?UP|HARDER\s*CLASS|HARDERCLASS|RED\s+RACE|PARADE|LIVE\s+OR\s+DIE|CHOOSE\s+YOUR\s+ERA|ERROR_404|RAVE\s+NATION\s+LIVE|HOUSE\s+OF\s+MADNESS|UPTEMPO\s+FIESTA|PURE\s+DOMINATION|WITH\s+FRIENDS|GEZELLIGE|ONMEUING|NO\s+FEEST|BOUNCE\s+SET|CROSSOVER\s+SET|REVERSE\s+BASS|MY\s+TRUE\s+DNA|BIG\s+SING|ZAAGPHORIC|INDUSTRIAL\s+RAVE|GOLDSCHOOL|RUNESCAPE|FEESTNATION|BASSCON|BASSRUSH|FACTORY\s*93|INSOMNIAC|DREAMSTATE|BOYBAND|REÜNIE|REUNIE|STRAIGHT\s+OUTTA|SHOTS\s+'N|BELGIAN)\b/i;

function stripQuotedSetTitles(lineupName) {
  return lineupName
    .replace(/"[^"]*"/g, '')
    .replace(/'[^']*'/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function stripBillingSubtitle(lineupName) {
  const colonIdx = lineupName.indexOf(':');
  if (colonIdx > 0 && colonIdx < lineupName.length - 8) {
    const tail = lineupName.slice(colonIdx + 1).trim();
    if (NON_ARTIST_LABEL_PATTERN.test(tail) || tail.split(/\s+/).length >= 3) {
      return lineupName.slice(0, colonIdx).trim();
    }
  }

  const dashMatch = lineupName.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const right = dashMatch[2].trim();
    if (
      NON_ARTIST_LABEL_PATTERN.test(right) ||
      /\b(?:LIVE|SHOW|SET|CLASSICS|DNA|BAKK?EN|REÜNIE|REUNIE|BOYBAND|ZAAG|BASS|GOLDSCHOOL|MIEN|FIESTA|DOMINATION|OUTTA)\b/i.test(
        right,
      ) ||
      right.split(/\s+/).length >= 2
    ) {
      return left;
    }
  }

  return lineupName.trim();
}

function stripFtSuffix(lineupName) {
  const idx = lineupName.search(FT_PATTERN);
  if (idx < 0) {
    return lineupName.trim();
  }
  return lineupName.slice(0, idx).trim();
}

function stripPresentsSuffix(lineupName) {
  const trimmed = lineupName.trim();
  const idx = trimmed.search(PRESENTS_PATTERN);
  if (idx < 0) {
    return trimmed;
  }
  return trimmed.slice(0, idx).trim();
}

function splitCommaParts(lineupName) {
  if (!lineupName.includes(',')) {
    return [lineupName];
  }
  return lineupName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitBillingDelimiters(lineupName) {
  const parts = [lineupName];
  const delimiters = [B2B_PATTERN, AMPERSAND_PATTERN, COLLAB_X_PATTERN];

  let expanded = parts;
  for (const pattern of delimiters) {
    expanded = expanded.flatMap((part) =>
      pattern.test(part)
        ? part
            .split(pattern)
            .map((piece) => piece.trim())
            .filter(Boolean)
        : [part],
    );
  }

  return expanded.flatMap(splitCommaParts);
}

function looksLikeMultiArtistBilling(lineupName) {
  const upper = lineupName.toUpperCase();
  if (lineupName.length > 48) {
    return true;
  }
  if ((lineupName.match(/&/g) ?? []).length >= 2) {
    return true;
  }
  if ((lineupName.match(/\bX\b/gi) ?? []).length >= 2) {
    return true;
  }
  if (lineupName.includes(',') && /[&X×]/.test(lineupName)) {
    return true;
  }
  if (/\b(?:WITH|MET|PRES\.?|PRESENTS?|FT\.?)\b/i.test(upper)) {
    return true;
  }
  if (NON_ARTIST_LABEL_PATTERN.test(lineupName)) {
    return true;
  }
  return false;
}

/** True when a lineup token is a stage / contest / billing label, not a solo DJ. */
export function isLineupNonArtistLabel(lineupName) {
  const trimmed = lineupName.trim();
  if (!trimmed || trimmed === '国内艺人') {
    return true;
  }

  const upper = trimmed.toUpperCase();
  if (NON_ARTIST_LABEL_PATTERN.test(trimmed)) {
    return true;
  }

  if (looksLikeMultiArtistBilling(trimmed)) {
    return true;
  }

  if (
    trimmed.length >= 12 &&
    !/\s/.test(trimmed) &&
    /^[A-Z0-9&$!.'\-]+$/u.test(trimmed) &&
    (trimmed.match(/[AEIOU]/gi) ?? []).length <= 1
  ) {
    return true;
  }

  if (/^THE\s+(?:ENDSHOW|OPENING|WARMING|VIPER|PURGE|DARKRAVER|DOPE|BEHOLDER|SMILER|STRAIKERZ|SPOTLIGHT|SICKEST|VIPER)\b/i.test(trimmed)) {
    return true;
  }

  if (
    /^[A-Z0-9][A-Z0-9\s&,'".\-:/()]+$/u.test(trimmed) &&
    trimmed.length > 40 &&
    /\b(?:WITH|FT|PRESENTS?|LIVE|SHOW|SET)\b/i.test(upper)
  ) {
    return true;
  }

  return false;
}

function normalizeTargetName(lineupName) {
  return stripFtSuffix(
    stripPresentsSuffix(stripBillingSubtitle(stripQuotedSetTitles(lineupName))),
  );
}

/**
 * Expand a lineup display row into crawlable solo artist names.
 * Aggressive billing splits stay internal to catalog reporting / crawl scope.
 */
export function expandRealSoloArtistTargets(displayName) {
  const trimmed = displayName.trim();
  if (!trimmed || trimmed === '国内艺人') {
    return [];
  }

  const cleaned = normalizeTargetName(trimmed);
  let parts = expandFestivalArtistName(cleaned);

  if (parts.length <= 1 && looksLikeMultiArtistBilling(cleaned)) {
    parts = splitBillingDelimiters(cleaned);
  }

  parts = parts
    .flatMap((part) => expandFestivalArtistName(normalizeTargetName(part)))
    .flatMap(splitCommaParts)
    .map((part) => normalizeTargetName(part))
    .filter(Boolean);

  return [...new Set(parts)].filter((name) => !isLineupNonArtistLabel(name));
}

export function collectRealSoloArtistTargets(displayNames) {
  const targets = new Set();
  for (const displayName of displayNames) {
    for (const solo of expandRealSoloArtistTargets(displayName)) {
      targets.add(solo);
    }
  }
  return [...targets].sort((a, b) => a.localeCompare(b));
}

function displayGenresFromDj(dj) {
  if (!dj) {
    return [];
  }
  return sanitizeCatalogGenreTokens([...(dj.styles ?? []), ...(dj.genres ?? [])]);
}

function displayGenresFromMapRow(mapRow) {
  if (mapRow?.displayGenres?.length) {
    return sanitizeCatalogGenreTokens(mapRow.displayGenres);
  }
  if (mapRow?.hermesEvidence) {
    const { displayGenres } = precomputeDisplayGenresFromHermesEvidence(
      mapRow.hermesEvidence,
    );
    return sanitizeCatalogGenreTokens(displayGenres);
  }
  return [];
}

function profileFromMapRow(mapRow, dj) {
  const djProfile = dj?.profile?.trim();
  if (djProfile) {
    return djProfile;
  }

  const report = mapRow?.hermesEvidence?.integratedReport?.trim();
  if (report) {
    return report.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').substring(0, 600);
  }

  const snippets = (mapRow?.hermesEvidence?.web ?? [])
    .filter((row) => row.relevance === 'high' || row.relevance === 'medium')
    .map((row) => row.snippet?.trim())
    .filter(Boolean);

  return [...new Set(snippets)].join(' ').trim();
}

/** Whether the artist already has mapped, displayable catalog profile data. */
export function hasMappedRealArtistData(mapRow, dj) {
  if (!mapRow) {
    return false;
  }

  if (mapRow.status === 'pending_review') {
    return false;
  }

  if (mapRow.source === 'manual-stub') {
    return false;
  }

  if (mapRow.source === 'combo-billing') {
    return false;
  }

  if (mapRow.status !== 'mapped' || !mapRow.discogsId) {
    return false;
  }

  const genres = [
    ...new Set([
      ...displayGenresFromDj(dj),
      ...displayGenresFromMapRow(mapRow),
    ]),
  ];
  if (genres.length) {
    return true;
  }

  if (profileFromMapRow(mapRow, dj)) {
    return true;
  }

  if (mapRow.source === 'hermes-v4-web' && mapRow.hermesEvidence) {
    return true;
  }

  return false;
}

export function classifyMissingRealArtistData(mapRow, dj) {
  if (!mapRow) {
    return 'no_map';
  }
  if (mapRow.status === 'pending_review') {
    return 'pending_review';
  }
  if (mapRow.source === 'manual-stub') {
    return 'manual_stub';
  }
  if (mapRow.status === 'mapped' && mapRow.discogsId) {
    return 'mapped_no_real_profile';
  }
  return 'no_map';
}

export function buildMissingRealArtistRecord({
  lineupName,
  mapRow,
  dj,
}) {
  const issue = classifyMissingRealArtistData(mapRow, dj);
  const candidates = (mapRow?.candidateScores ?? [])
    .slice(0, 3)
    .map((candidate) => `#${candidate.discogsId} ${candidate.name} (${candidate.total})`)
    .join('; ');

  return {
    lineupName,
    lineupNameKey: normalizeArtistNameKey(lineupName),
    issue,
    mapStatus: mapRow?.status ?? null,
    source: mapRow?.source ?? null,
    discogsId: mapRow?.discogsId ?? dj?.discogsId ?? null,
    discogsName: mapRow?.discogsName ?? dj?.name ?? null,
    topCandidates: candidates || null,
    reviewReason: mapRow?.reviewReason?.trim() || null,
  };
}

export function collectArtistsMissingRealProfile({
  displayNames,
  mapByKey,
  djById,
}) {
  const targets = collectRealSoloArtistTargets(displayNames);
  const missing = [];

  for (const lineupName of targets) {
    const mapRow = mapByKey.get(normalizeArtistNameKey(lineupName)) ?? null;
    const dj = mapRow?.discogsId ? djById.get(mapRow.discogsId) ?? null : null;

    if (hasMappedRealArtistData(mapRow, dj)) {
      continue;
    }

    missing.push(
      buildMissingRealArtistRecord({
        lineupName,
        mapRow,
        dj,
      }),
    );
  }

  return missing;
}
