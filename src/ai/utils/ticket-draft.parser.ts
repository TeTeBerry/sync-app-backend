import { ChatMessageDto } from '../dto/chat.dto';

export interface TicketDraft {
  activityId?: string;
  /** 用户原始活动描述，用于匹配 */
  activityKeyword?: string;
  eventDate?: string;
  skuCode?: string;
  quantity?: number;
  price?: number;
  contact?: string;
  type?: 'sell' | 'buy';
}

const CONFIRM_RE = /^(好的|好|确认|可以|没问题|行|嗯|对|是的|ok|yes|y)$/i;

const SKU_RE =
  /(双日票?|单日票?|三日票?|vip\s*[a-z区]*|ga|普通区|预售票?|电子票)/gi;

const FIELD_PATTERNS = {
  activityName: /活动名称\s*[:：]\s*(.+)/,
  eventDate: /演出日期\s*[:：]\s*(.+)/,
  skuCode: /票种\s*[:：]\s*(.+)/,
  quantity: /数量\s*[:：]\s*(\d+)/,
  price: /价格\s*[:：]\s*(\d+)/,
  contact: /联系方式\s*[:：]\s*(\S+)/,
};

export function isTicketConfirmMessage(text: string): boolean {
  return CONFIRM_RE.test(text.trim());
}

/** 取用户确认前 AI 的复述摘要；避免整段历史污染 */
function getConfirmationSource(messages: ChatMessageDto[]): string {
  const lastUserIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(item => item.message.role === 'user')?.index;

  if (lastUserIndex == null) {
    return messages.map(item => item.content).join('\n');
  }

  for (let index = lastUserIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;
    if (/活动名称|演出日期|票种|请确认|信息如下|确认以下/.test(message.content)) {
      return message.content;
    }
  }

  const windowStart = Math.max(0, lastUserIndex - 8);
  return messages
    .slice(windowStart, lastUserIndex + 1)
    .map(item => item.content)
    .join('\n');
}

function parseStructuredConfirmation(source: string): Partial<TicketDraft> {
  const draft: Partial<TicketDraft> = {};

  const activityMatch = source.match(FIELD_PATTERNS.activityName);
  if (activityMatch) {
    draft.activityKeyword = activityMatch[1].trim();
    draft.activityId = resolveActivityId(activityMatch[1]);
  }

  const dateField = source.match(FIELD_PATTERNS.eventDate);
  if (dateField) {
    draft.eventDate = normalizeDate(dateField[1]);
  }

  const skuField = source.match(FIELD_PATTERNS.skuCode);
  if (skuField) {
    draft.skuCode = normalizeSku(skuField[1]);
  }

  const qtyField = source.match(FIELD_PATTERNS.quantity);
  if (qtyField) {
    draft.quantity = Number(qtyField[1]);
  }

  const priceField = source.match(FIELD_PATTERNS.price);
  if (priceField) {
    draft.price = Number(priceField[1]);
  }

  const contactField = source.match(FIELD_PATTERNS.contact);
  if (contactField) {
    draft.contact = contactField[1].replace(/[，,。.]+$/, '');
  }

  return draft;
}

