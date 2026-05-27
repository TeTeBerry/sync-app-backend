/** 线下拼车/拼住宿安全提示（合规内容末尾追加） */
export const TRAVEL_SAFETY_TIP =
  '【安全提醒：线下拼车、拼住宿存在人身及财产风险，请务必核实对方身份，尽量多人同行，保护个人隐私与财物安全】';

const PHONE_PATTERN =
  /(?<!\d)1[3-9]\d(?:[\s-]?\d){8}(?!\d)/g;

const QQ_PATTERN = /(?:QQ|qq)(?:号|：|:)?[\s]*\d{5,12}/gi;

const WECHAT_ID_PATTERN =
  /(?:微信号|微信ID|wxid|WXID)[：:\s]*[\w-]{4,}/gi;

const ID_CARD_PATTERN = /\b\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g;

const BANK_CARD_PATTERN = /\b(?:62\d{14,17}|4\d{15}|5[1-5]\d{14}|3[47]\d{13})\b/g;

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

const ORDER_NO_PATTERN =
  /(?:订单号|订单编号|支付单号|交易号)[：:\s]*[\w-]{8,}/gi;

const TRAVEL_SAFETY_KEYWORDS =
  /拼车|拼住宿|同住|拼房|合住|一起住|拼车去|拼酒店|拼民宿/;

/** Remove internal desensitization placeholders from publishable text. */
export function stripDesensitizationMarkers(text: string): string {
  return text
    .replace(/【已脱敏】/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 规则层隐私脱敏（LLM 不可用或未返回 content 时的兜底） */
export function desensitizePrivacy(text: string): string {
  let result = text;
  const patterns = [
    PHONE_PATTERN,
    QQ_PATTERN,
    WECHAT_ID_PATTERN,
    ID_CARD_PATTERN,
    BANK_CARD_PATTERN,
    URL_PATTERN,
    ORDER_NO_PATTERN,
  ];
  for (const pattern of patterns) {
    result = result.replace(pattern, ' ');
  }
  return stripDesensitizationMarkers(result);
}

export function needsTravelSafetyTip(text: string): boolean {
  return TRAVEL_SAFETY_KEYWORDS.test(text);
}

export function appendTravelSafetyTip(content: string, sourceHint: string): string {
  if (!needsTravelSafetyTip(sourceHint)) return content.trim();
  if (content.includes('安全提醒：线下拼车')) return content.trim();
  const trimmed = content.trim();
  return trimmed ? `${trimmed}\n\n${TRAVEL_SAFETY_TIP}` : TRAVEL_SAFETY_TIP;
}

/** 组装可发布的脱敏正文（含条件安全提示） */
export function buildPublishableBody(raw: string, llmContent?: string): string {
  const base = stripDesensitizationMarkers(
    (llmContent?.trim() || desensitizePrivacy(raw.trim())).trim(),
  );
  return appendTravelSafetyTip(base, raw);
}
