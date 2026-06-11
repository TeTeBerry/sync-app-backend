import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  isAiShortcutTag,
  normalizeAiShortcutInput,
} from '../../common/utils/demo-owner.util';
import { ActivityService } from '../../modules/activity/activity.service';
import { PostService } from '../../modules/partner/post.service';
import type { RecommendedPostCard } from '../../shared/chat';
import { inferAuthorGenderFromPost } from '../../common/utils/infer-author-gender.util';

const POST_CARD_SNIPPET_MAX = 56;
import {
  buildKnownFactsSummary,
  isFindBuddyThread,
  isShortContextReply,
  parseConversationContext,
  type ConversationContext,
} from '../conversation/conversation-context.parser';
import {
  detectUserIntent,
  isExactQuickReply,
  isQuickReplyIntent,
} from '../intent/user-intent';
import {
  isAwaitingSelfPostBodyCollection,
  isBuddyPostEntryIntent,
} from '../publish/buddy-post-flow.util';
import {
  isAwaitingPublishConfirmation,
  isPublishConfirmIntent,
} from '../publish/publish-confirm.util';
import { ChatMessageDto } from '../../shared/chat';
import { isTicketResaleIntent } from './activity-scope-guard.util';
import { inferIntentTagsFromText } from './infer-intent-tags.util';
import { extractActivityLookupKeywords } from './resolve-activity-from-chat.util';

interface ResolvedActivity {
  legacyId?: number;
  name?: string;
  code?: string;
  date?: string;
}

@Injectable()
export class BuddyContextService {
  constructor(
    private readonly postService: PostService,
    private readonly activityService: ActivityService,
  ) {}

  async resolveActivity(
    ctx: ConversationContext,
    requestLegacyId?: number,
    llmKeyword?: string,
  ): Promise<ResolvedActivity | null> {
    if (requestLegacyId != null) {
      const activity =
        await this.activityService.findByLegacyId(requestLegacyId);
      if (activity) {
        return {
          legacyId: activity.legacyId,
          name: activity.name,
          code: activity.code,
          date: activity.date,
        };
      }
    }

    if (ctx.activityPickerIndex) {
      const activities = await this.activityService.findAll();
      const picked = activities[ctx.activityPickerIndex - 1];
      if (picked) {
        return {
          legacyId: picked.legacyId,
          name: picked.name,
          code: picked.code,
          date: picked.date,
        };
      }
    }

    const keyword = llmKeyword ?? ctx.activityKeyword ?? ctx.activityId;
    if (keyword) {
      const matched =
        (await this.activityService.matchActivity(keyword)) ??
        (ctx.activityId
          ? await this.activityService.findByCode(ctx.activityId)
          : null);
      if (matched) {
        return {
          legacyId: matched.legacyId,
          name: matched.name,
          code: matched.code,
          date: matched.date,
        };
      }
    }

    return null;
  }

  /**
   * Homepage / global AI: infer activity from user text (name, alias, festival token).
   * Returns undefined when nothing in the catalog matches.
   */
  async resolveActivityLegacyIdFromChat(
    messages: ChatMessageDto[],
    input: string,
  ): Promise<number | undefined> {
    const ctx = parseConversationContext(messages, input.trim());
    const keywords = extractActivityLookupKeywords(messages, input);

    for (const keyword of keywords) {
      const resolved = await this.resolveActivity(ctx, undefined, keyword);
      if (resolved?.legacyId != null) {
        return resolved.legacyId;
      }
    }

    return undefined;
  }

  async buildPostBody(params: {
    ctx: ConversationContext;
    input: string;
    activityName?: string;
    parsedBody?: string;
    messages: ChatMessageDto[];
    activityLegacyId?: number;
  }): Promise<string> {
    const { ctx, input, activityName, parsedBody } = params;

    if (parsedBody?.trim()) {
      return parsedBody.trim();
    }

    const parts: string[] = [];
    if (isAiShortcutTag(input)) {
      parts.push(normalizeAiShortcutInput(input));
    } else if (
      input &&
      !isShortContextReply(input) &&
      !isExactQuickReply(input)
    ) {
      parts.push(input);
    }

    const detailParts: string[] = [];
    if (ctx.eventDate) detailParts.push(`日期 ${ctx.eventDate}`);
    if (ctx.peopleCount) detailParts.push(`${ctx.peopleCount} 人同行`);
    if (ctx.city) detailParts.push(`从 ${ctx.city} 出发`);
    if (ctx.budget) detailParts.push(`预算约 ¥${ctx.budget}/人`);
    if (ctx.genderPreference) detailParts.push(ctx.genderPreference);

    if (parts.length && detailParts.length) {
      return `${parts[0]}，${detailParts.join('，')}`;
    }

    if (parts.length) {
      return activityName ? `${parts[0]}，一起参加 ${activityName}` : parts[0];
    }

    if (detailParts.length && activityName) {
      return `找 ${activityName} 同行，${detailParts.join('，')}`;
    }

    const summary = buildKnownFactsSummary(ctx, activityName);
    if (summary && summary !== '收到，我先帮你查平台现有信息。') {
      return summary
        .replace(/^已记录你的需求：\n/, '')
        .replace(/^· /gm, '')
        .replace(/\n· /g, '，');
    }

    return activityName
      ? `找 ${activityName} 同行，欢迎一起组队 🎵`
      : '找同行伙伴，欢迎一起组队 🎵';
  }

