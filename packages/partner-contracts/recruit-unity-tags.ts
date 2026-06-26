export const RECRUIT_UNITY_TAG_IDS = [
  'welcome_newbie',
  'women_friendly',
  'multi_day',
  'same_departure',
  'pure_rave',
  'afterparty_ok',
  'early_bird',
  'budget_friendly',
] as const;

export type RecruitUnityTagId = (typeof RECRUIT_UNITY_TAG_IDS)[number];

export const MAX_RECRUIT_UNITY_TAGS = 3;

const RECRUIT_UNITY_TAG_ID_SET = new Set<string>(RECRUIT_UNITY_TAG_IDS);

/** zh-CN / en-US labels for search haystack expansion. */
export const RECRUIT_UNITY_TAG_SEARCH_LABELS: Record<
  RecruitUnityTagId,
  { zh: string; en: string }
> = {
  welcome_newbie: { zh: '欢迎新手', en: 'welcome newcomers' },
  women_friendly: { zh: '女生友好', en: 'women friendly' },
  multi_day: { zh: '多日联票', en: 'multi day' },
  same_departure: { zh: '同出发地', en: 'same departure' },
  pure_rave: { zh: '纯 rave', en: 'pure rave' },
  afterparty_ok: { zh: 'afterparty', en: 'afterparty optional' },
  early_bird: { zh: '早鸟', en: 'early bird' },
  budget_friendly: { zh: '预算友好', en: 'budget friendly' },
};

const UNITY_TAG_ALIAS_ENTRIES: Array<{
  tag: RecruitUnityTagId;
  aliases: string[];
}> = [
  {
    tag: 'welcome_newbie',
    aliases: ['欢迎新手', 'welcome newcomer', 'welcome newcomers', 'newcomer'],
  },
  {
    tag: 'women_friendly',
    aliases: ['女生友好', 'women friendly', 'woman friendly'],
  },
  {
    tag: 'multi_day',
    aliases: ['多日联票', '多日', 'multi day', 'multi-day'],
  },
  {
    tag: 'same_departure',
    aliases: ['同出发地', '同出发', 'same departure', 'same city'],
  },
  {
    tag: 'pure_rave',
    aliases: ['纯 rave', '纯rave', 'pure rave'],
  },
  {
    tag: 'afterparty_ok',
    aliases: ['afterparty', 'after party', 'afterparty optional', 'ap随缘'],
  },
  {
    tag: 'early_bird',
    aliases: ['早鸟', '早鸟组队', 'early bird'],
  },
  {
    tag: 'budget_friendly',
    aliases: ['预算友好', '省钱', 'budget friendly', 'budget-friendly'],
  },
];

function normalizeUnitySearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isRecruitUnityTagId(value: string): value is RecruitUnityTagId {
  return RECRUIT_UNITY_TAG_ID_SET.has(value);
}

/** Dedupe, validate enum, cap at max (invalid ids dropped). */
export function normalizeRecruitUnityTags(
  tags: string[] | undefined | null,
): RecruitUnityTagId[] {
  if (!tags?.length) return [];
  const seen = new Set<RecruitUnityTagId>();
  const result: RecruitUnityTagId[] = [];
  for (const raw of tags) {
    const trimmed = raw.trim();
    if (!isRecruitUnityTagId(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= MAX_RECRUIT_UNITY_TAGS) break;
  }
  return result;
}

/** Rule-based: map NL query fragments to structured Unity tag ids. */
export function resolveUnityTagsFromSearchText(
  query: string,
): RecruitUnityTagId[] {
  const normalized = normalizeUnitySearchText(query);
  if (!normalized) return [];

  const matched: RecruitUnityTagId[] = [];
  const seen = new Set<RecruitUnityTagId>();

  for (const entry of UNITY_TAG_ALIAS_ENTRIES) {
    for (const alias of entry.aliases) {
      const aliasNorm = normalizeUnitySearchText(alias);
      if (!aliasNorm || !normalized.includes(aliasNorm)) continue;
      if (!seen.has(entry.tag)) {
        seen.add(entry.tag);
        matched.push(entry.tag);
      }
      break;
    }
  }

  return matched;
}

export function recruitUnityTagSearchHaystackLabels(
  tagIds: RecruitUnityTagId[] | undefined | null,
): string[] {
  if (!tagIds?.length) return [];
  return tagIds.flatMap((id) => {
    const labels = RECRUIT_UNITY_TAG_SEARCH_LABELS[id];
    return labels ? [labels.zh, labels.en] : [];
  });
}
