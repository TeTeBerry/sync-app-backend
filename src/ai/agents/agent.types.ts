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

import type { MatchRankingWeights } from '../utils/match-ranking.util';

export interface MatchAgentInput {
  query: string;
  activityCode: string;
  activityLegacyId?: number;
  limit?: number;
  userId?: string;
  profile?: UserMatchProfile;
  rankingWeights?: MatchRankingWeights;
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
