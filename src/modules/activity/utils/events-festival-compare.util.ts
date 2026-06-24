import type {
  EventsActivitySearchParsed,
  KnowledgeCardComparePayload,
  KnowledgeCardCompareRow,
  KnowledgeCardPayload,
} from '@sync/scene-contracts';
import { summarizeVisaHint } from '../../travel-guide/domain/travel-guide-international.util';
import { getFestivalVibe } from '../../../infra/chroma/data/festival-vibe.data';
import type { ActivityLookupRecord } from '../ports/activity-lookup.port';

export const COMPARE_INTENT_PATTERN =
  /对比|vs|VS|和.*(比|好)|哪个好|选哪| versus /i;

function formatVibe(activity: ActivityLookupRecord): string {
  return (
    getFestivalVibe(activity.code) ??
    '曲风以官宣阵容为准，可关注 Mainstage / Techno / Bass 等舞台划分'
  );
}

function normalizeCompareQuery(query: string): string {
  return query.replace(COMPARE_INTENT_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

function activityMatchScore(
  activity: ActivityLookupRecord,
  token: string,
): number {
  const haystack = [activity.name, activity.code, ...(activity.alias ?? [])]
    .join(' ')
    .toLowerCase();
  const normalized = token.toLowerCase();
  if (!normalized) return 0;
  if (haystack === normalized) return 100;
  if (activity.code.toLowerCase() === normalized) return 90;
  if (activity.code.toLowerCase().startsWith(`${normalized}-`)) return 85;
  if (activity.name.toLowerCase().includes(normalized)) return 80;
  if (
    (activity.alias ?? []).some((alias) => alias.toLowerCase() === normalized)
  ) {
    return 75;
  }
  if (haystack.includes(normalized)) return 70;
  return 0;
}

export function isCompareQuery(query: string): boolean {
  return COMPARE_INTENT_PATTERN.test(query.trim());
}

export function resolveCompareActivities(
  query: string,
  allActivities: ActivityLookupRecord[],
  matchedActivities: ActivityLookupRecord[],
): ActivityLookupRecord[] {
  const remainder = normalizeCompareQuery(query);
  const tokens = remainder
    .split(/[\s,，、/|与和及]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);

  const picked: ActivityLookupRecord[] = [];
  const pickedCodes = new Set<string>();

  for (const token of tokens) {
    let best: ActivityLookupRecord | null = null;
    let bestScore = 0;

    for (const activity of allActivities) {
      if (pickedCodes.has(activity.code)) continue;
      const score = activityMatchScore(activity, token);
      if (score > bestScore) {
        bestScore = score;
        best = activity;
      }
    }

    if (best && bestScore >= 70) {
      picked.push(best);
      pickedCodes.add(best.code);
    }
    if (picked.length >= 2) break;
  }

  if (picked.length >= 2) return picked.slice(0, 2);

  const fallbackPool = [
    ...matchedActivities,
    ...allActivities.filter((activity) => !pickedCodes.has(activity.code)),
  ];

  for (const activity of fallbackPool) {
    if (pickedCodes.has(activity.code)) continue;
    picked.push(activity);
    pickedCodes.add(activity.code);
    if (picked.length >= 2) break;
  }

  return picked.slice(0, 2);
}

function formatLocation(activity: ActivityLookupRecord): string {
  const location = activity.location?.trim();
  const area = activity.area?.trim();
  if (location && area && !location.includes(area)) {
    return `${area} · ${location}`;
  }
  return location || area || '以官方公布为准';
}

function formatSchedule(activity: ActivityLookupRecord): string {
  return activity.date?.trim() || '档期待官宣';
}

function formatBudgetTier(activity: ActivityLookupRecord): string {
  const region = activity.region?.trim();
  if (region === 'domestic' || region === 'hmt') {
    return '门票 + 市内交通为主；住宿按城市档位自选';
  }
  if (region === 'overseas') {
    return '机票 + 住宿 + 门票；可在活动详情生成出行攻略查看预算档参考';
  }
  return '门票 + 交通；海外场另计机票与住宿';
}

function buildCompareRows(
  left: ActivityLookupRecord,
  right: ActivityLookupRecord,
  isEn: boolean,
): KnowledgeCardCompareRow[] {
  if (isEn) {
    return [
      {
        label: 'Location',
        left: formatLocation(left),
        right: formatLocation(right),
      },
      {
        label: 'Dates',
        left: formatSchedule(left),
        right: formatSchedule(right),
      },
      { label: 'Vibe', left: formatVibe(left), right: formatVibe(right) },
      {
        label: 'Budget',
        left: formatBudgetTier(left),
        right: formatBudgetTier(right),
      },
      {
        label: 'Visa / ID',
        left: summarizeVisaHint(left),
        right: summarizeVisaHint(right),
      },
    ];
  }

  return [
    { label: '地点', left: formatLocation(left), right: formatLocation(right) },
    { label: '档期', left: formatSchedule(left), right: formatSchedule(right) },
    { label: '曲风气质', left: formatVibe(left), right: formatVibe(right) },
    {
      label: '预算档',
      left: formatBudgetTier(left),
      right: formatBudgetTier(right),
    },
    {
      label: '签证/证件',
      left: summarizeVisaHint(left),
      right: summarizeVisaHint(right),
    },
  ];
}

export function buildFestivalCompareKnowledgeCard(input: {
  query: string;
  parsed: EventsActivitySearchParsed;
  activities: ActivityLookupRecord[];
  allActivities: ActivityLookupRecord[];
  locale: string;
  introBody?: string;
  aiGenerated?: boolean;
}): KnowledgeCardPayload | null {
  const pair = resolveCompareActivities(
    input.query,
    input.allActivities,
    input.activities,
  );
  if (pair.length < 2) return null;

  const [left, right] = pair;
  const isEn = input.locale.toLowerCase().startsWith('en');
  const compare: KnowledgeCardComparePayload = {
    leftName: left.name,
    rightName: right.name,
    leftActivityLegacyId: left.legacyId,
    rightActivityLegacyId: right.legacyId,
    rows: buildCompareRows(left, right, isEn),
  };

  const defaultIntro = isEn
    ? `Side-by-side comparison of ${left.name} and ${right.name}. Data from SYNC catalog — for reference only.`
    : `${left.name} 与 ${right.name} 对比参考，数据来自 SYNC 活动库，仅供参考。`;

  return {
    title: isEn ? 'Festival compare' : '电音节对比',
    sections: [{ body: input.introBody?.trim() || defaultIntro }],
    links: [
      { label: left.name, activityLegacyId: left.legacyId },
      { label: right.name, activityLegacyId: right.legacyId },
    ],
    sources: isEn
      ? ['SYNC catalog', 'Public travel references']
      : ['SYNC 活动库', '公开出行资料整理'],
    aiGenerated: input.aiGenerated ?? false,
    compare,
  };
}

export function enrichParsedForCompare(
  query: string,
  parsed: EventsActivitySearchParsed,
  allActivities: ActivityLookupRecord[],
  matchedActivities: ActivityLookupRecord[],
): EventsActivitySearchParsed {
  if (!isCompareQuery(query)) return parsed;

  const pair = resolveCompareActivities(
    query,
    allActivities,
    matchedActivities,
  );
  const enriched: EventsActivitySearchParsed = {
    ...parsed,
    intent: 'compare',
  };

  if (pair.length >= 2) {
    enriched.compareActivityCodes = [pair[0].code, pair[1].code];
  }

  return enriched;
}
