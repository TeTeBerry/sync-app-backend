import { ChatMessageDto } from '../presentation/chat-message.dto';
import {
  detectCorrectionFields,
  shouldOverrideField,
} from '../parser/correction-intent.util';
import { resolveFestivalBrand } from '../rag/festival-brand.util';
import { resolveUserContactInput } from './user-contact.util';
import { getDraftPriceBounds } from './ticket-price.util';

export interface TicketDraft {
  activityId?: string;
  /** 用户原始活动描述，用于匹配 */
  activityKeyword?: string;
  eventDate?: string;
  skuCode?: string;
  quantity?: number;
  price?: number;
  /** 价格区间上限；未填或与 price 相同时为单价 */
  priceMax?: number;
  contact?: string;
  type?: 'sell' | 'buy';
}

const PRICE_RANGE_RE =
  /(?:价格|单价|售价|预算)\s*[:：]?\s*(\d{2,5})\s*(?:-|~|到|至)\s*(\d{2,5})|(\d{2,5})\s*(?:-|~|到|至)\s*(\d{2,5})(?:\s*元)?/;

const STILL_CREATE_LISTING_RE =
  /继续发布|还是要发布|没有合适的|发布我的|创建我的|继续挂单|仍要发布/;

export function isStillCreateListingIntent(text: string): boolean {
  return STILL_CREATE_LISTING_RE.test(text.trim());
}

function resolveAccountPhone(accountPhone?: string): string | undefined {
  const phone = accountPhone?.trim();
  return phone && /1\d{10}/.test(phone) ? phone : undefined;
}

export function hasTicketContact(
  draft: Partial<TicketDraft>,
  accountPhone?: string,
): boolean {
  if (draft.contact?.trim()) return true;
  return Boolean(resolveAccountPhone(accountPhone));
}

export function hasTicketPrice(draft: Partial<TicketDraft>): boolean {
  return Boolean(getDraftPriceBounds(draft));
}

/** 解析价格区间，返回 [min, max]（已排序） */
export function parsePriceRange(
  text: string,
): { price: number; priceMax: number } | null {
  const trimmed = text.trim();
  const match = trimmed.match(PRICE_RANGE_RE);
  if (!match) return null;

  const a = Number(match[1] ?? match[3]);
  const b = Number(match[2] ?? match[4]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < 50 || b < 50 || a > 99999 || b > 99999) return null;

  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return { price: min, priceMax: max };
}

function applyPriceRange(
  draft: TicketDraft,
  range: { price: number; priceMax: number },
  text: string,
): void {
  if (shouldTreatNumberAsYearNotPrice(range.price, text, draft)) return;
  if (shouldTreatNumberAsYearNotPrice(range.priceMax, text, draft)) return;
  draft.price = range.price;
  draft.priceMax = range.priceMax > range.price ? range.priceMax : undefined;
}

const CONFIRM_RE = /^(好的|好|确认|可以|没问题|行|嗯|对|是的|ok|yes|y)$/i;

const LISTING_START_RE = /我有票要出|我要出票|我要收票|^出票$|^收票$|卖票/;

const SKU_TOKEN_RE =
  /(双日票?|单日票?|三日票?|vip\s*[a-z区]*|ga|普通区|预售票?|电子票)/i;

const EXPLICIT_FIELD_RES: Array<{
  key: keyof Pick<TicketDraft, 'skuCode' | 'contact' | 'activityKeyword' | 'eventDate' | 'quantity' | 'price'>;
  pattern: RegExp;
  map?: (match: RegExpMatchArray) => string | number | undefined;
}> = [
  {
    key: 'skuCode',
    pattern: /票种\s*(?:是|为|:|：)\s*([^\s，,。.]+)/i,
    map: (m) => normalizeSku(m[1]),
  },
  {
    key: 'contact',
    pattern: /(?:联系方式|联系)\s*(?:是|为|:|：)\s*(\S+)/i,
    map: (m) => m[1].replace(/[，,。.]+$/, ''),
  },
  {
    key: 'activityKeyword',
    pattern: /活动\s*(?:是|为|:|：)\s*(.+)/i,
    map: (m) => m[1].trim(),
  },
  {
    key: 'eventDate',
    pattern: /(?:演出日期|日期)\s*(?:是|为|:|：)\s*(.+)/i,
    map: (m) => normalizeDate(m[1]),
  },
  {
    key: 'quantity',
    pattern: /数量\s*(?:是|为|:|：)\s*(\d+)/i,
    map: (m) => Number(m[1]),
  },
  {
    key: 'price',
    pattern: /(?:价格|单价|售价|预算)\s*(?:是|为|:|：)\s*(\d+)/i,
    map: (m) => Number(m[1]),
  },
];

