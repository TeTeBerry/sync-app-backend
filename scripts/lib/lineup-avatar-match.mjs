import {
  isElectronicGenreCandidate,
  isTheAudioDbHomonymBio,
  scoreTheAudioDbMatch,
} from './theaudiodb-avatars.mjs';

/** Strip Discogs disambiguation suffix, e.g. "John Newman (5)" → "John Newman". */
export function stripDiscogsDisambiguation(name) {
  return (name ?? '')
    .trim()
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
}

/** Person key for avatar identity checks (lineup / TheAudioDB / Discogs). */
export function normalizeAvatarPersonKey(name) {
  return stripDiscogsDisambiguation(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** All known spellings for one mapped artist (lineup billing + Discogs + search alias). */
export function collectCatalogPersonKeys(lineupName, searchName, discogsName) {
  return [
    ...new Set(
      [lineupName, searchName, discogsName]
        .flatMap((name) => [name, stripDiscogsDisambiguation(name)])
        .map(normalizeAvatarPersonKey)
        .filter(Boolean),
    ),
  ];
}

export function isCatalogIdentityAligned({
  lineupName,
  searchName,
  discogsName,
  candidateArtistName,
}) {
  const candidateKey = normalizeAvatarPersonKey(candidateArtistName);
  if (!candidateKey) {
    return false;
  }
  const catalogKeys = collectCatalogPersonKeys(
    lineupName,
    searchName,
    discogsName,
  );
  return catalogKeys.includes(candidateKey);
}

/** Best TheAudioDB name score across lineup billing + mapped catalog names. */
export function bestCatalogMatchScore(
  lineupName,
  searchName,
  discogsName,
  candidate,
) {
  const shaped = {
    strArtist: candidate?.strArtist ?? candidate?.artistName,
    strArtistAlternate: candidate?.strArtistAlternate,
  };
  const names = [lineupName, searchName, discogsName]
    .map((name) => name?.trim())
    .filter(Boolean);
  if (!names.length) {
    return 0;
  }
  return Math.max(...names.map((name) => scoreTheAudioDbMatch(name, shaped)));
}

const VOCAL_GUEST_RE = /\b(singer|vocalist|songwriter|rapper)\b/i;
const VOCAL_PRIMARY_RE = /\b(soul|r&b|rnb|gospel|country|folk|jazz|blues)\b/i;
const DJ_PRIMARY_RE = /\b(dj|disc jockey)\b/i;
const EDM_ROLE_RE =
  /\b(hardstyle|hardcore|techno|trance|drum and bass|dnb|house)\b.*\b(dj|producer)\b|\b(dj|producer)\b.*\b(hardstyle|hardcore|techno|trance|drum and bass|dnb|house)\b/i;

/** TheAudioDB genres that suggest a non-EDM vocal artist (homonym risk vs mapped DJ). */
export function isVocalPrimaryGenre(genres) {
  if (!genres?.length) {
    return false;
  }
  if (isElectronicGenreCandidate(genres) === true) {
    return false;
  }
  const text = genres.join(' ').toLowerCase();
  return VOCAL_PRIMARY_RE.test(text);
}

/**
 * Discogs profile reads like a vocal / crossover festival guest (not a core DJ page).
 */
export function isCrossoverGuestProfile(profile) {
  const text = (profile ?? '').trim();
  if (!text) {
    return false;
  }
  if (!VOCAL_GUEST_RE.test(text)) {
    return false;
  }
  if (DJ_PRIMARY_RE.test(text)) {
    return false;
  }
  if (EDM_ROLE_RE.test(text)) {
    return false;
  }
  return true;
}

/** Discogs profile reads like an electronic DJ / producer act. */
export function isElectronicDjProfile(profile) {
  const text = (profile ?? '').trim();
  if (!text) {
    return false;
  }
  if (VOCAL_GUEST_RE.test(text) && !DJ_PRIMARY_RE.test(text)) {
    return false;
  }
  if (DJ_PRIMARY_RE.test(text)) {
    return true;
  }
  if (
    /\b(duo|producer|edm|electronic|trap|dubstep|hardstyle|techno|house|trance|drum and bass|dnb)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

const HOMONYM_STUB_FOLLOWER_CEILING = 50_000;

/**
 * Reject TheAudioDB merged homonym pages that attach the wrong person's photo.
 * Example: search.php?s=fisher → US vocal Fisher (4k followers), not Fisher (OZ).
 */
export function isTheAudioDbHomonymStub({
  candidateBiography,
  candidateGenres,
  candidateFollowers,
}) {
  if (!isTheAudioDbHomonymBio(candidateBiography)) {
    return false;
  }
  if (isElectronicGenreCandidate(candidateGenres ?? []) === true) {
    return false;
  }
  const followers = Number(candidateFollowers ?? 0);
  return !followers || followers < HOMONYM_STUB_FOLLOWER_CEILING;
}

/**
 * Multi-signal genre + identity gate for TheAudioDB avatar candidates.
 *
 * Identity uses mapped catalog names (lineup + search alias + discogs), not billing
 * spelling alone — so Jerrooo → Jerro passes when discogs/search agree.
 */
export function evaluateAvatarGenreGate({
  genreCheckEnabled = true,
  djsStyles,
  djsGenres,
  candidateGenres,
  candidateBiography,
  candidateFollowers,
  lineupName,
  searchName,
  discogsName,
  candidateArtistName,
  djProfile,
  matchScore,
}) {
  if (!genreCheckEnabled) {
    return { accept: true, reason: 'genre_check_disabled' };
  }

  if (
    isTheAudioDbHomonymStub({
      candidateBiography,
      candidateGenres,
      candidateFollowers,
    }) &&
    (isElectronicGenreCandidate(djsGenres ?? []) === true ||
      isElectronicDjProfile(djProfile) ||
      (djsStyles?.length ?? 0) > 0)
  ) {
    return { accept: false, reason: 'homonym_disambiguation_stub' };
  }

  const identityAligned = isCatalogIdentityAligned({
    lineupName,
    searchName,
    discogsName,
    candidateArtistName,
  });

  if (!identityAligned) {
    return {
      accept: false,
      reason:
        matchScore < 100
          ? 'genre_mismatch_partial_name'
          : 'genre_mismatch_name',
    };
  }

  const electronic = isElectronicGenreCandidate(candidateGenres);
  if (electronic === null) {
    return { accept: true, reason: 'no_audiodb_genre' };
  }
  if (electronic) {
    const lineupKey = normalizeAvatarPersonKey(lineupName);
    const candidateKey = normalizeAvatarPersonKey(candidateArtistName);
    if (lineupKey !== candidateKey) {
      return { accept: true, reason: 'catalog_alias_electronic_match' };
    }
    return { accept: true, reason: 'electronic_match' };
  }

  if (!djsStyles?.length) {
    return { accept: true, reason: 'no_djs_styles' };
  }

  const candidateKey = normalizeAvatarPersonKey(candidateArtistName);
  const discogsKey = normalizeAvatarPersonKey(discogsName ?? '');
  const discogsAligned = !discogsKey || discogsKey === candidateKey;

  if (isCrossoverGuestProfile(djProfile) && discogsAligned) {
    return { accept: true, reason: 'crossover_guest_corroborated' };
  }

  if (discogsAligned && isElectronicDjProfile(djProfile)) {
    if (isVocalPrimaryGenre(candidateGenres)) {
      return { accept: false, reason: 'genre_mismatch_vocal_homonym' };
    }
    return { accept: true, reason: 'electronic_dj_corroborated' };
  }

  if (discogsAligned && isElectronicGenreCandidate(djsGenres ?? []) === true) {
    return { accept: true, reason: 'electronic_catalog_corroborated' };
  }

  return { accept: false, reason: 'genre_mismatch' };
}
