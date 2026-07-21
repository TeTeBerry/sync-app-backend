/** Shared violation taxonomy for account-risk escalation. */
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
