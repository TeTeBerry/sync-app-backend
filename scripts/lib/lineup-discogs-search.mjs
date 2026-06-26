/** Discogs crawl source tag written to dj_discogs_map. */
export const DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL = '电音节爬虫';

export const DISCOGS_REVIEW_REASON = {
  NO_QUALIFYING_CANDIDATE:
    '无合格电子音乐人候选：Discogs未检索到对应艺人页面',
  HOMONYM_AMBIGUITY:
    '通用名称多Discogs艺人歧义，分值接近无法自动区分',
  INSUFFICIENT_SCORE:
    '企划 / 双人组合名称资料不足，可信度不足',
  BUILD_RECORD_FAILED:
    '匹配成功但艺人资料单薄/企划联名，数据构建校验不通过',
  NAME_MISMATCH: (discogsName) => `名称不一致（${discogsName}）`,
};

const PRESENTS_PATTERN = /\s+PRESENTS?\b[\s:.\-]*/i;
const FEAT_PATTERN = /\s+(?:FT\.?|FEAT\.?|FEATURING)\b[\s.]*\s*/i;

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

  const presentsIdx = trimmed.search(PRESENTS_PATTERN);
  const beforePresents =
    presentsIdx >= 0 ? trimmed.slice(0, presentsIdx).trim() : trimmed;

  for (const part of splitCollaborators(beforePresents)) {
    names.add(part);
  }

  const featSplit = beforePresents.split(FEAT_PATTERN);
  if (featSplit[0]?.trim()) {
    for (const part of splitCollaborators(featSplit[0].trim())) {
      names.add(part);
    }
  }

  if (!names.size) {
    names.add(trimmed);
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
