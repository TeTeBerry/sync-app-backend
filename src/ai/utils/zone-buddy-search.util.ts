import {
  catalogDateToIso,
  extractYearFromText,
} from '../rag/activity-date.util';

export type BuddySearchHintKind = 'zone' | 'event_day' | 'day_or_zone';

/** 从活动 catalog 日期（06/13-14）解析场次日号 */
export function parseActivityCatalogDays(catalogDate?: string): number[] {
  if (!catalogDate?.trim()) return [];
  const range = catalogDate.trim().match(/(\d{1,2})\/(\d{1,2})(?:-(\d{1,2}))?/);
  if (!range) return [];

  const start = Number(range[2]);
  const end = range[3] ? Number(range[3]) : start;
  if (Number.isNaN(start) || Number.isNaN(end)) return [];

  const days: number[] = [];
  for (let day = start; day <= end; day += 1) {
    days.push(day);
  }
  return days;
}

export function formatActivityEventDayLabel(
  catalogDate: string,
  day: number,
  activityName?: string,
): string {
  const range = catalogDate.trim().match(/(\d{1,2})\/(\d{1,2})/);
  if (range) {
    const month = Number(range[1]);
    return `${month}月${day}日`;
  }
  const year = extractYearFromText(activityName) ?? String(new Date().getFullYear());
  const iso = catalogDateToIso(catalogDate, year);
  if (iso) {
    const [, m, d] = iso.split('-');
    if (Number(d) === day) return `${Number(m)}月${day}日`;
  }
  return `${day}号`;
}

/** catalog 日期 → 展示用场次日列表，如 6月13日、6月14日 */
export function formatActivityCatalogDayLabels(
  catalogDate?: string,
  activityName?: string,
): string {
  const days = parseActivityCatalogDays(catalogDate);
  if (!days.length || !catalogDate?.trim()) return '';
  return days
    .map(day => formatActivityEventDayLabel(catalogDate, day, activityName))
    .join('、');
}

export function inferBuddySearchHintKind(
  displayLabel: string,
): BuddySearchHintKind | undefined {
  const label = displayLabel.trim();
  if (!label) return undefined;
  if (/（或.+区）/.test(label)) return 'day_or_zone';
  if (/\d+月\d+日/.test(label) && /区/.test(label)) return 'day_or_zone';
  if (/\d+月\d+日/.test(label)) return 'event_day';
  if (/[A-Za-z]区/.test(label) || /\d+号[A-Za-z]区/.test(label)) return 'zone';
  if (/\d+号/.test(label)) return 'event_day';
  return undefined;
}

export interface BuddySearchQueryInput {
  userInput: string;
  /** Intent Router / LLM 给出的检索 hint */
  searchHint?: string;
  activityDate?: string;
  activityName?: string;
}

function activityIncludesDay(catalogDate: string | undefined, day: number): boolean {
  return parseActivityCatalogDays(catalogDate).includes(day);
}

function addDayZoneTerms(
  terms: Set<string>,
  text: string,
  activityDate?: string,
  activityName?: string,
): void {
  const dayZoneRe = /(\d{1,2})\s*号\s*([A-Za-z])?\s*区?/g;
  let match = dayZoneRe.exec(text);
  while (match) {
    const day = Number(match[1]);
    const letter = match[2];
    terms.add(`${day}号`);
    if (letter) {
      terms.add(`${day}号${letter}区`);
      terms.add(`${day}号 ${letter}区`);
    }
    if (activityIncludesDay(activityDate, day) && activityDate) {
      terms.add(formatActivityEventDayLabel(activityDate, day, activityName));
      terms.add(`${day}日`);
    }
    match = dayZoneRe.exec(text);
  }

  const zoneOnly = text.match(/\b([A-Za-z])\s*区\b/g);
  if (zoneOnly) {
    for (const z of zoneOnly) terms.add(z.replace(/\s+/g, ''));
  }
}

/** 拼装 Chroma 检索 query（不做意图判断） */
export function buildBuddySearchQuery(input: BuddySearchQueryInput): string {
  const base = input.userInput.trim();
  const hint = input.searchHint?.trim();
  const terms = new Set<string>([base, '搭子', '同行', '组队']);
  if (hint) terms.add(hint);

  for (const text of [hint, base].filter((s): s is string => Boolean(s?.trim()))) {
    addDayZoneTerms(terms, text, input.activityDate, input.activityName);
  }

  if (input.activityDate) {
    const iso = catalogDateToIso(
      input.activityDate,
      extractYearFromText(input.activityName),
    );
    if (iso) terms.add(iso);
  }

  return [...terms].join(' ');
}

export function buildZoneMatchEmptyReply(
  activityLabel: string,
  hintLabel: string,
  hintKind?: BuddySearchHintKind,
): string {
  const scope =
    hintKind === 'event_day'
      ? `「${hintLabel}」这场`
      : hintKind === 'day_or_zone'
        ? `「${hintLabel}」相关`
        : `「${hintLabel}」`;

  return [
    `暂未在「${activityLabel}」找到${scope}的搭子/组队帖 🔍`,
    '',
    hintKind === 'day_or_zone'
      ? '若你指的是活动日期或票区，可以补充更具体的信息（如出发城市、人数），我再帮你搜或发组队帖。'
      : '你可以：',
    '· 在活动详情页浏览其他场次/区域的组队帖并申请加入',
    '· 告诉我日期、人数、出发城市，我帮你在本活动发一条组队帖',
  ].join('\n');
}

export function buildZoneMatchFoundReply(
  activityLabel: string,
  hintLabel: string,
  matchLines: string[],
  hintKind?: BuddySearchHintKind,
): string {
  const scope =
    hintKind === 'event_day'
      ? `「${hintLabel}」这场`
      : `「${hintLabel}」`;

  return [
    `在「${activityLabel}」找到 ${matchLines.length} 条与${scope}相关的组队帖：`,
    '',
    ...matchLines,
    '',
    '可在活动详情页查看帖子并申请加入；若不合适，告诉我你的具体需求我再帮你找。',
  ].join('\n');
}