export function isTicketConfirmMessage(text: string): boolean {
  return CONFIRM_RE.test(text.trim());
}

/** 从对话线程判断出票 / 收票 */
export function resolveTicketListingType(
  messages: ChatMessageDto[],
): 'sell' | 'buy' {
  for (const message of messages) {
    if (message.role !== 'user') continue;
    if (/我要收票|^收票$|求购|想买/.test(message.content)) return 'buy';
    if (/我有票要出|我要出票|^出票$|卖票|转票/.test(message.content)) return 'sell';
  }
  return 'sell';
}

function getTicketListingUserMessages(messages: ChatMessageDto[]): string[] {
  let start = -1;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === 'user' && LISTING_START_RE.test(message.content)) {
      start = index;
    }
  }

  if (start < 0) return [];

  return messages
    .slice(start)
    .filter(message => message.role === 'user')
    .map(message => message.content.trim())
    .filter(Boolean)
    .filter(text => !LISTING_START_RE.test(text) && !isTicketConfirmMessage(text));
}

function isAssistantRecap(content: string): boolean {
  if (/请依次告诉我|信息齐全后我会复述/.test(content)) return false;
  return /(?:已记录：|请确认以下)/.test(content) && /·\s*活动：/.test(content);
}

function getLastAssistantRecap(messages: ChatMessageDto[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;
    if (isAssistantRecap(message.content)) {
      return message.content;
    }
  }
  return null;
}

function parseRecapBullets(source: string): Partial<TicketDraft> {
  const draft: Partial<TicketDraft> = {};

  const activityMatch = source.match(/·\s*活动：\s*(.+)/);
  if (activityMatch) {
    draft.activityKeyword = activityMatch[1].trim();
    draft.activityId = resolveActivityId(activityMatch[1]);
  }

  const dateMatch = source.match(/·\s*演出日期：\s*(.+)/);
  if (dateMatch) {
    draft.eventDate = normalizeDate(dateMatch[1]) ?? dateMatch[1].trim();
  }

  const skuMatch = source.match(/·\s*票种：\s*(.+)/);
  if (skuMatch) {
    draft.skuCode = normalizeSku(skuMatch[1]);
  }

  const qtyMatch = source.match(/·\s*数量：\s*(\d+)/);
  if (qtyMatch) {
    draft.quantity = Number(qtyMatch[1]);
  }

  const priceRangeMatch = source.match(
    /·\s*(?:单价|预算单价|预算)：\s*¥?(\d+)\s*-\s*(\d+)/,
  );
  if (priceRangeMatch) {
    draft.price = Number(priceRangeMatch[1]);
    draft.priceMax = Number(priceRangeMatch[2]);
  } else {
    const priceMatch = source.match(/·\s*(?:单价|预算单价|预算)：\s*¥?(\d+)/);
    if (priceMatch) {
      draft.price = Number(priceMatch[1]);
    }
  }

  const contactMatch = source.match(/·\s*联系方式：\s*(.+)/);
  if (contactMatch) {
    draft.contact = contactMatch[1].trim();
  }

  return draft;
}

