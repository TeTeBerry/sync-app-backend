import { Injectable } from '@nestjs/common';
import { isAiShortcutTag } from '../common/utils/demo-owner.util';
import { ActivityService } from '../modules/activity/activity.service';
import { CreatePostDto } from '../modules/post/dto/create-post.dto';
import { PostService } from '../modules/post/post.service';
import {
  ImageParseAgent,
  MatchAgent,
  NoticeAgent,
  RiskAgent,
  TextParseAgent,
  UserProfileAgent,
} from './agents';
import { ChatMessageDto } from './presentation/chat-message.dto';
import {
  buildKnownFactsSummary,
  getMissingBuddyFields,
  isFindBuddyThread,
  isShortContextReply,
  parseConversationContext,
  type ConversationContext,
} from './utils/conversation-context.parser';
import {
  detectUserIntent,
  isExactQuickReply,
  isQuickReplyIntent,
} from './utils/user-intent';

interface ResolvedActivity {
  legacyId?: number;
  name?: string;
  code?: string;
}

export interface PostIntentCreateResult {
  kind: 'created';
  postId: string;
  activityLegacyId?: number;
  replyText: string;
}

export interface PostIntentRejectedResult {
  kind: 'rejected';
  replyText: string;
}

export type PostIntentCreateAttempt =
  | PostIntentCreateResult
  | PostIntentRejectedResult
  | null;

export interface PostIntentMatchResult {
  replyText: string;
  matches: Array<{ postId: string; snippet: string }>;
}

@Injectable()
export class PostIntentService {
  constructor(
    private readonly textParseAgent: TextParseAgent,
    private readonly imageParseAgent: ImageParseAgent,
    private readonly matchAgent: MatchAgent,
    private readonly riskAgent: RiskAgent,
    private readonly userProfileAgent: UserProfileAgent,
    private readonly noticeAgent: NoticeAgent,
    private readonly postService: PostService,
    private readonly activityService: ActivityService,
  ) {}

