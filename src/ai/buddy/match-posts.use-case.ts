import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  isAiShortcutTag,
  normalizeAiShortcutInput,
} from '../../common/utils/demo-owner.util';
import { MatchAgent, UserProfileAgent } from '../agents';
import type { UserProfileSyncResult } from '../agents/user-profile.agent';
import type { ConversationState } from '../conversation';
import type { BuddySearchHintPayload } from '../intent/chat-intent.types';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import { parseConversationContext } from '../conversation/conversation-context.parser';
import {
  buildMatchRecommendCardsIntro,
  MATCH_EMPTY_POST_BODY_PROMPT,
} from '../gate/recommend-gate.util';
import {
  buildZoneMatchEmptyReply,
  buildZoneMatchFoundReply,
  filterMatchesByBuddySearchHint,
  inferBuddySearchHintKind,
} from '../match/zone-buddy-search.util';
import { buildMatchCriteriaForSearch } from '../match/buddy-match-criteria.util';
import type { BuddyMatchCriteria } from '../match/buddy-match.types';
import { BUDDY_RECOMMEND_LIMIT } from '../match/buddy-match.constants';
import { AiMatchQuotaService } from '../ai-match-quota.service';
import { BuddyContextService } from './buddy-context.service';
import type { PostIntentMatchResult } from './buddy.types';

export interface PreResolvedActivity {
  legacyId?: number;
  name?: string;
  code?: string;
  date?: string;
}

export interface MatchPostsFromChatParams {
  messages: ChatMessageDto[];
  input: string;
  activityLegacyId?: number;
  actor: RequestActor;
  buddySearchHint?: BuddySearchHintPayload;
  fromIntentRouter?: boolean;
  profileSync?: UserProfileSyncResult | null;
  /** When caller already resolved activity (e.g. recommend-before-create), skip duplicate lookup. */
  preResolvedActivity?: PreResolvedActivity | null;
  matchCriteria?: BuddyMatchCriteria | null;
}

@Injectable()
export class MatchPostsFromChatUseCase {
  constructor(
    private readonly matchAgent: MatchAgent,
    private readonly userProfileAgent: UserProfileAgent,
    private readonly buddyContext: BuddyContextService,
    private readonly aiMatchQuota: AiMatchQuotaService,
  ) {}

