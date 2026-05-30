import { MATCH_EMPTY_POST_BODY_PROMPT } from '../gate/recommend-gate.util';
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

  const lines = [`暂未在「${activityLabel}」找到${scope}的搭子/组队帖 🔍`, ''];

  if (hintKind === 'day_or_zone') {
    lines.push(
      '若你指的是活动日期或票区，可以补充更具体的信息（如出发城市、人数），我再帮你搜或发组队帖。',
      '',
    );
  }

  lines.push(MATCH_EMPTY_POST_BODY_PROMPT);
  return lines.join('\n');
}

export function formatZoneMatchScope(
  hintLabel: string,
  hintKind?: BuddySearchHintKind,
): string {
  return hintKind === 'event_day'
    ? `「${hintLabel}」这场`
    : `「${hintLabel}」`;
}

export interface BuddySearchHintConstraints {
  eventDayLabels: string[];
  catalogDayNumbers: number[];
  zoneLabels: string[];
  zoneLetters: string[];
}

function collectRegexMatches(text: string, pattern: RegExp): RegExpExecArray[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null = re.exec(text);
  while (match) {
    matches.push(match);
    match = re.exec(text);
  }
  return matches;
}

/** 从检索 hint 提取日期/票区约束，用于过滤明显不相关的推荐帖 */
export function parseBuddySearchHintConstraints(
  hintLabel: string,
  hintKind?: BuddySearchHintKind,
): BuddySearchHintConstraints | null {
  const label = hintLabel.trim();
  if (!label || !hintKind) return null;
  if (hintKind !== 'event_day' && hintKind !== 'zone' && hintKind !== 'day_or_zone') {
    return null;
  }

  const eventDayLabels = collectRegexMatches(label, /(\d{1,2})月(\d{1,2})日/g).map(
    match => `${match[1]}月${match[2]}日`,
  );
  const catalogDayNumbers = new Set<number>();
  for (const match of collectRegexMatches(label, /(\d{1,2})月(\d{1,2})日/g)) {
    catalogDayNumbers.add(Number(match[2]));
  }
  for (const match of collectRegexMatches(label, /(\d{1,2})\s*号\s*([A-Za-z])?\s*区?/g)) {
    catalogDayNumbers.add(Number(match[1]));
  }

  const zoneLabels: string[] = [];
  const zoneLetters = new Set<string>();
  for (const match of collectRegexMatches(label, /(\d{1,2})\s*号\s*([A-Za-z])\s*区/gi)) {
    const day = match[1];
    const letter = (match[2] ?? '').toUpperCase();
    zoneLabels.push(`${day}号${letter}区`);
    zoneLetters.add(letter);
  }
  for (const match of collectRegexMatches(label, /\b([A-Za-z])\s*区\b/g)) {
    zoneLetters.add(match[1].toUpperCase());
  }

  if (!eventDayLabels.length && !catalogDayNumbers.size && !zoneLabels.length && !zoneLetters.size) {
    return null;
  }

  return {
    eventDayLabels,
    catalogDayNumbers: [...catalogDayNumbers],
    zoneLabels,
    zoneLetters: [...zoneLetters],
  };
}

export function postTextMatchesBuddySearchHint(
  text: string,
  constraints: BuddySearchHintConstraints,
): boolean {
  const haystack = text.trim();
  if (!haystack) return false;

  const mentionsDay = (day: number): boolean => {
    const monthDay = new RegExp(`\\d+月${day}日`);
    return (
      monthDay.test(haystack) ||
      new RegExp(`${day}\\s*日`).test(haystack) ||
      new RegExp(`${day}\\s*号`).test(haystack)
    );
  };

  const mentionsEventDayLabel = (label: string): boolean => haystack.includes(label);

  const dayMatched =
    constraints.eventDayLabels.some(mentionsEventDayLabel) ||
    constraints.catalogDayNumbers.some(mentionsDay);

  if (constraints.catalogDayNumbers.length) {
    const conflictingDays = constraints.catalogDayNumbers
      .map(day => day + 1)
      .filter(nextDay => mentionsDay(nextDay) && !mentionsDay(nextDay - 1));

    if (conflictingDays.length && !dayMatched) {
      return false;
    }

    if (dayMatched && constraints.catalogDayNumbers.length === 1) {
      const target = constraints.catalogDayNumbers[0];
      const onlyNextDay =
        mentionsDay(target + 1) &&
        !mentionsDay(target) &&
        !constraints.eventDayLabels.some(mentionsEventDayLabel);
      if (onlyNextDay) return false;
    }
  }

  if (constraints.eventDayLabels.length && !dayMatched) {
    return false;
  }

  if (constraints.zoneLabels.length || constraints.zoneLetters.length) {
    const zoneMatched =
      constraints.zoneLabels.some(zone =>
        haystack.toUpperCase().includes(zone.toUpperCase()),
      ) ||
      constraints.zoneLetters.some(letter => {
        if (!new RegExp(`${letter}\\s*区`, 'i').test(haystack)) return false;
        if (dayMatched) return true;
        return constraints.catalogDayNumbers.some(day =>
          new RegExp(`${day}\\s*号`).test(haystack),
        );
      });

    if (!zoneMatched) return false;
  }

  return true;
}

export function filterMatchesByBuddySearchHint<T extends { snippet: string }>(
  matches: T[],
  hintLabel: string,
  hintKind?: BuddySearchHintKind,
): T[] {
  const constraints = parseBuddySearchHintConstraints(hintLabel, hintKind);
  if (!constraints) return matches;

  const filtered = matches.filter(match =>
    postTextMatchesBuddySearchHint(match.snippet, constraints),
  );

  return filtered.length ? filtered : matches;
}

export function buildZoneMatchFoundReply(
  activityLabel: string,
  hintLabel: string,
  matchLines: string[],
  hintKind?: BuddySearchHintKind,
  options?: { cardsOnly?: boolean },
): string {
  const scope = formatZoneMatchScope(hintLabel, hintKind);

  if (options?.cardsOnly) {
    return [
      `在「${activityLabel}」找到 ${matchLines.length} 条与${scope}相关的组队帖，点下方卡片查看：`,
      '',
      '若不合适，回复「自己发帖」或补充你的出行需求，我再帮你发组队帖。',
    ].join('\n');
  }

  return [
    `在「${activityLabel}」找到 ${matchLines.length} 条与${scope}相关的组队帖：`,
    '',
    ...matchLines,
    '',
    '可在活动详情页查看帖子并申请加入；若不合适，告诉我你的具体需求我再帮你找。',
  ].join('\n');
}
