import { Injectable } from '@nestjs/common';
import { UserService } from '../../modules/user/user.service';
import { LlmService } from '../llm/llm.service';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import {
  buildKnownFactsSummary,
  isFindBuddyThread,
  parseConversationContext,
} from '../utils/conversation-context.parser';
import {
  DEFAULT_MATCH_RANKING_WEIGHTS,
  MatchRankingWeights,
  UserMatchProfile,
} from '../utils/match-ranking.util';
import type { UserMatchProfile as AgentUserMatchProfile } from './agent.types';

interface LlmProfileExtract {
  city?: string;
  favorGenres?: string[];
  likeMate?: boolean;
  budgetLevel?: string;
}

export interface UserProfileSyncResult {
  profile: UserMatchProfile;
  weights: MatchRankingWeights;
  updated: boolean;
}

const PROFILE_EXTRACT_SYSTEM = [
  '你是 UserProfileAgent，从多轮对话中提取用户组队偏好画像。',
  '只输出 JSON，字段：',
  '- city: 用户所在或出发城市（中文，如「上海」）',
  '- favorGenres: 常玩电音风格字符串数组，如 ["EDM","Techno"]',
  '- likeMate: 是否愿意与搭子结伴同行（boolean）',
  '- budgetLevel: 预算档位 low | medium | high',
  '若对话未提及某字段，省略该字段，不要猜测。',
].join('\n');

const KNOWN_GENRES = new Set([
  'edm',
  'techno',
  'house',
  'trance',
  'dubstep',
  'hardstyle',
  'psytrance',
  'bass',
]);

const RECENT_TURN_LIMIT = 12;

function formatConversationHistory(messages: ChatMessageDto[]): string {
  return messages
    .slice(-RECENT_TURN_LIMIT)
    .map(message => {
      const roleLabel =
        message.role === 'assistant'
          ? '助手'
          : message.role === 'user'
            ? '用户'
            : '系统';
      return `[${roleLabel}] ${message.content.trim()}`;
    })
    .join('\n');
}

function normalizeGenres(raw?: string[]): string[] {
  const genres = new Set<string>();
  for (const item of raw ?? []) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const normalized = trimmed.replace(/^#/, '');
    genres.add(normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase());
  }
  return [...genres];
}

function normalizeBudgetLevel(raw?: string): string | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  if (/低/.test(value)) return 'low';
  if (/高/.test(value)) return 'high';
  if (/中/.test(value)) return 'medium';
  return undefined;
}

function mergeProfiles(
  existing: UserMatchProfile | undefined,
  extracted: LlmProfileExtract,
  ctxCity?: string,
): UserMatchProfile {
  const merged: UserMatchProfile = { ...(existing ?? {}) };

  const city = extracted.city?.trim() || ctxCity?.trim();
  if (city) merged.city = city;

  const genres = normalizeGenres(extracted.favorGenres);
  if (genres.length) {
    merged.favorGenres = genres;
  }

  if (extracted.likeMate != null) {
    merged.likeMate = Boolean(extracted.likeMate);
  }

  const budgetLevel = normalizeBudgetLevel(extracted.budgetLevel);
  if (budgetLevel) merged.budgetLevel = budgetLevel;

  return merged;
}

function profilesEqual(
  left: UserMatchProfile | undefined,
  right: UserMatchProfile,
): boolean {
  const leftCity = left?.city?.trim() ?? '';
  const rightCity = right.city?.trim() ?? '';
  if (leftCity !== rightCity) return false;

  const leftGenres = (left?.favorGenres ?? []).map(g => g.toLowerCase()).sort().join(',');
  const rightGenres = (right.favorGenres ?? []).map(g => g.toLowerCase()).sort().join(',');
  if (leftGenres !== rightGenres) return false;

  if (Boolean(left?.likeMate) !== Boolean(right.likeMate)) return false;

  const leftBudget = left?.budgetLevel?.trim() ?? '';
  const rightBudget = right.budgetLevel?.trim() ?? '';
  return leftBudget === rightBudget;
}

