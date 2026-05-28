import { inferIntentTagsFromText } from './infer-intent-tags.util';
import { inferPostContentTypes } from '../../modules/post/utils/post-content-type.util';

export interface ActivityScopeContext {
  name?: string;
  date?: string;
}

const TICKET_RESALE_BODY_RE =
  /折价|出票|转票|转手|出一张|转让|临时有事.*票|VIP.*票|Stage.*票/i;

/** Cities often used in ticket / travel posts (subset of infer-intent-tags). */
const SCOPE_CITIES = [
  '香港',
  '澳门',
  '台湾',
  '上海',
  '北京',
  '广州',
  '深圳',
  '成都',
  '杭州',
  '武汉',
  '南京',
  '重庆',
  '西安',
  '苏州',
  '珠海',
] as const;

/** Distinct festival / event tokens for cross-event detection. */
const EVENT_TOKEN_RULES: Array<{ pattern: RegExp; token: string }> = [
  { pattern: /\bASOT\b/i, token: 'asot' },
  { pattern: /风暴|storm/i, token: 'storm' },
  { pattern: /\bEDC\b/i, token: 'edc' },
  { pattern: /ultra|tomorrowland|tmw/i, token: 'ultra' },
  { pattern: /\bVAC\b/i, token: 'vac' },
  { pattern: /百威|creamfields/i, token: 'creamfields' },
];

function normalizeEventToken(text: string): string {
  return text.trim().toLowerCase();
}

function collectEventTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const { pattern, token } of EVENT_TOKEN_RULES) {
    if (pattern.test(text)) {
      tokens.add(token);
    }
  }
  return tokens;
}

function collectCities(text: string): Set<string> {
  const cities = new Set<string>();
  for (const city of SCOPE_CITIES) {
    if (text.includes(city)) {
      cities.add(city);
    }
  }
  return cities;
}

/** Parse M.D or M月D日 into comparable month-day keys (e.g. "6.12"). */
function collectMonthDayKeys(text: string): Set<string> {
  const keys = new Set<string>();

  const dotDate = text.match(/(\d{1,2})\.(\d{1,2})(?!\d)/);
  if (dotDate) {
    keys.add(`${Number(dotDate[1])}.${Number(dotDate[2])}`);
  }

  const slashDate = text.match(/(\d{1,2})\/(\d{1,2})(?!\d)/);
  if (slashDate) {
    keys.add(`${Number(slashDate[1])}.${Number(slashDate[2])}`);
  }

  const cnDate = text.match(/(\d{1,2})月(\d{1,2})日?/g);
  if (cnDate) {
    for (const part of cnDate) {
      const m = part.match(/(\d{1,2})月(\d{1,2})/);
      if (m) {
        keys.add(`${Number(m[1])}.${Number(m[2])}`);
      }
    }
  }

  return keys;
}

/** User is selling / transferring tickets (not looking for carpool teammates). */
export function isTicketResaleIntent(input: string): boolean {
  const text = input.trim();
  if (!text) return false;

  const tags = inferIntentTagsFromText(text);
  const types = inferPostContentTypes({ tags, body: text });
  if (types.includes('ticket')) {
    return true;
  }

  return TICKET_RESALE_BODY_RE.test(text) && /票|VIP|Stage|内场|看台/i.test(text);
}

/**
 * True when the user message targets a different event / city / date than the
 * activity-scoped chat (e.g. ASOT Hong Kong 6.12 inside Storm Shenzhen).
 */
export function isActivityScopeMismatch(
  userInput: string,
  activity?: ActivityScopeContext,
): boolean {
  const input = userInput.trim();
  const activityName = activity?.name?.trim();
  if (!input || !activityName) return false;

  const activityHaystack = [activityName, activity?.date]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ');

  const msgEvents = collectEventTokens(input);
  const activityEvents = collectEventTokens(activityHaystack);
  if (msgEvents.size > 0 && activityEvents.size > 0) {
    const overlaps = [...msgEvents].some(token => activityEvents.has(token));
    if (!overlaps) return true;
  } else if (msgEvents.size > 0) {
    const activityLower = activityHaystack.toLowerCase();
    const mentionedInActivity = [...msgEvents].some(token =>
      activityLower.includes(token),
    );
    if (!mentionedInActivity) return true;
  }

  const msgCities = collectCities(input);
  const activityCities = collectCities(activityHaystack);
  if (msgCities.size > 0 && activityCities.size > 0) {
    const overlaps = [...msgCities].some(city => activityCities.has(city));
    if (!overlaps) return true;
  }

  const msgDays = collectMonthDayKeys(input);
  const activityDays = collectMonthDayKeys(activityHaystack);
  if (msgDays.size > 0 && activityDays.size > 0) {
    const overlaps = [...msgDays].some(day => activityDays.has(day));
    if (!overlaps) return true;
  }

  return false;
}

/** Skip buddy matching when user is listing tickets (home or activity-scoped chat). */
export function shouldSkipActivityScopedBuddyRecommend(
  userInput: string,
  _activityLegacyId?: number,
): boolean {
  return isTicketResaleIntent(userInput);
}

export function buildTicketResaleScopeIntro(
  activityLabel: string,
  mismatch: boolean,
): string {
  if (mismatch) {
    return [
      `你这条是出票/转票信息，和当前打开的「${activityLabel}」不是同一场活动，我不会在这里推荐组队帖。`,
      '',
      '我先按你的描述整理一条转票帖草稿；确认后会在当前活动下发布。若要发到对应活动，请先切换到该活动页再发。',
    ].join('\n');
  }

  return [
    `收到，这是「${activityLabel}」相关的出票/转票信息。`,
    '',
    '我先帮你整理帖子草稿：',
  ].join('\n');
}