  private truncateRecommendSnippet(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= POST_CARD_SNIPPET_MAX) {
      return normalized;
    }
    return `${normalized.slice(0, POST_CARD_SNIPPET_MAX)}…`;
  }

  async buildRecommendedPostCards(
    matches: Array<{ postId: string; snippet: string }>,
    activityLegacyId?: number,
  ): Promise<RecommendedPostCard[]> {
    const cards: RecommendedPostCard[] = [];

    for (const match of matches) {
      const post = await this.postService.findPostById(match.postId);
      if (!post) {
        cards.push({
          postId: match.postId,
          snippet: this.truncateRecommendSnippet(match.snippet),
          authorName: 'Sync 用户',
          eventTitle: '组队帖',
          activityLegacyId,
        });
        continue;
      }

      cards.push({
        postId: match.postId,
        snippet: this.truncateRecommendSnippet(match.snippet || post.body),
        authorName: post.authorName,
        authorHandle: post.authorHandle,
        authorAvatar: post.authorAvatar,
        authorGender: inferAuthorGenderFromPost({
          userId: post.userId,
          authorName: post.authorName,
          body: post.body,
          tags: post.tags,
        }),
        eventTitle: post.eventTitle,
        location: post.location,
        tags: post.tags,
        activityLegacyId: post.activityLegacyId ?? activityLegacyId,
      });
    }

    return cards;
  }

  buildRejectionReply(reason?: string): string {
    const normalized = reason?.trim() ?? '';

    const reasonHints: Record<string, string> = {
      '内容疑似重复字符 spam': '内容格式异常，请用自然语言重新描述组队需求。',
      你已在此活动发布过组队帖:
        '你在此活动已有招募中的组队帖。请打开「我的」→ 我的帖子编辑，或在活动详情页查看；若要重发请说「重新发帖」。',
      你已发布过相同内容的组队帖:
        '你已经发布过相同内容的帖子，可在个人主页或活动详情页查看。',
      内容疑似黄牛倒票或加价引流:
        '平台禁止黄牛倒票、加价出票等行为，请修改后重试。',
      '内容疑似站外引流（如微信导流）':
        '请勿在帖子中引导至微信等站外渠道，请修改后重试。',
    };

    const hint =
      reasonHints[normalized] ??
      (normalized && normalized !== '内容未通过审核'
        ? normalized
        : '内容未通过审核，请修改后重试。');

    return hint;
  }

  resolveTags(
    input: string,
    llmTags?: string[],
    bodyForIntent?: string,
  ): string[] {
    const tags = new Set<string>();
    const sourceText = [bodyForIntent, input].filter(Boolean).join('\n');

    if (isAiShortcutTag(input)) {
      tags.add(normalizeAiShortcutInput(input));
    }

    for (const tag of inferIntentTagsFromText(bodyForIntent, input)) {
      tags.add(tag);
    }

    for (const tag of llmTags ?? []) {
      const trimmed = tag.trim();
      if (!trimmed) continue;
      // 过滤 LLM 幻觉标签：标签关键词须在正文或用户输入中出现
      const keyword = trimmed.replace(/^#/, '');
      if (keyword && sourceText && !sourceText.includes(keyword)) continue;
      tags.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`);
    }
    return [...tags];
  }

  shouldAttemptPostCreation(
    messages: ChatMessageDto[],
    input: string,
    activityLegacyId?: number,
    state?: import('../conversation').ConversationState | null,
  ): boolean {
    if (isBuddyPostEntryIntent(input) && activityLegacyId != null) {
      return true;
    }

    if (isAwaitingSelfPostBodyCollection(messages, state)) {
      if (isPublishConfirmIntent(input) || isBuddyPostEntryIntent(input)) {
        return true;
      }
      return Boolean(input.trim());
    }

    if (isAiShortcutTag(input) && activityLegacyId != null) {
      return true;
    }

    if (activityLegacyId != null && isTicketResaleIntent(input)) {
      return true;
    }

    if (!isFindBuddyThread(messages)) {
      return false;
    }

    if (isExactQuickReply(input)) {
      return false;
    }

    const userTurns = messages.filter(
      (message) => message.role === 'user',
    ).length;
    if (
      activityLegacyId == null &&
      isQuickReplyIntent(input) &&
      detectUserIntent(input) === 'find_buddy' &&
      userTurns <= 1
    ) {
      return false;
    }

    return true;
  }
}
