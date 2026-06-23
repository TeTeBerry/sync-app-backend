import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { UserService } from '../../modules/user/user.service';
import {
  mergeUserProfileHints,
  extractProfileGenresFromText,
  normalizeProfileBudgetLevel,
  normalizeProfileGenres,
  type UserMatchProfile,
} from '../../modules/user/user-profile-hints.util';
import { LlmService } from '../../infra/llm/llm.service';
import { ChatMessageDto } from '@sync/chat-contracts';
import { formatConversationHistory } from '../utils/conversation-format.util';
import {
  buildKnownFactsSummary,
  parseConversationContext,
} from '../conversation/conversation-context.parser';
import type { UserMatchProfile as AgentUserMatchProfile } from './agent.types';

interface LlmProfileExtract {
  city?: string;
  favorGenres?: string[];
  budgetLevel?: string;
}

export interface UserProfileSyncResult {
  profile: UserMatchProfile;
  updated: boolean;
}

const PROFILE_EXTRACT_SYSTEM = [
  '你是 UserProfileAgent，从多轮对话中提取用户偏好画像。',
  '只输出 JSON，字段：',
  '- city: 用户所在或出发城市（中文，如「上海」）',
  '- favorGenres: 常玩电音风格字符串数组，如 ["EDM","Techno"]',
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

  async syncProfileFromChat(_params: {
    messages: ChatMessageDto[];
    input: string;
    actor: RequestActor;
  }): Promise<UserProfileSyncResult | null> {
    return null;
  }

  toAgentProfile(profile: UserMatchProfile): AgentUserMatchProfile {
    return {
      city: profile.city,
      favorGenres: profile.favorGenres,
      budgetLevel: profile.budgetLevel,
    };
  }
}
