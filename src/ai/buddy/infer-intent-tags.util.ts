/**
 * Rule-based intent tags for buddy posts (zone, gender, event day).
 * Tags use the same # prefix format as LLM / seed data.
 */

const GENDER_TAG_RULES: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /姐妹|小姐姐|妹子|女搭子/i, tag: '#女生' },
  { pattern: /兄弟|老哥|男搭子/i, tag: '#男生' },
  { pattern: /女生优先|限女生|只要女生|女孩子更好/i, tag: '#女生优先' },
  { pattern: /男生优先|限男生|只要男生/i, tag: '#男生优先' },
  { pattern: /(\d+)人女生|女生同行|我们女生|女生一起/i, tag: '#女生' },
  { pattern: /(\d+)缺\d*男生|缺\d*男生|(\d+)人男生|男生同行/i, tag: '#男生' },
  { pattern: /女生|女孩子/i, tag: '#女生' },
  { pattern: /男生/i, tag: '#男生' },
];

function normalizeHashtag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function addTag(tags: Set<string>, tag: string): void {
  const normalized = normalizeHashtag(tag);
  if (normalized.length > 1) tags.add(normalized);
}

/** Extract zone / event-day tags from free text (e.g. 13A区, 13号A区). */
function inferZoneAndDayTags(text: string, tags: Set<string>): void {
  const dayZoneCompact = /(\d{1,2})([A-Za-z])区/g;
  let match: RegExpExecArray | null = dayZoneCompact.exec(text);
  while (match) {
    const day = match[1];
    const letter = match[2].toUpperCase();
    addTag(tags, `${day}号${letter}区`);
    addTag(tags, `${letter}区`);
    match = dayZoneCompact.exec(text);
  }

  const dayZoneSpaced = /(\d{1,2})\s*号\s*([A-Za-z])?\s*区?/g;
  match = dayZoneSpaced.exec(text);
  while (match) {
    const day = match[1];
    const letter = match[2];
    addTag(tags, `${day}号`);
    if (letter) {
      const upper = letter.toUpperCase();
      addTag(tags, `${day}号${upper}区`);
      addTag(tags, `${upper}区`);
    }
    match = dayZoneSpaced.exec(text);
  }

  const zoneOnly = text.match(/\b([A-Za-z])\s*区\b/g);
  if (zoneOnly) {
    for (const z of zoneOnly) {
      addTag(tags, z.replace(/\s+/g, ''));
    }
  }
}

const TICKET_RESALE_CITIES = [
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
];

/** Ticket transfer / resale: 折价出票, event name, city, date, tier. */
function inferTicketResaleTags(text: string, tags: Set<string>): void {
  const hasTicket = /票|内场|看台|舞台|VIP|Stage/i.test(text);
  const hasResale =
    /折价|出票|转票|转手|出一张|转让|临时有事|私我|需要的私|私聊/i.test(text);

  if (!hasTicket && !hasResale) return;

  if (/转票|转手/i.test(text)) {
    addTag(tags, '#转票');
  }
  if (/出票|折价|出一张|转让/i.test(text)) {
    addTag(tags, '#出票');
  }
  if (hasTicket && hasResale && !tags.has('#转票') && !tags.has('#出票')) {
    addTag(tags, '#出票');
  }

  if (/折价/i.test(text)) {
    addTag(tags, '#折价');
  }
  if (/\bVIP\b/i.test(text)) {
    addTag(tags, '#VIP');
  }
  if (/\bStage\b/i.test(text)) {
    addTag(tags, '#Stage');
  }

  if (/ASOT/i.test(text)) {
    addTag(tags, '#ASOT');
  }

  for (const city of TICKET_RESALE_CITIES) {
    if (text.includes(city)) {
      addTag(tags, `#${city}`);
    }
  }

  const dotDate = text.match(/(\d{1,2})\.(\d{1,2})(?!\d)/);
  if (dotDate) {
    addTag(tags, `#${dotDate[1]}.${dotDate[2]}`);
  }

  const cnDate = text.match(/(\d{1,2})月(\d{1,2})日?/);
  if (cnDate) {
    addTag(tags, `#${cnDate[1]}.${cnDate[2]}`);
  }
}

/**
 * Infer display tags from post body / user message (MVP rule + synonym map).
 */
export function inferIntentTagsFromText(
  ...texts: Array<string | undefined>
): string[] {
  const tags = new Set<string>();
  const haystack = texts
    .map((t) => t?.trim())
    .filter((t): t is string => Boolean(t))
    .join('\n');

  if (!haystack) return [];

  for (const { pattern, tag } of GENDER_TAG_RULES) {
    if (pattern.test(haystack)) {
      addTag(tags, tag);
    }
  }

  inferZoneAndDayTags(haystack, tags);
  inferTicketResaleTags(haystack, tags);

  if (/搭子|组队|cpdd|dd一个|缺\d|有人吗|有姐妹|找同行/i.test(haystack)) {
    addTag(tags, '#组队');
  }

  return [...tags];
}
