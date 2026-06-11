import type { TravelPlanReceiptCategory } from '../dto/recognize-travel-plan-receipt.dto';

export type LlmTravelPlanReceiptLeg = {
  title?: string;
  description?: string;
  cost?: number | string;
  remark?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
};

export type LlmTravelPlanReceiptResult = LlmTravelPlanReceiptLeg & {
  ready?: boolean;
  orderTotal?: number | string;
  legs?: LlmTravelPlanReceiptLeg[];
};

export type TravelPlanReceiptRecognizeForm = {
  title: string;
  description: string;
  cost: string;
  remark: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
};

export type TravelPlanReceiptRecognizeResponse = {
  ok: true;
  filled: boolean;
  category: TravelPlanReceiptCategory;
  form?: TravelPlanReceiptRecognizeForm;
  forms?: TravelPlanReceiptRecognizeForm[];
  message?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /1\d{10}/g;
const ID_PATTERN = /\d{17}[\dXx]/g;
const HOTEL_NIGHTS_PATTERN = /(\d+)\s*晚/;
const PERSONAL_NAME_FIELD_PATTERN =
  /(?:乘客|旅客|入住人|预订人|联系人|姓名|订户|入住宾客|旅客姓名|乘车人|乘机人|购票人|guest|passenger|name)[：:\s]*(?:[\u4e00-\u9fa5]{2,8}(?:\s*[/／]\s*[\u4e00-\u9fa5]{2,8})?|[A-Za-z][A-Za-z·.\s]{0,24}[A-Za-z])/gi;
const PERSONAL_NAME_INLINE_PATTERN =
  /(?:乘客|入住人|预订人|乘机人|乘车人|旅客)\s*[\u4e00-\u9fa5]{2,8}/g;

function stripPersonalNames(value: string): string {
  return value
    .replace(PERSONAL_NAME_FIELD_PATTERN, '')
    .replace(PERSONAL_NAME_INLINE_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[·•|,，\s]+|[·•|,，\s]+$/g, '')
    .trim();
}

function desensitizeText(value?: string): string {
  if (!value?.trim()) {
    return '';
  }
  return stripPersonalNames(
    value.replace(PHONE_PATTERN, '***').replace(ID_PATTERN, '***').trim(),
  );
}

function normalizeIsoDate(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !ISO_DATE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

const TRANSPORT_TIME_RANGE_PATTERN =
  /(\d{1,2}:\d{2})(?:\s*[-–—~至到]\s*(\d{1,2}:\d{2}))?/;

function parseTransportTimesFromDescription(description: string): {
  startTime?: string;
  endTime?: string;
} {
  const match = description.match(TRANSPORT_TIME_RANGE_PATTERN);
  if (!match) {
    return {};
  }

  const startTime = normalizeTime(match[1]);
  const endTime = match[2] ? normalizeTime(match[2]) : undefined;
  return {
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };
}

function alignIsoDateToYear(isoDate: string, yearHint: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || match[1] === yearHint) {
    return isoDate;
  }

  return `${yearHint}-${match[2]}-${match[3]}`;
}

function alignDateRangeToYear(
  range: { startDate: string; endDate: string },
  yearHint?: string,
) {
  if (!yearHint) {
    return range;
  }

  return {
    startDate: alignIsoDateToYear(range.startDate, yearHint),
    endDate: alignIsoDateToYear(range.endDate, yearHint),
  };
}

function normalizeTime(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) {
    return undefined;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const CURRENCY_AMOUNT_PATTERN =
  /(?:¥|￥|RMB|CNY)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*元/u;
const TRANSPORT_CODE_PATTERN =
  /\b(?:[A-Z]{1,3}\d{2,5}[A-Z]?|[GDCZKTFY]\d{1,4})\b/gi;

function normalizeCostDigits(digits: string): string {
  const value = Number.parseFloat(digits.replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 0) {
    return '';
  }
  return String(Math.round(value * 100) / 100);
}

function looksLikeTransportCode(value: string): boolean {
  const trimmed = value.trim().toUpperCase();
  return (
    /^[A-Z]{1,3}\d{2,5}[A-Z]?$/.test(trimmed) ||
    /^[GDCZKTFY]\d{1,4}$/.test(trimmed)
  );
}

function extractTransportCodes(context: {
  title?: string;
  description?: string;
  remark?: string;
}): string[] {
  const combined = `${context.title ?? ''} ${context.description ?? ''} ${context.remark ?? ''}`;
  return (combined.match(TRANSPORT_CODE_PATTERN) ?? []).map((code) =>
    code.toUpperCase(),
  );
}

function costOverlapsTransportDigits(cost: string, codes: string[]): boolean {
  if (!cost || codes.length === 0) {
    return false;
  }

  const costDigits = cost.replace(/\D/g, '');
  if (!costDigits) {
    return false;
  }

  for (const code of codes) {
    const upper = code.toUpperCase();
    const codeDigits = upper.replace(/\D/g, '');
    if (!codeDigits) {
      continue;
    }
    if (cost === upper || costDigits === codeDigits) {
      return true;
    }
    if (costDigits.length >= 3 && codeDigits.includes(costDigits)) {
      return true;
    }
    if (codeDigits.length >= 3 && costDigits.includes(codeDigits)) {
      return true;
    }
  }

  const mergedDigits = codes.map((code) => code.replace(/\D/g, '')).join('');
  if (costDigits.length >= 3 && mergedDigits.includes(costDigits)) {
    return true;
  }

  return false;
}

function isMisidentifiedTransportNumber(
  cost: string,
  context: { title?: string; description?: string; remark?: string },
): boolean {
  if (looksLikeTransportCode(cost)) {
    return true;
  }

  return costOverlapsTransportDigits(cost, extractTransportCodes(context));
}

function hasTransportCodesInContext(context: {
  title?: string;
  description?: string;
  remark?: string;
}): boolean {
  return extractTransportCodes(context).length > 0;
}

function normalizeLegCost(
  raw: number | string | undefined,
  context: { title?: string; description?: string; remark?: string },
): string {
  if (raw == null || raw === '') {
    return '';
  }

  const text = String(raw).trim();
  if (!text) {
    return '';
  }

  const currencyMatch = text.match(CURRENCY_AMOUNT_PATTERN);
  if (currencyMatch) {
    const amount = currencyMatch[1] ?? currencyMatch[2];
    return amount ? normalizeCostDigits(amount) : '';
  }

  if (/[A-Za-z]/.test(text) && !/(?:¥|￥|RMB|CNY|元)/i.test(text)) {
    const alphanumeric = text.replace(/[^\dA-Za-z]/g, '');
    if (looksLikeTransportCode(alphanumeric)) {
      return '';
    }
    return '';
  }

  if (hasTransportCodesInContext(context)) {
    return '';
  }

  const digits =
    typeof raw === 'number' && Number.isFinite(raw)
      ? String(raw)
      : text.replace(/[^\d.]/g, '');
  if (!digits) {
    return '';
  }

  if (isMisidentifiedTransportNumber(digits, context)) {
    return '';
  }

  return normalizeCostDigits(digits);
}

function normalizeOrderTotal(raw?: number | string): string {
  if (raw == null || raw === '') {
    return '';
  }

  const text = String(raw).trim();
  if (!text) {
    return '';
  }

  const currencyMatch = text.match(CURRENCY_AMOUNT_PATTERN);
  if (currencyMatch) {
    const amount = currencyMatch[1] ?? currencyMatch[2];
    return amount ? normalizeCostDigits(amount) : '';
  }

  const digits = text.replace(/[^\d.]/g, '');
  if (!digits || looksLikeTransportCode(digits)) {
    return '';
  }

  const value = Number.parseFloat(digits);
  if (!Number.isFinite(value) || value < 10 || value > 200_000) {
    return '';
  }

  return normalizeCostDigits(digits);
}

function applyOrderTotalToForms(
  forms: TravelPlanReceiptRecognizeForm[],
  orderTotal: string,
): TravelPlanReceiptRecognizeForm[] {
  const total = Number.parseFloat(orderTotal);
  if (!Number.isFinite(total) || total <= 0 || forms.length === 0) {
    return forms;
  }

  if (forms.length === 1) {
    return [{ ...forms[0], cost: orderTotal }];
  }

  const perLeg = Math.round((total / forms.length) * 100) / 100;
  const perLegText = String(perLeg);
  return forms.map((form) => ({ ...form, cost: perLegText }));
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate
    .split('-')
    .map((part) => Number.parseInt(part, 10));
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function parseHotelNights(description: string): number | null {
  const match = description.match(HOTEL_NIGHTS_PATTERN);
  if (!match) {
    return null;
  }
  const nights = Number.parseInt(match[1], 10);
  return Number.isFinite(nights) && nights > 0 ? nights : null;
}

function normalizeDateRange(startDate?: string, endDate?: string) {
  const start = normalizeIsoDate(startDate);
  const end = normalizeIsoDate(endDate);
  if (!start && !end) {
    return null;
  }
  if (start && end) {
    return start <= end
      ? { startDate: start, endDate: end }
      : { startDate: end, endDate: start };
  }
  const single = start ?? end!;
  return { startDate: single, endDate: single };
}

function resolveHotelDateRange(
  raw: LlmTravelPlanReceiptLeg,
  description: string,
) {
  const checkIn = normalizeIsoDate(raw.startDate ?? raw.checkInDate);
  let checkOut = normalizeIsoDate(raw.endDate ?? raw.checkOutDate);
  const nights = parseHotelNights(description);

  if (checkIn && !checkOut && nights) {
    checkOut = addDays(checkIn, nights);
  }

  if (checkIn && checkOut && checkIn === checkOut && nights) {
    checkOut = addDays(checkIn, nights);
  }

  return normalizeDateRange(checkIn ?? undefined, checkOut ?? undefined);
}

function resolveDateRange(
  category: TravelPlanReceiptCategory,
  raw: LlmTravelPlanReceiptLeg,
  description: string,
) {
  if (category === 'hotel') {
    return resolveHotelDateRange(raw, description);
  }
  return normalizeDateRange(raw.startDate, raw.endDate);
}

function buildFallbackDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function normalizeLeg(
  raw: LlmTravelPlanReceiptLeg,
  fallbackDate: string,
  category: TravelPlanReceiptCategory,
  yearHint?: string,
): TravelPlanReceiptRecognizeForm | null {
  const title = desensitizeText(raw.title);
  const description = desensitizeText(raw.description);
  const remark = desensitizeText(raw.remark);
  const cost = normalizeLegCost(raw.cost, {
    title: raw.title,
    description: raw.description,
    remark: raw.remark,
  });
  const range = resolveDateRange(category, raw, description);
  if (!title && !description && !cost && !remark && !range) {
    return null;
  }

  const resolvedRange = alignDateRangeToYear(
    range ?? { startDate: fallbackDate, endDate: fallbackDate },
    yearHint,
  );
  const parsedTransportTimes =
    category === 'transport'
      ? parseTransportTimesFromDescription(description)
      : {};
  const startTime =
    category === 'hotel'
      ? undefined
      : (normalizeTime(raw.startTime) ?? parsedTransportTimes.startTime);
  const endTime =
    category === 'hotel'
      ? undefined
      : (normalizeTime(raw.endTime) ?? parsedTransportTimes.endTime);

  return {
    title,
    description,
    cost,
    remark,
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
  };
}

function extractRawLegs(
  raw: LlmTravelPlanReceiptResult,
): LlmTravelPlanReceiptLeg[] {
  if (Array.isArray(raw.legs) && raw.legs.length > 0) {
    return raw.legs;
  }

  return [
    {
      title: raw.title,
      description: raw.description,
      cost: raw.cost,
      remark: raw.remark,
      startDate: raw.startDate,
      endDate: raw.endDate,
      startTime: raw.startTime,
      endTime: raw.endTime,
      checkInDate: raw.checkInDate,
      checkOutDate: raw.checkOutDate,
      checkInTime: raw.checkInTime,
      checkOutTime: raw.checkOutTime,
    },
  ];
}

function buildSuccessMessage(legCount: number): string {
  if (legCount > 1) {
    return `AI 识别完成，已拆分为 ${legCount} 段单程`;
  }
  return 'AI 识别完成，已自动填入';
}

export function normalizeTravelPlanReceiptResult(
  category: TravelPlanReceiptCategory,
  raw: LlmTravelPlanReceiptResult | null,
  options?: { yearHint?: string },
): TravelPlanReceiptRecognizeResponse {
  if (!raw || raw.ready === false) {
    return {
      ok: true,
      filled: false,
      category,
      message: '未能识别截图内容，请手动填写或更换清晰图片',
    };
  }

  const yearHint = options?.yearHint;
  const fallbackDate = yearHint
    ? alignIsoDateToYear(buildFallbackDate(), yearHint)
    : buildFallbackDate();
  const orderTotal = normalizeOrderTotal(raw.orderTotal);
  let forms = extractRawLegs(raw)
    .map((leg) => normalizeLeg(leg, fallbackDate, category, yearHint))
    .filter((leg): leg is TravelPlanReceiptRecognizeForm => leg != null);

  if (orderTotal) {
    forms = applyOrderTotalToForms(forms, orderTotal);
  }

  if (forms.length === 0) {
    return {
      ok: true,
      filled: false,
      category,
      message: '未能识别有效字段，请手动填写',
    };
  }

  return {
    ok: true,
    filled: true,
    category,
    form: forms[0],
    forms,
    message: buildSuccessMessage(forms.length),
  };
}
