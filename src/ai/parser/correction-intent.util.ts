import type { TicketDraftField } from './slot-meta.types';

const GLOBAL_CORRECTION_RE =
  /不对|错了|应该是|改成|改为|纠正|说错了|不是.*是|之前.*错/i;

const FIELD_CORRECTION_RES: Record<TicketDraftField, RegExp[]> = {
  activityKeyword: [
    /活动\s*(?:是|为|改成|改为)/i,
    /^(?:是|对|就是)\s*\S+/i,
  ],
  activityId: [/活动\s*(?:是|为|改成|改为)/i, /^(?:是|对|就是)\s*\S+/i],
  eventDate: [/(?:演出日期|日期)\s*(?:是|为|改成|改为)/i],
  skuCode: [/票种\s*(?:是|为|改成|改为)/i, /^ga$|^vip$/i],
  quantity: [/数量\s*(?:是|为|改成|改为)/i, /(\d+)\s*张/i],
  price: [
    /(?:价格|单价|售价|预算)\s*(?:是|为|改成|改为)/i,
    /(?:价格|单价|售价|预算)\s*[:：]?\s*\d+/i,
    /\d+\s*元/i,
  ],
  contact: [/(?:联系方式|联系)\s*(?:是|为|改成|改为)/i, /1\d{10}|微信/i],
};

/** 识别用户本轮是否在明确纠正某些字段 */
export function detectCorrectionFields(input: string): Set<TicketDraftField> {
  const text = input.trim();
  const fields = new Set<TicketDraftField>();
  if (!text) return fields;

  for (const [field, patterns] of Object.entries(FIELD_CORRECTION_RES) as Array<
    [TicketDraftField, RegExp[]]
  >) {
    if (patterns.some(pattern => pattern.test(text))) {
      fields.add(field);
    }
  }

  if (GLOBAL_CORRECTION_RE.test(text)) {
    for (const [field, patterns] of Object.entries(FIELD_CORRECTION_RES) as Array<
      [TicketDraftField, RegExp[]]
    >) {
      if (patterns.some(pattern => pattern.test(text))) {
        fields.add(field);
      }
    }
  }

  return fields;
}

export function isFieldCorrection(
  field: TicketDraftField,
  correctionFields: Set<TicketDraftField>,
): boolean {
  return correctionFields.has(field);
}

export function shouldOverrideField(
  field: TicketDraftField,
  correctionFields: Set<TicketDraftField>,
): boolean {
  return correctionFields.has(field);
}
