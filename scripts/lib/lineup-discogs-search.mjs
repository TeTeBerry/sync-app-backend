/** Discogs crawl source tag written to dj_discogs_map. */
export const DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL = '电音节爬虫';

export const DISCOGS_REVIEW_REASON = {
  NO_QUALIFYING_CANDIDATE: '无合格电子音乐人候选：Discogs未检索到对应艺人页面',
  HOMONYM_AMBIGUITY: '通用名称多Discogs艺人歧义，分值接近无法自动区分',
  INSUFFICIENT_SCORE: '企划 / 双人组合名称资料不足，可信度不足',
  BUILD_RECORD_FAILED: '匹配成功但艺人资料单薄/企划联名，数据构建校验不通过',
  NAME_MISMATCH: (discogsName) => `名称不一致（${discogsName}）`,
};

const MAIN_ARTIST_SEPARATOR =
  /\s+(?:PRES(?:\.|ENTS)?|PRESENTS)\b[\s:.\-]*|\s+FT\.?\s+|\s+FEAT(?:\.|URING)?\.?\s+|\s+-\s+/i;

/**
 * Extract the primary billed artist from festival display strings.
 * Mirrors review tooling: split on PRESENTS / FT / FEAT / " - ", then drop quotes/parens.
 *
 * Examples:
 * - JASON PAYNE PRESENTS GOLDSCHOOL → JASON PAYNE
 * - GHENGAR (GHASTLY) → GHENGAR
 * - BEN NICKY - XTREME SET → BEN NICKY
 */
export function extractMainLineupArtist(lineupName) {
  const trimmed = lineupName?.trim() ?? '';
  if (!trimmed) {
    return '';
  }

  const [head] = trimmed.split(MAIN_ARTIST_SEPARATOR);
  let main = (head ?? '').trim();
  main = main
    .replace(/"[^"]*"/g, '')
    .replace(/'[^']*'/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return main || trimmed;
}

function splitCollaborators(name) {
  return name
    .split(/\s*(?:&|\+|X|×)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Extract producer/DJ names from festival lineup display strings.
 * ADJUZT & SKG PRESENTS: … → ADJUZT, SKG
 * ABADDON … FT. MC RECKLESS → ABADDON PURE DOMINATION
 */
export function extractLineupDiscogsSearchNames(lineupName) {
  const trimmed = lineupName.trim();
  if (!trimmed) {
    return [];
  }

  const names = new Set();
  const main = extractMainLineupArtist(trimmed);

  for (const part of splitCollaborators(main)) {
    names.add(part);
  }

  if (!names.size) {
    names.add(main || trimmed);
  }

  return [...names];
}

export function formatMapCandidateScores(scored) {
  return (scored ?? []).map((item) => ({
    discogsId: item.discogsId,
    name: item.name,
    total: item.total,
  }));
}
