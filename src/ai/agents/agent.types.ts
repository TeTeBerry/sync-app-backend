import { ChatMessageDto } from '../presentation/chat-message.dto';

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

/** MatchAgent 单条匹配结果 */
export interface MatchedPostItem {
  postId: string;
  snippet: string;
  distance?: number;
  matchReason?: string;
}

export interface MatchAgentResult {
  items: MatchedPostItem[];
  degraded?: boolean;
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

import type { MatchRankingWeights } from '../match/match-ranking.util';
import type { BuddyMatchCriteria } from '../match/buddy-match.types';

export interface MatchAgentInput {
  query?: string;
  criteria?: BuddyMatchCriteria;
  activityCode?: string;
  activityLegacyId?: number;
  limit?: number;
  userId?: string;
  authorName?: string;
  profile?: UserMatchProfile;
  rankingWeights?: MatchRankingWeights;
}

export interface RiskAssessOptions {
  /** Skip LLM moderation when rules and duplicate checks pass (shortcut confirm path). */
  rulesOnly?: boolean;
}

export interface RiskAgentInput {
  body: string;
  userId?: string;
  activityLegacyId?: number;
}

export interface RiskCommentInput {
  body: string;
  userId?: string;
  postId?: string;
}

export interface RiskImageInput {
  body: string;
  image: string;
  userId?: string;
  activityLegacyId?: number;
}