function normalizeDate(raw: string): string | undefined {
  const match = raw.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function normalizeSku(raw: string): string {
  const text = raw.trim();
  if (/双日/.test(text)) return '双日票';
  if (/单日/.test(text)) return '单日票';
  if (/三日/.test(text)) return '三日票';
  return text.replace(/\s+/g, '').slice(0, 20);
}

/** 区分 EDC 泰国 vs EDC China 等 */
export function resolveActivityId(text: string): string | undefined {
  const lower = text.toLowerCase();

  if (/edc|电音节/.test(lower)) {
    if (/泰国|thailand|泰國|曼谷|pattaya|芭提雅/.test(lower)) {
      return 'edc-thailand';
    }
    if (/中国|china|阳澄湖|苏州/.test(lower)) {
      return 'edc';
    }
    if (/泰国|thailand/.test(lower)) {
      return 'edc-thailand';
    }
    return 'edc';
  }

  if (/s2o|泼水/.test(lower)) return 's2o';
  if (/ultra/.test(lower)) return 'ultra';
  if (/tomorrowland|tmw|预热/.test(lower)) return 'tomorrowland';

  return undefined;
}

function parseFallbackFields(source: string, draft: TicketDraft): TicketDraft {
  const lower = source.toLowerCase();

  if (!draft.activityId) {
    draft.activityKeyword = draft.activityKeyword ?? source.slice(0, 80);
    draft.activityId = resolveActivityId(source);
  }

  if (!draft.eventDate) {
    const dates: string[] = [];
    const datePattern = /(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/g;
    let match: RegExpExecArray | null;
    while ((match = datePattern.exec(source)) !== null) {
      const normalized = normalizeDate(match[0]);
      if (normalized) dates.push(normalized);
    }
    if (dates.length) draft.eventDate = dates[dates.length - 1];
  }

  if (!draft.contact) {
    const phoneMatch = source.match(/1\d{10}/);
    if (phoneMatch) draft.contact = phoneMatch[0];
  }

  if (!draft.quantity) {
    const qtyMatch = source.match(/(\d+)\s*张/);
    if (qtyMatch) draft.quantity = Number(qtyMatch[1]);
    else if (/一张|1张|数量\s*[:：]\s*1/.test(source)) draft.quantity = 1;
  }

  if (!draft.skuCode) {
    const skuPattern = new RegExp(SKU_RE.source, SKU_RE.flags);
    const skuMatches: string[] = [];
    let skuMatch: RegExpExecArray | null;
    while ((skuMatch = skuPattern.exec(source)) !== null) {
      skuMatches.push(skuMatch[1]);
    }
    if (skuMatches.length) {
      draft.skuCode = normalizeSku(skuMatches[skuMatches.length - 1]);
    }
  }

  if (!draft.price) {
    const pricePatterns = [
      /(?:价格|单价|售价)\s*[:：]\s*(\d{2,5})/g,
      /(\d{2,5})\s*元/g,
    ];
    for (const pattern of pricePatterns) {
      let match: RegExpExecArray | null;
      const lastPrices: number[] = [];
      while ((match = pattern.exec(source)) !== null) {
        lastPrices.push(Number(match[1]));
      }
      if (lastPrices.length) {
        draft.price = lastPrices[lastPrices.length - 1];
        break;
      }
    }
  }

  if (!draft.price) {
    const nums: number[] = [];
    const priceFallback = /\b(\d{3,4})\b/g;
    let match: RegExpExecArray | null;
    while ((match = priceFallback.exec(source)) !== null) {
      nums.push(Number(match[1]));
    }
    const plausible = nums.filter(n => n >= 100 && n <= 9999);
    if (plausible.length) draft.price = plausible[plausible.length - 1];
  }

  if (!draft.type) {
    draft.type = /求购|收票|想买|我要买/.test(source) ? 'buy' : 'sell';
  }

  if (/中国|china/.test(lower) && draft.activityId === 'edc-thailand') {
    draft.activityId = 'edc';
  }

  return draft;
}

export function parseTicketDraft(messages: ChatMessageDto[]): TicketDraft {
  const source = getConfirmationSource(messages);
  const structured = parseStructuredConfirmation(source);
  const draft: TicketDraft = {
    type: /求购|收票|想买|我要买/.test(source) ? 'buy' : 'sell',
    ...structured,
  };

  return parseFallbackFields(source, draft);
}

export function isTicketDraftComplete(draft: TicketDraft): boolean {
  return Boolean(
    draft.activityId &&
      draft.eventDate &&
      draft.skuCode &&
      draft.quantity &&
      draft.quantity > 0 &&
      draft.price &&
      draft.price > 0 &&
      draft.contact &&
      draft.type,
  );
}

export function missingTicketDraftFields(draft: TicketDraft): string[] {
  const missing: string[] = [];
  if (!draft.activityId) missing.push('活动名称');
  if (!draft.eventDate) missing.push('演出日期');
  if (!draft.skuCode) missing.push('票种');
  if (!draft.quantity) missing.push('数量');
  if (!draft.price) missing.push('价格');
  if (!draft.contact) missing.push('联系方式');
  return missing;
}
