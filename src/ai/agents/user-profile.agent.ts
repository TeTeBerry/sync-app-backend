import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { UserService } from '../../modules/user/user.service';
import {
  hasUserMatchProfileSignal,
  mergeUserProfileHints,
  extractProfileGenresFromText,
  normalizeProfileBudgetLevel,
  normalizeProfileGenres,
  userMatchProfilesEqual,
} from '../../modules/user/user-profile-hints.util';
import { LlmService } from '../llm/llm.service';
import { ChatMessageDto } from '../../shared/chat';
import { formatConversationHistory } from '../utils/conversation-format.util';
import {
  buildKnownFactsSummary,
  isFindBuddyThread,
  parseConversationContext,
} from '../conversation/conversation-context.parser';
import {
  DEFAULT_MATCH_RANKING_WEIGHTS,
  MatchRankingWeights,
  UserMatchProfile,
} from '../match/match-ranking.util';
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

function mergeLlmExtract(
  existing: UserMatchProfile | undefined,
  extracted: LlmProfileExtract,
  ctxCity?: string,
): UserMatchProfile {
  const hints: UserMatchProfile = {};
  const city = extracted.city?.trim() || ctxCity?.trim();
  if (city) hints.city = city;

  const genres = normalizeProfileGenres(extracted.favorGenres);
  if (genres.length) hints.favorGenres = genres;

  if (extracted.likeMate != null) {
    hints.likeMate = Boolean(extracted.likeMate);
  }

  const budgetLevel = normalizeProfileBudgetLevel(extracted.budgetLevel);
  if (budgetLevel) hints.budgetLevel = budgetLevel;

  return mergeUserProfileHints(existing, hints);
}

@Injectable()
export class UserProfileAgent {
  readonly id = 'user-profile';

  constructor(
    private readonly llmService: LlmService,
    private readonly userService: UserService,
  ) {}

  /** Load persisted user profile for match ranking (no LLM). */
  async getStoredMatchProfile(
    actor: RequestActor,
  ): Promise<UserProfileSyncResult | null> {
    if (!actor.clientUserId.trim()) return null;
    try {
      const me = await this.userService.getMe(actor);
      const profile: UserMatchProfile = {
        city: me.city,
        favorGenres: me.favorGenres,
        likeMate: me.likeMate,
        budgetLevel: me.budgetLevel,
      };
      if (!hasUserMatchProfileSignal(profile)) return null;
      return {
        profile,
        weights: this.getMatchWeights(profile),
        updated: false,
      };
    } catch {
      return null;
    }
  }

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
      existingProfile ? `【已有画像】${JSON.stringify(existingProfile)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const extracted =
      (await this.llmService.invokeJson<LlmProfileExtract>(
        PROFILE_EXTRACT_SYSTEM,
        userPrompt,
      )) ?? {};

    const heuristicGenres = extractProfileGenresFromText(
      `${history}\n${trimmedInput}`,
    );
    if (!extracted.favorGenres?.length && heuristicGenres.length) {
      extracted.favorGenres = heuristicGenres;
    }

    return mergeLlmExtract(existingProfile, extracted, ctx.city);
  }

  async syncProfileFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    actor: RequestActor;
  }): Promise<UserProfileSyncResult | null> {
    const { messages, input, actor } = params;
    const trimmedInput = input.trim();

    if (!trimmedInput || !isFindBuddyThread(messages)) {
      return null;
    }

    let existing: UserMatchProfile | undefined;
    try {
      const me = await this.userService.getMe(actor);
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

    if (!hasUserMatchProfileSignal(profile)) return null;

    const weights = this.getMatchWeights(profile);
    const changed = !userMatchProfilesEqual(existing, profile);
    if (changed && actor.clientUserId.trim()) {
      await this.userService.patchMe(
        {
          city: profile.city,
          favorGenres: profile.favorGenres,
          likeMate: profile.likeMate,
          budgetLevel: profile.budgetLevel,
        },
        actor,
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