  async execute(
    params: MatchPostsFromChatParams,
  ): Promise<PostIntentMatchResult | null> {
    const {
      messages,
      input,
      activityLegacyId,
      actor,
      buddySearchHint,
      fromIntentRouter,
      profileSync,
    } = params;
    const trimmed = input.trim();

    if (!trimmed) return null;

    if (
      !fromIntentRouter &&
      !buddySearchHint &&
      !this.buddyContext.isMatchExistingPostsIntent(trimmed)
    ) {
      return null;
    }

    const ctx = parseConversationContext(messages, trimmed);
    const isShortcutSearch = isAiShortcutTag(trimmed);

    // Profile sync and activity lookup are independent — run in parallel when possible.
    const skipProfileLlm =
      fromIntentRouter && isShortcutSearch && profileSync === undefined;

    const [resolvedProfileSync, resolvedActivity] = await Promise.all([
      profileSync ??
        (skipProfileLlm
          ? Promise.resolve(null)
          : this.userProfileAgent.syncProfileFromChat({
              messages,
              input: trimmed,
              actor,
            })),
      params.preResolvedActivity != null
        ? Promise.resolve(params.preResolvedActivity)
        : this.buddyContext.resolveActivity(ctx, activityLegacyId),
    ]);
    if (!resolvedActivity?.legacyId) {
      return null;
    }

    const hintDisplay = buddySearchHint?.displayLabel?.trim() || trimmed;
    const hintKind =
      buddySearchHint?.kind ?? inferBuddySearchHintKind(hintDisplay);

    const criteria =
      params.matchCriteria ??
      buildMatchCriteriaForSearch({
        activityLegacyId: resolvedActivity.legacyId,
        activityName: resolvedActivity.name,
        activityCode: resolvedActivity.code,
        activityDate: resolvedActivity.date,
        conversation: ctx,
        profileCity: resolvedProfileSync?.profile?.city,
        userInput: trimmed,
        zone: hintKind === 'zone' ? hintDisplay : undefined,
      });

    const isStructuredSearch = Boolean(
      fromIntentRouter || buddySearchHint?.displayLabel,
    );

    await this.aiMatchQuota.assertCanMatch(actor, resolvedActivity.legacyId);

    const matchResult = await this.matchAgent.match({
      criteria,
      activityCode: resolvedActivity.code ?? '',
      activityLegacyId: resolvedActivity.legacyId,
      limit: BUDDY_RECOMMEND_LIMIT,
      actor,
      profile: resolvedProfileSync?.profile,
      rankingWeights: resolvedProfileSync?.weights,
    });

    let matches = matchResult.items;
    const activityLabel = resolvedActivity.name ?? '活动';

    if (isStructuredSearch && hintDisplay) {
      matches = filterMatchesByBuddySearchHint(matches, hintDisplay, hintKind);
    }

    if (isShortcutSearch) {
      matches = await this.buddyContext.filterMatchesForShortcutTag(
        matches,
        trimmed,
      );
    }

    if (!matches.length) {
      const emptyShortcutLabel = normalizeAiShortcutInput(trimmed);
      return {
        matches: [],
        postCards: [],
        activityLabel,
        degraded: matchResult.degraded,
        replyText: isStructuredSearch
          ? buildZoneMatchEmptyReply(activityLabel, hintDisplay, hintKind)
          : isShortcutSearch
            ? [
                `暂未找到「${activityLabel}」下其他用户发布的「${emptyShortcutLabel}」相关帖子。`,
                '',
                MATCH_EMPTY_POST_BODY_PROMPT,
              ].join('\n')
            : [
                `暂未找到「${activityLabel}」相关的组队帖。`,
                '',
                MATCH_EMPTY_POST_BODY_PROMPT,
              ].join('\n'),
      };
    }

    const postCards = await this.buddyContext.buildRecommendedPostCards(
      matches,
      resolvedActivity.legacyId,
    );

    await this.aiMatchQuota.consumeIfMatched(
      actor,
      resolvedActivity.legacyId,
      postCards.length,
    );

    const lines = matches.map(
      (match, index) => `${index + 1}. ${match.snippet}`,
    );
    const cardsOnly = postCards.length > 0;

    const shortcutLabel = isShortcutSearch
      ? normalizeAiShortcutInput(trimmed)
      : '';

    const replyText = isStructuredSearch
      ? buildZoneMatchFoundReply(activityLabel, hintDisplay, lines, hintKind, {
          cardsOnly,
        })
      : isShortcutSearch
        ? cardsOnly
          ? buildMatchRecommendCardsIntro(
              activityLabel,
              matches.length,
              `「${shortcutLabel}」`,
            )
          : [
              `在「${activityLabel}」找到 ${matches.length} 条其他用户发布的「${shortcutLabel}」相关帖子：`,
              '',
              ...lines,
              '',
              '可在活动详情页查看帖子并申请加入。',
            ].join('\n')
        : cardsOnly
          ? buildMatchRecommendCardsIntro(activityLabel, matches.length)
          : [
              `在「${activityLabel}」下找到 ${matches.length} 条相近组队帖：`,
              '',
              ...lines,
              '',
              '可在活动详情页查看帖子并申请加入。',
            ].join('\n');

    return {
      matches: matches.map((match) => ({
        postId: match.postId,
        snippet: match.snippet,
        matchReason: match.matchReason,
      })),
      postCards,
      activityLabel,
      degraded: matchResult.degraded,
      replyText,
    };
  }
}