function normalizeDate(raw: string): string | undefined {
  const match = raw.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function compactText(text: string): string {
  return text.toLowerCase().replace(/[\s.\-_/]+/g, '');
}

function isLikelyYear(value: number): boolean {
  return value >= 1900 && value <= 2100;
}

/** 1900–2100 仅在日期/活动届次语境下视为年份，否则可当作票价（如 2000 元） */
export function shouldTreatNumberAsYearNotPrice(
  value: number,
  text: string,
  draft?: Partial<TicketDraft>,
): boolean {
  if (value < 1900 || value > 2100) return false;

  const trimmed = text.trim();
  const dateMatch = trimmed.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (dateMatch && Number(dateMatch[1]) === value) return true;
  if (new RegExp(`\\b${value}\\b\\s*年`).test(trimmed)) return true;

  if (
    isActivityOnlyMessage(trimmed) &&
    !hasExplicitPriceSignal(trimmed) &&
    !/(?:手机|微信|电话|联系方式|联系)/.test(trimmed)
  ) {
    return true;
  }

  const collecting = Boolean(
    draft?.eventDate || draft?.activityId || draft?.quantity || draft?.skuCode,
  );
  if (collecting && /[,，]/.test(trimmed) && /\d/.test(trimmed)) {
    return false;
  }
  if (collecting && /(?:手机|微信|电话|元)/.test(trimmed)) {
    return false;
  }
  if (collecting && /^\d{3,5}$/.test(trimmed)) {
    return false;
  }

  return false;
}

/** 去掉「是/对/就是」等前缀，合并 ed c → edc */
export function normalizeActivityInput(text: string): string {
  let trimmed = text.trim();
  trimmed = trimmed.replace(/^(?:是|对|就是|活动是|活动)\s*/i, '');

  const compact = compactText(trimmed);
  if (compact === 'ed' || compact === 'edc' || compact.startsWith('edc')) {
    const yearMatch = trimmed.match(/\b(20\d{2})\b/);
    return yearMatch ? `EDC ${yearMatch[1]}` : 'EDC';
  }
  if (/泰国|thailand|泰國|曼谷|pattaya|芭提雅/.test(trimmed) && hasExplicitEdcMention(trimmed)) {
    return 'EDC Thailand';
  }
  if (/中国|china|阳澄湖|苏州/.test(trimmed) && hasExplicitEdcMention(trimmed)) {
    return 'EDC China';
  }

  return trimmed.replace(/\s+/g, ' ').trim();
}

function extractYear(text?: string): string | undefined {
  if (!text) return undefined;
  const match = text.match(/\b(20\d{2})\b/);
  return match?.[1];
}

/** 展示用活动名：优先用户 keyword/演出日期年份，避免 catalog 默认 2025 覆盖用户 2026 */
export function formatTicketActivityDisplayName(
  draft: TicketDraft,
  catalogName?: string,
): string {
  const keyword = draft.activityKeyword?.trim();
  const normalized = keyword ? normalizeActivityInput(keyword) : undefined;
  const keywordYear = extractYear(normalized) ?? extractYear(keyword);
  const dateYear = draft.eventDate?.slice(0, 4);
  const targetYear = keywordYear ?? dateYear;

  if (normalized) {
    if (targetYear && !extractYear(normalized)) {
      if (/^edc$/i.test(normalized)) {
        return `EDC ${targetYear}`;
      }
      if (/^edc china$/i.test(normalized)) {
        return `EDC China ${targetYear}`;
      }
      return `${normalized} ${targetYear}`.trim();
    }
    return normalized;
  }

  if (catalogName && targetYear) {
    if (/\b20\d{2}\b/.test(catalogName)) {
      return catalogName.replace(/\b20\d{2}\b/, targetYear);
    }
    return `${catalogName} ${targetYear}`.trim();
  }

  return catalogName ?? draft.activityId ?? '未知活动';
}

function hasExplicitPriceSignal(text: string): boolean {
  return /(?:价格|单价|售价|预算)\s*[:：]?\s*\d+|\d+\s*元/.test(text);
}

function isMultiFieldTicketMessage(text: string): boolean {
  return (
    /(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/.test(text) ||
    /(\d+)\s*张|一张|1张/.test(text) ||
    /1\d{10}/.test(text) ||
    /微信|手机|电话|vx|wx/i.test(text) ||
    SKU_TOKEN_RE.test(text) ||
    hasExplicitPriceSignal(text)
  );
}

function parseStandaloneSku(text: string): string | undefined {
  const trimmed = text.trim();
  if (/^ga$/i.test(trimmed)) return 'GA';
  if (/^vip$/i.test(trimmed)) return 'VIP';
  if (/^双日票?$|^单日票?$|^三日票?$/.test(trimmed)) {
    return normalizeSku(trimmed);
  }
  return undefined;
}

/** 用户本轮仅补充票种（如 GA、VIP），不应触发活动/日期推断 */
export function isSkuOnlyMessage(text: string): boolean {
  const trimmed = text.trim();
  const sku = parseStandaloneSku(trimmed);
  if (!sku) return false;
  if (resolveActivityId(trimmed)) return false;
  if (hasExplicitPriceSignal(trimmed)) return false;
  if (/(\d+)\s*张|一张|1张/.test(trimmed)) return false;
  if (/1\d{10}/.test(trimmed)) return false;
  if (/微信|手机|电话|vx|wx/i.test(trimmed)) return false;
  if (/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/.test(trimmed)) return false;
  return true;
}

function parseContact(text: string, accountPhone?: string): string | undefined {
  return (
    resolveUserContactInput(text, accountPhone) ??
    undefined
  );
}

function inferPrice(text: string, draft: TicketDraft): number | undefined {
  const comboPriceMatch = text.match(/^(\d{2,5})\s*[,，]/);
  if (comboPriceMatch) {
    const comboPrice = Number(comboPriceMatch[1]);
    if (
      comboPrice >= 50 &&
      comboPrice <= 99999 &&
      !shouldTreatNumberAsYearNotPrice(comboPrice, text, draft)
    ) {
      return comboPrice;
    }
  }

  const working = text
    .replace(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/g, ' ')
    .replace(/1\d{10}/g, ' ')
    .replace(/(\d+)\s*张/g, ' ');

  const pricePatterns = [
    /(?:价格|单价|售价|预算)\s*[:：]?\s*(\d{2,5})/,
    /(\d{2,5})\s*元/,
  ];
  for (const pattern of pricePatterns) {
    const match = working.match(pattern);
    if (match) {
      const price = Number(match[1]);
      if (!shouldTreatNumberAsYearNotPrice(price, text, draft)) return price;
    }
  }

  const nums: number[] = [];
  const re = /\b(\d{2,5})\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(working)) !== null) {
    const value = Number(match[1]);
    if (value >= 50 && value <= 99999 && !shouldTreatNumberAsYearNotPrice(value, text, draft)) {
      nums.push(value);
    }
  }
  if (!nums.length) return undefined;

  const onlyPriceMsg = /^\d{2,5}$/.test(text.trim());
  const collectingWithContext = Boolean(
    draft.activityId || draft.eventDate || draft.quantity || draft.skuCode,
  );

  if (
    hasExplicitPriceSignal(text) ||
    isMultiFieldTicketMessage(text) ||
    onlyPriceMsg ||
    collectingWithContext
  ) {
    return nums[nums.length - 1];
  }

  return undefined;
}