function extractGenresFromText(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const genre of KNOWN_GENRES) {
    if (lower.includes(genre)) {
      found.add(genre.charAt(0).toUpperCase() + genre.slice(1));
    }
  }
  return [...found];
}

@Injectable()
export class UserProfileAgent {
  readonly id = 'user-profile';

  constructor(
    private readonly llmService: LlmService,
    private readonly userService: UserService,
  ) {}

  getMatchWeights(profile?: UserMatchProfile): MatchRankingWeights {
    const weights = { ...DEFAULT_MATCH_RANKING_WEIGHTS };

    if (profile?.city?.trim()) {
      weights.city = 0.18;
    }

    if ((profile?.favorGenres?.length ?? 0) >= 1) {
      weights.genreOverlap = 0.14;
    }
    if ((profile?.favorGenres?.length ?? 0) >= 2) {
      weights.genreOverlap = 0.16;
    }

    if (profile?.likeMate === true) {
      weights.likeMateCompatible = 0.1;
    } else if (profile?.likeMate === false) {
      weights.likeMateCompatible = 0.04;
    }

    return weights;
  }

  async buildProfileFromChat(
    messages: ChatMessageDto[],
    input: string,
    existingProfile?: UserMatchProfile,
  ): Promise<UserMatchProfile> {
    const trimmedInput = input.trim();
    const ctx = parseConversationContext(messages, trimmedInput);
    const history = formatConversationHistory(messages);
    const knownFacts = buildKnownFactsSummary(ctx);

    const userPrompt = [
      `【已知信息摘要】\n${knownFacts}`,
      history ? `【多轮对话】\n${history}` : '',
      trimmedInput ? `【最新用户消息】${trimmedInput}` : '',
      existingProfile
        ? `【已有画像】${JSON.stringify(existingProfile)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const extracted =
      (await this.llmService.invokeJson<LlmProfileExtract>(
        PROFILE_EXTRACT_SYSTEM,
        userPrompt,
      )) ?? {};

    const heuristicGenres = extractGenresFromText(
      `${history}\n${trimmedInput}`,
    );
    if (!extracted.favorGenres?.length && heuristicGenres.length) {
      extracted.favorGenres = heuristicGenres;
    }

    return mergeProfiles(existingProfile, extracted, ctx.city);
  }

  async syncProfileFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    userId?: string;
    authorName?: string;
  }): Promise<UserProfileSyncResult | null> {
    const { messages, input, userId, authorName } = params;
    const trimmedInput = input.trim();

    if (!trimmedInput || !isFindBuddyThread(messages)) {
      return null;
    }

    let existing: UserMatchProfile | undefined;
    try {
      const me = await this.userService.getMe(userId, authorName);
      existing = {
        city: me.city,
        favorGenres: me.favorGenres,
        likeMate: me.likeMate,
        budgetLevel: me.budgetLevel,
      };
    } catch {
      existing = undefined;
    }

    const profile = await this.buildProfileFromChat(
      messages,
      trimmedInput,
      existing,
    );

    const hasSignal = Boolean(
      profile.city ||
        (profile.favorGenres?.length ?? 0) > 0 ||
        profile.likeMate != null ||
        profile.budgetLevel,
    );
    if (!hasSignal) return null;

    const weights = this.getMatchWeights(profile);
    const changed = !profilesEqual(existing, profile);
    if (changed && userId?.trim()) {
      await this.userService.patchMe(
        {
          city: profile.city,
          favorGenres: profile.favorGenres,
          likeMate: profile.likeMate,
          budgetLevel: profile.budgetLevel,
        },
        userId,
        authorName,
      );
    }

    return { profile, weights, updated: changed };
  }

  toAgentProfile(profile: UserMatchProfile): AgentUserMatchProfile {
    return {
      city: profile.city,
      favorGenres: profile.favorGenres,
      likeMate: profile.likeMate,
      budgetLevel: profile.budgetLevel,
    };
  }
}