  async tryCreatePostFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    userId?: string;
    userName?: string;
    activityLegacyId?: number;
    image?: string;
  }): Promise<PostIntentCreateAttempt> {
    const { messages, input, userId, userName, activityLegacyId, image } =
      params;
    const trimmedInput = input.trim();

    if (!this.shouldAttemptPostCreation(messages, trimmedInput, activityLegacyId)) {
      return null;
    }

    void this.userProfileAgent.syncProfileFromChat({
      messages,
      input: trimmedInput,
      userId,
      authorName: userName,
    });

    const ctx = parseConversationContext(messages, trimmedInput);
    const parseInput = {
      messages,
      input: trimmedInput,
      activityLegacyId,
      image,
    };

    const parsed = image?.trim()
      ? await this.imageParseAgent.parse(parseInput)
      : await this.textParseAgent.parse(parseInput);

    const resolvedActivity = await this.resolveActivity(
      ctx,
      activityLegacyId ?? parsed?.activityLegacyId,
      parsed?.activityKeyword,
    );

    const isShortcutWithActivity =
      isAiShortcutTag(trimmedInput) && activityLegacyId != null;

    const missing = getMissingBuddyFields(ctx);
    const hasActivity = Boolean(resolvedActivity?.legacyId);
    const allBuddyFieldsPresent = missing.length === 0;
    const llmReady = parsed?.ready === true && Boolean(parsed.body?.trim());

    const canCreate =
      isShortcutWithActivity ||
      llmReady ||
      (isFindBuddyThread(messages) &&
        hasActivity &&
        (allBuddyFieldsPresent ||
          (trimmedInput.length > 12 &&
            !isShortContextReply(trimmedInput) &&
            !isExactQuickReply(trimmedInput))));

    if (!canCreate || !hasActivity) {
      return null;
    }

    const body = await this.buildPostBody({
      ctx,
      input: trimmedInput,
      activityName: resolvedActivity?.name,
      parsedBody: parsed?.body,
      messages,
      activityLegacyId: resolvedActivity?.legacyId,
    });

    const risk = image?.trim()
      ? await this.riskAgent.assessImage({
          body,
          image: image.trim(),
          userId,
          activityLegacyId: resolvedActivity?.legacyId,
        })
      : await this.riskAgent.assess({
          body,
          userId,
          activityLegacyId: resolvedActivity?.legacyId,
        });

    if (!risk.publishable) {
      void this.noticeAgent.notifyPostRejected(
        userId,
        resolvedActivity?.legacyId,
        risk.reason,
      );
      return {
        kind: 'rejected',
        replyText: this.buildRejectionReply(risk.reason),
      };
    }

    const finalBody = risk.sanitizedBody ?? body;
    const tags = this.resolveTags(trimmedInput, parsed?.tags);
    const location =
      parsed?.location?.trim() || ctx.city || resolvedActivity?.name;

    const dto: CreatePostDto = {
      body: finalBody,
      activityLegacyId: resolvedActivity?.legacyId,
      eventTitle: resolvedActivity?.name ?? parsed?.eventName,
      location,
      tags,
    };

    const post = await this.postService.createPost(dto, userId, userName, {
      skipRiskCheck: true,
    });
    const activityLabel = resolvedActivity?.name ?? '活动';

    return {
      kind: 'created',
      postId: post.id,
      activityLegacyId: resolvedActivity?.legacyId,
      replyText: [
        `已为你发布「${activityLabel}」组队帖 ✅`,
        '',
        finalBody,
        '',
        '可在活动详情页查看帖子，等待伙伴申请加入。',
      ].join('\n'),
    };
  }

  async tryMatchPostsFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    activityLegacyId?: number;
    userId?: string;
  }): Promise<PostIntentMatchResult | null> {
    const { messages, input, activityLegacyId, userId } = params;
    const trimmed = input.trim();

    if (!trimmed || !this.isMatchExistingPostsIntent(trimmed)) {
      return null;
    }

    const profileSync = await this.userProfileAgent.syncProfileFromChat({
      messages,
      input: trimmed,
      userId,
    });

    const ctx = parseConversationContext(messages, trimmed);
    const resolvedActivity = await this.resolveActivity(ctx, activityLegacyId);
    if (!resolvedActivity?.legacyId) {
      return null;
    }

    const matches = await this.matchAgent.match({
      query: trimmed,
      activityCode: resolvedActivity.code ?? '',
      activityLegacyId: resolvedActivity.legacyId,
      limit: 5,
      userId,
      profile: profileSync?.profile,
      rankingWeights: profileSync?.weights,
    });

    const activityLabel = resolvedActivity.name ?? '活动';

    if (!matches.length) {
      return {
        matches: [],
        replyText: [
          `暂未找到「${activityLabel}」相关的组队帖。`,
          '',
          '你可以直接告诉我出行需求，我帮你发一条组队帖。',
        ].join('\n'),
      };
    }

    const lines = matches.map(
      (match, index) => `${index + 1}. ${match.snippet}`,
    );

    void this.noticeAgent.notifyMatchRecommendation(
      params.userId,
      resolvedActivity.legacyId,
      activityLabel,
      matches.map(match => match.postId),
      matches.length,
    );

    return {
      matches: matches.map(match => ({
        postId: match.postId,
        snippet: match.snippet,
      })),
      replyText: [
        `在「${activityLabel}」下找到 ${matches.length} 条相近组队帖：`,
        '',
        ...lines,
        '',
        '可在活动详情页查看帖子并申请加入。',
      ].join('\n'),
    };
  }

  private isMatchExistingPostsIntent(input: string): boolean {
    return /有没有|匹配|看看|推荐|找一下|现有|已有|结伴帖|组队帖|类似的|相似的|搜一下|查一下|帮我找/.test(
      input.trim(),
    );
  }

  private shouldAttemptPostCreation(
    messages: ChatMessageDto[],
    input: string,
    activityLegacyId?: number,
  ): boolean {
    if (isAiShortcutTag(input) && activityLegacyId != null) {
      return true;
    }

    if (!isFindBuddyThread(messages)) {
      return false;
    }

    if (isExactQuickReply(input)) {
      return false;
    }

    const userTurns = messages.filter(message => message.role === 'user').length;
    if (
      isQuickReplyIntent(input) &&
      detectUserIntent(input) === 'find_buddy' &&
      userTurns <= 1
    ) {
      return false;
    }

    return true;
  }

  private async resolveActivity(
    ctx: ConversationContext,
    requestLegacyId?: number,
    llmKeyword?: string,
  ): Promise<ResolvedActivity | null> {
    if (requestLegacyId != null) {
      const activity = await this.activityService.findByLegacyId(requestLegacyId);
      if (activity) {
        return {
          legacyId: activity.legacyId,
          name: activity.name,
          code: activity.code,
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
        };
      }
    }

    return null;
  }

  private async buildPostBody(params: {
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
      parts.push(input);
    } else if (input && !isShortContextReply(input) && !isExactQuickReply(input)) {
      parts.push(input);
    }

    const detailParts: string[] = [];
    if (ctx.eventDate) detailParts.push(`日期 ${ctx.eventDate}`);
    if (ctx.peopleCount) detailParts.push(`${ctx.peopleCount} 人同行`);
    if (ctx.city) detailParts.push(`从 ${ctx.city} 出发`);
    if (ctx.budget) detailParts.push(`预算约 ¥${ctx.budget}/人`);

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

  private buildRejectionReply(reason?: string): string {
    const normalized = reason?.trim() ?? '';

    const reasonHints: Record<string, string> = {
      '内容疑似重复字符 spam': '内容格式异常，请用自然语言重新描述组队需求。',
      '你已发布过相同内容的组队帖':
        '你已经发布过相同内容的帖子，可在个人主页或活动详情页查看。',
      '内容疑似黄牛倒票或加价引流':
        '平台禁止黄牛倒票、加价出票等行为，请修改后重试。',
      '内容疑似站外引流（如微信导流）':
        '请勿在帖子中引导至微信等站外渠道，请修改后重试。',
    };

    const hint =
      reasonHints[normalized] ??
      (normalized && normalized !== '内容未通过审核'
        ? normalized
        : '内容未通过审核，请修改后重试。');

    return ['组队帖暂未发布 ⚠️', '', hint].join('\n');
  }

  private resolveTags(input: string, llmTags?: string[]): string[] {
    const tags = new Set<string>();
    if (isAiShortcutTag(input)) {
      tags.add(input);
    }
    for (const tag of llmTags ?? []) {
      const trimmed = tag.trim();
      if (trimmed) tags.add(trimmed);
    }
    return [...tags];
  }
}