function hasNonActivitySignals(text: string): boolean {
  return (
    hasExplicitPriceSignal(text) ||
    SKU_TOKEN_RE.test(text) ||
    /(\d+)\s*张|一张|1张/.test(text) ||
    /1\d{10}/.test(text) ||
    /微信/.test(text) ||
    /(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/.test(text)
  );
}

/** 用户本轮主要在说活动名称/纠正活动，不应推断价格 */
function isActivityOnlyMessage(text: string): boolean {
  const normalized = normalizeActivityInput(text);
  const activityHint =
    Boolean(resolveActivityId(normalized)) ||
    /^(?:是|对|就是|活动)/.test(text.trim());

  if (!activityHint) return false;
  if (hasNonActivitySignals(text)) return false;

  // 单独年份（如 edc 2026）视为活动届次，不是价格
  if (/\b20\d{2}\b/.test(text) && !hasExplicitPriceSignal(text)) {
    return true;
  }

  return normalized.length <= 32;
}

function clearMistakenYearPrice(draft: TicketDraft, text?: string): void {
  if (draft.price == null) return;
  if (text && !shouldTreatNumberAsYearNotPrice(draft.price, text, draft)) return;
  if (isLikelyYear(draft.price)) {
    delete draft.price;
  }
}

function normalizeSku(raw: string): string {
  const text = raw.trim();
  if (/^ga$/i.test(text)) return 'GA';
  if (/^vip/i.test(text)) return 'VIP';
  if (/双日/.test(text)) return '双日票';
  if (/单日/.test(text)) return '单日票';
  if (/三日/.test(text)) return '三日票';
  return text.replace(/\s+/g, '').slice(0, 20);
}

/** 图片/文本中是否明确出现 EDC（不含泛称「电音节」） */
export function hasExplicitEdcMention(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const compact = compactText(text);
  if (!lower && !compact) return false;
  if (compact === 'ed' || compact === 'edc' || compact.startsWith('edc')) {
    return true;
  }
  if (/\bed\s*c\b/i.test(text)) return true;
  if (/edcchina|edcthailand|edc中国|edc泰国/.test(compact)) return true;
  return false;
}

function resolveEdcActivityId(text: string): string | undefined {
  if (!hasExplicitEdcMention(text)) return undefined;

  const lower = text.toLowerCase().trim();
  const compact = compactText(text);

  if (
    /泰国|thailand|泰國|曼谷|pattaya|芭提雅/.test(lower) ||
    /edcthailand|edc泰国/.test(compact)
  ) {
    return 'edc-thailand';
  }

  if (
    /中国|china|阳澄湖|苏州/.test(lower) ||
    /edcchina|edc中国/.test(compact)
  ) {
    return 'edc';
  }

  if (compact === 'ed' || compact === 'edc') {
    return 'edc';
  }

  return undefined;
}

/** 区分 VAC 珠海 vs 其他电音节 */
export function isVacActivityContext(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const compact = compactText(text);
  return (
    /\bvac\b|vision|colour|color|soundscape/.test(compact + lower) ||
    (/珠海|zhuhai|希尔顿|hilton/.test(lower) &&
      /vac|vision|colour|电音节|音乐节|soundscape/.test(compact + lower))
  );
}

/** 将活动关键词映射到平台 activity code；无明确匹配时返回 undefined */
export function resolveActivityId(text: string): string | undefined {
  const lower = text.toLowerCase().trim();
  const compact = compactText(text);
  if (!lower && !compact) return undefined;

  if (isVacActivityContext(text)) {
    return 'vac-zhuhai';
  }

  const edcId = resolveEdcActivityId(text);
  if (edcId) return edcId;

  const festival = resolveFestivalBrand(text);
  if (festival) return festival.brand.code;

  if (/s2o|泼水/.test(compact)) return 's2o';
  if (/ultra/.test(compact)) return 'ultra';
  if (/tomorrowland|tmw|预热/.test(compact)) return 'tomorrowland';

  return undefined;
}

export function absorbUserTicketMessage(
  text: string,
  draft: TicketDraft,
  accountPhone?: string,
): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const correctionFields = detectCorrectionFields(trimmed);

  for (const rule of EXPLICIT_FIELD_RES) {
    const match = trimmed.match(rule.pattern);
    if (!match) continue;
    const value = rule.map?.(match);
    if (value == null || value === '') continue;
    (draft as Record<string, unknown>)[rule.key] = value;
    if (rule.key === 'activityKeyword') {
      draft.activityId = resolveActivityId(String(value)) ?? draft.activityId;
    }
  }

  const normalizedActivity = normalizeActivityInput(trimmed);
  const activityId = resolveActivityId(normalizedActivity) ?? resolveActivityId(trimmed);
  const isActivityTurn =
    Boolean(activityId) &&
    (isActivityOnlyMessage(trimmed) ||
      normalizedActivity !== trimmed ||
      /^(?:是|对|就是|活动)/.test(trimmed));

  if (isActivityTurn && activityId) {
    draft.activityId = activityId;
    draft.activityKeyword = normalizedActivity;
    clearMistakenYearPrice(draft);
    if (isActivityOnlyMessage(trimmed) && !shouldOverrideField('price', correctionFields)) {
      return;
    }
  } else if (activityId && trimmed.length <= 24) {
    draft.activityId = activityId;
    draft.activityKeyword = normalizedActivity || trimmed;
  }

  if (shouldOverrideField('eventDate', correctionFields) || !draft.eventDate) {
    const dateMatch = trimmed.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
    if (dateMatch) {
      draft.eventDate = normalizeDate(dateMatch[0]);
    }
  }

  if (shouldOverrideField('quantity', correctionFields) || !draft.quantity) {
    const qtyMatch = trimmed.match(/(\d+)\s*张/);
    if (qtyMatch) {
      draft.quantity = Number(qtyMatch[1]);
    } else if (/一张|1张/.test(trimmed)) {
      draft.quantity = 1;
    }
  }

  if (shouldOverrideField('skuCode', correctionFields) || !draft.skuCode) {
    const standaloneSku = parseStandaloneSku(trimmed);
    if (standaloneSku) {
      draft.skuCode = standaloneSku;
    } else {
      const skuMatch = trimmed.match(SKU_TOKEN_RE);
      if (skuMatch) {
        draft.skuCode = normalizeSku(skuMatch[1]);
      }
    }
  }

  const range = parsePriceRange(trimmed);
  if (range) {
    applyPriceRange(draft, range, trimmed);
  } else {
    const explicitPriceMatch = trimmed.match(
      /(?:价格|单价|售价|预算)\s*[:：]?\s*(\d{2,5})/,
    );
    if (explicitPriceMatch) {
      const price = Number(explicitPriceMatch[1]);
      if (!shouldTreatNumberAsYearNotPrice(price, trimmed, draft)) {
        draft.price = price;
        delete draft.priceMax;
      }
    } else if (shouldOverrideField('price', correctionFields) || !draft.price) {
      const price = inferPrice(trimmed, draft);
      if (price != null) {
        draft.price = price;
        delete draft.priceMax;
      }
    }
  }

  if (shouldOverrideField('contact', correctionFields) || !draft.contact) {
    const contact = parseContact(trimmed, accountPhone);
    if (contact) {
      draft.contact = contact;
    }
  }

  clearMistakenYearPrice(draft, trimmed);
}

