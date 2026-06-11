import type { RequestActor } from '../../common/auth/request-actor.types';
import { ChatMessageDto } from '../../shared/chat';

/** TextParseAgent / ImageParseAgent 结构化输出 */
export interface ParsedPostDraft {
  /** 发帖正文 */
  body: string;
  description?: string;
  eventName?: string;
  eventTime?: string;
  location?: string;
  buddyType?: string;
  tags: string[];
  activityKeyword?: string;
  activityLegacyId?: number;
  ready: boolean;
}

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

/** RiskAgent 输出 */
export interface RiskAssessment {
  publishable: boolean;
  reason?: string;
  sanitizedBody?: string;
  violationType?: ViolationType;
  severity?: RiskSeverity;
}

export interface AgentParseInput {
  messages: ChatMessageDto[];
  input: string;
  activityLegacyId?: number;
  image?: string;
}

export interface UserMatchProfile {
  city?: string;
  favorGenres?: string[];
  likeMate?: boolean;
  budgetLevel?: string;
}

export interface RiskAssessOptions {
  /** Skip LLM moderation when rules and duplicate checks pass (shortcut confirm path). */
  rulesOnly?: boolean;
}

export interface RiskAgentInput {
  body: string;
  actor?: RequestActor;
  activityLegacyId?: number;
}

export interface RiskCommentInput {
  body: string;
  actor?: RequestActor;
  postId?: string;
}

export interface RiskImageInput {
  body: string;
  image?: string;
  actor?: RequestActor;
  activityLegacyId?: number;
}
