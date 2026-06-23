import type { ViolationType } from '../../ai/agents/agent.types';

/** Rolling windows for violation / report counts. */
export const ACCOUNT_RISK_VIOLATION_WINDOW_DAYS = 30;
export const ACCOUNT_RISK_REPORT_WINDOW_DAYS = 14;

/** Scalper-specific publish violations (risk rules, ticket policy, LLM scalper). */
export const ACCOUNT_RISK_SCALPER_RESTRICT_COUNT = 2;
export const ACCOUNT_RISK_SCALPER_BAN_COUNT = 4;

/** Unique scalper reports from other users against this account. */
export const ACCOUNT_RISK_SCALPER_REPORT_RESTRICT_COUNT = 3;
export const ACCOUNT_RISK_SCALPER_REPORT_BAN_COUNT = 5;

/** Other high-severity publish/comment violations in the window. */
export const ACCOUNT_RISK_HIGH_SEVERITY_RESTRICT_COUNT = 4;

export const ACCOUNT_RISK_RESTRICT_DAYS = 7;
export const ACCOUNT_RISK_SCALPER_HEAVY_RESTRICT_DAYS = 14;
export const ACCOUNT_RISK_BAN_DAYS = 30;

export type { AccountRiskStatus } from '@sync/profile-contracts';

export const ACCOUNT_RISK_VIOLATION_TYPES_FOR_ESCALATION: ViolationType[] = [
  'scalper',
  'traffic_diversion',
  'abuse',
  'illegal',
  'spam',
  'general',
  'off_topic',
];

/** Duplicate post attempts do not escalate account tier. */
export function shouldEscalateAccountRisk(
  violationType?: ViolationType,
): boolean {
  return violationType !== 'duplicate';
}
