import type { TravelGuideTaskSlots } from '@sync/chat-contracts/conversation-state.types';
import type { TravelGuideBudgetTier } from '@sync/chat-contracts/conversation-state.types';

export type TravelGuideSlotKey =
  | 'departure'
  | 'headcount'
  | 'budgetTier'
  | 'selfDrive'
  | 'accommodationNights';

export type TravelGuideChatDraft = Partial<TravelGuideTaskSlots>;

const DEPARTURE_CITIES = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '武汉',
  '南京',
  '重庆',
  '西安',
  '苏州',
  '天津',
  '长沙',
  '郑州',
  '东莞',
  '佛山',
  '宁波',
  '青岛',
  '厦门',
  '昆明',
  '大连',
  '沈阳',
  '哈尔滨',
  '福州',
  '合肥',
  '南昌',
  '南宁',
  '贵阳',
  '海口',
  '三亚',
  '珠海',
  '香港',
  '澳门',
  '台北',
] as const;

export function mergeTravelGuideDraft(
  base: TravelGuideChatDraft,
  patch: TravelGuideChatDraft,
): TravelGuideChatDraft {
  return {
    ...base,
    ...patch,
    departure: patch.departure?.trim() || base.departure,
    departureCity: patch.departureCity?.trim() || base.departureCity,
    headcount: patch.headcount ?? base.headcount,
    budgetTier: patch.budgetTier ?? base.budgetTier,
    selfDrive: patch.selfDrive ?? base.selfDrive,
    accommodationNights: patch.accommodationNights ?? base.accommodationNights,
  };
}

export function listMissingTravelGuideSlots(
  draft: TravelGuideChatDraft,
): TravelGuideSlotKey[] {
  const missing: TravelGuideSlotKey[] = [];
  if (!draft.departure?.trim()) missing.push('departure');
  if (draft.headcount == null || draft.headcount < 1) missing.push('headcount');
  if (!draft.budgetTier) missing.push('budgetTier');
  return missing;
}

export function travelGuideDraftToForm(
  draft: TravelGuideChatDraft,
  defaultNights: number,
):
  | (TravelGuideTaskSlots & {
      departure: string;
      headcount: number;
      budgetTier: TravelGuideBudgetTier;
      selfDrive: boolean;
      accommodationNights: number;
    })
  | null {
  if (listMissingTravelGuideSlots(draft).length > 0) return null;
  return {
    departure: draft.departure!.trim(),
    departureCity: draft.departureCity?.trim() || undefined,
    headcount: draft.headcount!,
    budgetTier: draft.budgetTier!,
    selfDrive: Boolean(draft.selfDrive),
    accommodationNights: draft.accommodationNights ?? defaultNights,
  };
}

export function buildTravelGuideCollectPrompt(
  missing: TravelGuideSlotKey[],
): string {
  const parts: string[] = [];
  if (missing.includes('departure')) parts.push('出发地（如上海、广州南站）');
  if (missing.includes('headcount')) parts.push('人数（如 2人）');
  if (missing.includes('budgetTier')) {
    parts.push('预算（可直接回复「经济」「舒适」或「豪华」）');
  }
  const need = parts.join('、');
  return ['好的，我来帮你生成出行攻略。', '', `请补充：${need}。`].join('\n');
}

export function parseTravelGuideChatMessage(
  text: string,
): TravelGuideChatDraft {
  const raw = text.trim();
  if (!raw) return {};

  const draft: TravelGuideChatDraft = {};

  const headcount = parseHeadcount(raw);
  if (headcount != null) draft.headcount = headcount;

  const budgetTier = parseBudgetTier(raw);
  if (budgetTier) draft.budgetTier = budgetTier;

  const selfDrive = parseSelfDrive(raw);
  if (selfDrive != null) draft.selfDrive = selfDrive;

  const nights = parseAccommodationNights(raw);
  if (nights != null) draft.accommodationNights = nights;

  const departure = parseDeparture(raw);
  if (departure) {
    draft.departure = departure.label;
    draft.departureCity = departure.city;
  }

  return draft;
}

function parseHeadcount(text: string): number | undefined {
  const m = text.match(/(\d+)\s*[人位名]/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 10) return undefined;
  return n;
}

function parseBudgetTier(text: string): TravelGuideBudgetTier | undefined {
  const t = text.trim();
  if (!t) return undefined;

  if (/^经济(档|型|预算)?$|^实惠$|^省钱$/.test(t)) return 'economy';
  if (/^豪华(档|型|预算)?$|^高端$|^奢华$/.test(t)) return 'comfort';
  if (/^舒适(档|型|预算)?$|^标准(档|型)?$|^中等$/.test(t)) {
    return 'standard';
  }

  if (/预算/.test(t)) {
    if (/经济|实惠|省钱/.test(t) && !/舒适|豪华/.test(t)) return 'economy';
    if (/豪华|高端|奢华/.test(t)) return 'comfort';
    if (/舒适|标准|中等/.test(t)) return 'standard';
  }

  if (/经济|实惠|省钱/.test(t) && !/舒适|豪华/.test(t)) return 'economy';
  if (/豪华|高端|奢华|600/.test(t)) return 'comfort';
  if (/舒适|中等|标准|400|500/.test(t)) return 'standard';
  return undefined;
}

function parseSelfDrive(text: string): boolean | undefined {
  if (/不自驾|非自驾|公共交通|地铁|高铁|飞机|打车/.test(text)) return false;
  if (/自驾|开车|驾车|自己开车/.test(text)) return true;
  return undefined;
}

function parseAccommodationNights(text: string): number | undefined {
  const m = text.match(/住?\s*(\d+)\s*晚/);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 7) return undefined;
  return n;
}

function parseDeparture(
  text: string,
): { label: string; city?: string } | undefined {
  const fromMatch = text.match(
    /(?:从|自)\s*([^，,。；;\s]{2,12}?)\s*(?:出发|走|去)/,
  );
  if (fromMatch?.[1]) {
    return labelToDeparture(fromMatch[1]);
  }

  const departMatch = text.match(
    /([^，,。；;\s]{2,12}?)\s*(?:出发|起飞|起飞地)/,
  );
  if (departMatch?.[1] && !/(帮我|规划|攻略|行程|生成)/.test(departMatch[1])) {
    return labelToDeparture(departMatch[1]);
  }

  for (const city of DEPARTURE_CITIES) {
    if (text.includes(city)) {
      return { label: city, city };
    }
  }

  return undefined;
}

function labelToDeparture(label: string): { label: string; city?: string } {
  const trimmed = label.trim().replace(/市$/, '');
  if (!trimmed) return undefined as never;
  const city = trimmed.length <= 4 ? trimmed : trimmed;
  const display = trimmed.length <= 4 ? city : trimmed;
  return { label: display, city };
}

export function isTravelGuideChatInterrupt(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/组队|拼卡|同路|住宿同行|有没有.*帖|发帖|发组队/.test(trimmed)) {
    return true;
  }
  return false;
}
