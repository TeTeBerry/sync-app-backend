export type ViolationType =
  | 'spam'
  | 'duplicate'
  | 'scalper'
  | 'traffic_diversion'
  | 'abuse'
  | 'illegal'
  | 'off_topic'
  | 'general';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RuleMatchResult {
  publishable: false;
  reason: string;
  violationType: ViolationType;
  severity: RiskSeverity;
}

export const POST_CONTACT_FORBIDDEN_MESSAGE =
  '帖子中不可包含联系方式（手机号、微信号、邮箱、链接等），请修改后重试。';

const SPAM_PATTERN = /(.)\1{8,}/;

const SCALPER_PATTERN =
  /黄牛|加价|代抢|出票|倒票|溢价|高价收|高价出|抢票代|囤票|转手|转票|票务/i;

const TRAFFIC_DIVERSION_PATTERN =
  /(?:微信|vx|wx|wxid|加我|私聊|二维码|引流|进群|代购群|扫码|加v|加V|➕v|➕V)/i;

const WECHAT_VARIANT_PATTERN =
  /\b(?:vx|wx|wxid)\b|微\s*信|威信|薇信|➕我|加好友/i;

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/i;

const CONTACT_LABEL_PATTERN = /联系方式[：:]/;

const PHONE_PATTERN = /(?<!\d)1[3-9]\d(?:[\s-]?\d){8}(?!\d)/;

const QQ_PATTERN = /(?:QQ|qq)(?:号|：|:)?[\s]*\d{5,12}/i;

const WECHAT_ID_PATTERN =
  /(?:微信号|微信\s*号|微信\s*ID|wxid|WXID)[：:\s]*[\w-]{4,}/i;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Detect explicit contact info that must not appear in posts. */
export function matchPostContactInfo(text: string): RuleMatchResult | null {
  const normalized = text.trim();
  if (!normalized) return null;

  if (
    CONTACT_LABEL_PATTERN.test(normalized) ||
    PHONE_PATTERN.test(normalized) ||
    QQ_PATTERN.test(normalized) ||
    WECHAT_ID_PATTERN.test(normalized) ||
    EMAIL_PATTERN.test(normalized)
  ) {
    return {
      publishable: false,
      reason: POST_CONTACT_FORBIDDEN_MESSAGE,
      violationType: 'traffic_diversion',
      severity: 'high',
    };
  }

  return null;
}

export function matchRiskRules(text: string): RuleMatchResult | null {
  const normalized = text.trim();
  if (!normalized) return null;

  if (SPAM_PATTERN.test(normalized)) {
    return {
      publishable: false,
      reason: '内容疑似重复字符灌水',
      violationType: 'spam',
      severity: 'medium',
    };
  }

  if (SCALPER_PATTERN.test(normalized)) {
    return {
      publishable: false,
      reason: '内容疑似黄牛倒票或私下票务交易',
      violationType: 'scalper',
      severity: 'high',
    };
  }

  const contactMatch = matchPostContactInfo(normalized);
  if (contactMatch) return contactMatch;

  if (
    TRAFFIC_DIVERSION_PATTERN.test(normalized) ||
    WECHAT_VARIANT_PATTERN.test(normalized)
  ) {
    return {
      publishable: false,
      reason: '内容疑似站外私聊或恶意引流',
      violationType: 'traffic_diversion',
      severity: 'high',
    };
  }

  if (URL_PATTERN.test(normalized)) {
    return {
      publishable: false,
      reason: POST_CONTACT_FORBIDDEN_MESSAGE,
      violationType: 'traffic_diversion',
      severity: 'high',
    };
  }

  return null;
}
