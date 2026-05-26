export type ViolationType =
  | 'spam'
  | 'duplicate'
  | 'scalper'
  | 'traffic_diversion'
  | 'abuse'
  | 'general';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RuleMatchResult {
  publishable: false;
  reason: string;
  violationType: ViolationType;
  severity: RiskSeverity;
}

const SPAM_PATTERN = /(.)\1{8,}/;

const SCALPER_PATTERN =
  /黄牛|加价|代抢|出票|倒票|溢价|高价收|高价出|抢票代|囤票|转手|转票/i;

const TRAFFIC_DIVERSION_PATTERN =
  /(?:微信|vx|wx|wxid|加我|私聊|二维码|引流|进群|代购群|扫码|加v|加V|➕v|➕V)/i;

const WECHAT_VARIANT_PATTERN =
  /\b(?:vx|wx|wxid)\b|微\s*信|威信|薇信|➕我|加好友/i;

export function matchRiskRules(text: string): RuleMatchResult | null {
  const normalized = text.trim();
  if (!normalized) return null;

  if (SPAM_PATTERN.test(normalized)) {
    return {
      publishable: false,
      reason: '内容疑似重复字符 spam',
      violationType: 'spam',
      severity: 'medium',
    };
  }

  if (SCALPER_PATTERN.test(normalized)) {
    return {
      publishable: false,
      reason: '内容疑似黄牛倒票或加价引流',
      violationType: 'scalper',
      severity: 'high',
    };
  }

  if (
    TRAFFIC_DIVERSION_PATTERN.test(normalized) ||
    WECHAT_VARIANT_PATTERN.test(normalized)
  ) {
    return {
      publishable: false,
      reason: '内容疑似站外引流（如微信导流）',
      violationType: 'traffic_diversion',
      severity: 'high',
    };
  }

  return null;
}