function fillMissingFromRecap(
  draft: TicketDraft,
  recap: Partial<TicketDraft>,
): TicketDraft {
  const next = { ...draft };
  const recapOnlyKeys: Array<keyof TicketDraft> = [
    'activityId',
    'activityKeyword',
    'eventDate',
    'quantity',
    'price',
  ];

  for (const key of recapOnlyKeys) {
    if (next[key] == null && recap[key] != null) {
      (next as Record<string, unknown>)[key] = recap[key];
    }
  }

  return next;
}

export function parseTicketDraft(messages: ChatMessageDto[]): TicketDraft {
  const draft: TicketDraft = {
    type: resolveTicketListingType(messages),
  };

  for (const content of getTicketListingUserMessages(messages)) {
    absorbUserTicketMessage(content, draft);
  }

  const recap = getLastAssistantRecap(messages);
  if (recap) {
    return fillMissingFromRecap(draft, parseRecapBullets(recap));
  }

  return draft;
}

/** 活动名称：catalog id 或用户/图片识别的 keyword 均视为已填写 */
export function hasTicketActivityName(draft: Partial<TicketDraft>): boolean {
  return Boolean(draft.activityId?.trim() || draft.activityKeyword?.trim());
}

export function isTicketDraftComplete(
  draft: TicketDraft,
  accountPhone?: string,
): boolean {
  return Boolean(
    hasTicketActivityName(draft) &&
      draft.eventDate &&
      draft.skuCode &&
      draft.quantity &&
      draft.quantity > 0 &&
      hasTicketPrice(draft) &&
      hasTicketContact(draft, accountPhone) &&
      draft.type,
  );
}

export function missingTicketDraftFields(
  draft: TicketDraft,
  accountPhone?: string,
): string[] {
  const missing: string[] = [];
  if (!hasTicketActivityName(draft)) missing.push('活动名称');
  if (!draft.eventDate) missing.push('演出日期');
  if (!draft.skuCode) missing.push('票种');
  if (!draft.quantity) missing.push('数量');
  if (!hasTicketPrice(draft)) missing.push('价格');
  if (!hasTicketContact(draft, accountPhone)) missing.push('联系方式');
  return missing;
}

/** 创建挂单前写入联系方式（含账号手机默认） */
export function resolveTicketDraftContact(
  draft: TicketDraft,
  accountPhone?: string,
): string {
  const explicit = draft.contact?.trim();
  if (explicit) return explicit;
  return resolveAccountPhone(accountPhone) ?? '';
}
