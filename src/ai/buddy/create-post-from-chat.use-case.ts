import { Injectable, Logger } from '@nestjs/common';
import {
  isAiShortcutTag,
  normalizeAiShortcutInput,
} from '../../common/utils/demo-owner.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { CreatePostDto } from '../../modules/partner/dto/create-post.dto';
import { PostService } from '../../modules/partner/post.service';
import {
  ImageParseAgent,
  NoticeAgent,
  RiskAgent,
  TextParseAgent,
} from '../agents';
import type { ConversationState } from '../conversation';
import {
  enterCollectPostBodyState,
  enterPublishConfirmState,
} from '../conversation';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import {
  getMissingBuddyFields,
  isFindBuddyThread,
  isShortContextReply,
  parseConversationContext,
} from '../conversation/conversation-context.parser';
import {
  buildExistingPostGuidanceReply,
  isExplicitReplacePostIntent,
  isInformalPostBodyInput,
} from '../conversation/existing-post-guidance.util';
import {
  buildPublishConfirmReply,
  isAwaitingPublishConfirmation,
  isPublishConfirmIntent,
  resolvePublishDraftBody,
} from '../publish/publish-confirm.util';
import {
  buildDeclineRecommendCollectBodyReply,
  isAwaitingRecommendationsGate,
  isAwaitingSelfPostBodyCollection,
  isDeclineRecommendationsIntent,
} from '../gate/recommend-gate.util';
import { BuddyContextService } from './buddy-context.service';
import {
  buildTicketResaleScopeIntro,
  isActivityScopeMismatch,
  isTicketResaleIntent,
} from './activity-scope-guard.util';
import type { PostIntentCreateAttempt } from './buddy.types';
import { inferPostContentTypes } from '../../modules/partner/utils/post-content-type.util';
import { TRAVEL_SAFETY_TIP } from '../risk/risk-sanitize.util';

export interface CreatePostFromChatParams {
  messages: ChatMessageDto[];
  input: string;
  actor: RequestActor;
  activityLegacyId?: number;
  image?: string;
  images?: string[];
  conversationState?: ConversationState | null;
  onStateChange?: (state: ConversationState) => void;
}

@Injectable()
export class CreatePostFromChatUseCase {
  private readonly logger = new Logger(CreatePostFromChatUseCase.name);

  constructor(
    private readonly textParseAgent: TextParseAgent,
    private readonly imageParseAgent: ImageParseAgent,
    private readonly riskAgent: RiskAgent,
    private readonly noticeAgent: NoticeAgent,
    private readonly postService: PostService,
    private readonly buddyContext: BuddyContextService,
  ) {}

  async execute(
    params: CreatePostFromChatParams,
  ): Promise<PostIntentCreateAttempt> {
    const {
      messages,
      input,
      actor,
      activityLegacyId,
      image,
      images,
      conversationState,
      onStateChange,
    } = params;
    const trimmedInput = input.trim();

    if (
      !this.buddyContext.shouldAttemptPostCreation(
        messages,
        trimmedInput,
        activityLegacyId,
        conversationState,
      )
    ) {
      return null;
    }

    const ctx = parseConversationContext(messages, trimmedInput);
    const parseInput = {
      messages,
      input: trimmedInput,
      activityLegacyId,
      image,
    };

    const parseStart = Date.now();
    // Text/image parse and activity lookup (when legacyId known) are independent.
    const [parsed, resolvedFromRequest] = await Promise.all([
      image?.trim()
        ? this.imageParseAgent.parse(parseInput)
        : this.textParseAgent.parse(parseInput),
      activityLegacyId != null
        ? this.buddyContext.resolveActivity(ctx, activityLegacyId)
        : Promise.resolve(null),
    ]);
    const msParse = Date.now() - parseStart;

    let resolvedActivity = resolvedFromRequest;
    if (
      !resolvedActivity?.legacyId &&
      (parsed?.activityLegacyId != null || parsed?.activityKeyword)
    ) {
      resolvedActivity = await this.buddyContext.resolveActivity(
        ctx,
        activityLegacyId ?? parsed?.activityLegacyId,
        parsed?.activityKeyword,
      );
    }

    const isShortcutWithActivity =
      isAiShortcutTag(trimmedInput) && activityLegacyId != null;
    const publishConfirmReady =
      isAwaitingPublishConfirmation(messages, conversationState) &&
      isPublishConfirmIntent(trimmedInput);
    const awaitingSelfPostBody = isAwaitingSelfPostBodyCollection(
      messages,
      conversationState,
    );
    const inSelfPostCollectFlow =
      awaitingSelfPostBody || conversationState?.flow === 'collect_post_body';
    const skipExistingPostGuidance =
      isExplicitReplacePostIntent(trimmedInput) ||
      inSelfPostCollectFlow ||
      conversationState?.publishDraft?.fromSelfPost === true;

    const missing = getMissingBuddyFields(ctx, activityLegacyId);
    const hasActivity = Boolean(resolvedActivity?.legacyId);
    const llmReady = parsed?.ready === true && Boolean(parsed.body?.trim());

    if (
      hasActivity &&
      resolvedActivity?.legacyId &&
      actor.clientUserId &&
      !skipExistingPostGuidance
    ) {
      const existing =
        await this.postService.findOwnerRecruitingPostForActivity(
          resolvedActivity.legacyId,
          actor,
        );
      if (existing) {
        const fromSelfPostIntent =
          trimmedInput === '自己发帖' ||
          isDeclineRecommendationsIntent(trimmedInput);
        return {
          kind: 'existing_post',
          postId: existing.id,
          activityLegacyId: resolvedActivity.legacyId,
          replyText: buildExistingPostGuidanceReply({
            activityLabel:
              resolvedActivity.name ?? existing.eventTitle ?? '活动',
            postBody: existing.body,
            fromSelfPostIntent,
          }),
        };
      }
    }

    if (
      isExplicitReplacePostIntent(trimmedInput) &&
      hasActivity &&
      !publishConfirmReady
    ) {
      onStateChange?.(
        enterCollectPostBodyState({
          activityLegacyId: resolvedActivity?.legacyId,
          fromSelfPost: true,
        }),
      );
      return {
        kind: 'rejected',
        replyText: buildDeclineRecommendCollectBodyReply(
          resolvedActivity?.name ?? '活动',
        ),
      };
    }

    // 缺失字段不再阻断发帖，仅作为建议信息融入帖子内容

    if (
      isDeclineRecommendationsIntent(trimmedInput) &&
      hasActivity &&
      !publishConfirmReady
    ) {
      onStateChange?.(
        enterCollectPostBodyState({
          activityLegacyId: resolvedActivity?.legacyId,
          fromSelfPost: true,
        }),
      );
      return {
        kind: 'rejected',
        replyText: buildDeclineRecommendCollectBodyReply(
          resolvedActivity?.name ?? '活动',
        ),
      };
    }

    const isSelfPostIntent = trimmedInput === '自己发帖';

    if (isSelfPostIntent && hasActivity && !publishConfirmReady) {
      onStateChange?.(
        enterCollectPostBodyState({
          activityLegacyId: resolvedActivity?.legacyId,
          fromSelfPost: true,
        }),
      );
      return {
        kind: 'rejected',
        replyText: '想发什么直接说，我帮你发～',
      };
    }

    if (
      hasActivity &&
      !publishConfirmReady &&
      !isShortcutWithActivity &&
      !inSelfPostCollectFlow &&
      isTicketResaleIntent(trimmedInput)
    ) {
      const activityLabel = resolvedActivity?.name ?? '活动';
      const mismatch = isActivityScopeMismatch(trimmedInput, {
        name: resolvedActivity?.name,
        date: resolvedActivity?.date,
      });
      const draftBody = trimmedInput;
      const draftTags = this.buddyContext.resolveTags(
        trimmedInput,
        parsed?.tags,
        draftBody,
      );

      onStateChange?.(
        enterPublishConfirmState({
          activityLegacyId: resolvedActivity?.legacyId,
          draftBody,
        }),
      );

      return {
        kind: 'pending_confirmation',
        activityLegacyId: resolvedActivity?.legacyId,
        replyText: [
          buildTicketResaleScopeIntro(activityLabel, mismatch),
          '',
          buildPublishConfirmReply({
            activityLabel,
            draftBody,
            shortcutTag: '转票',
            draftTags,
          }),
        ].join('\n'),
        draftBody,
      };
    }

    const readyForDirectSelfPost =
      inSelfPostCollectFlow &&
      hasActivity &&
      Boolean(trimmedInput) &&
      !isDeclineRecommendationsIntent(trimmedInput) &&
      !publishConfirmReady;

    if (isShortcutWithActivity && hasActivity && !publishConfirmReady) {
      const draftBody = await this.buddyContext.buildPostBody({
        ctx,
        input: trimmedInput,
        activityName: resolvedActivity?.name,
        parsedBody: parsed?.body,
        messages,
        activityLegacyId: resolvedActivity?.legacyId,
      });

      const draftTags = this.buddyContext.resolveTags(
        trimmedInput,
        parsed?.tags,
        draftBody,
      );

      onStateChange?.(
        enterPublishConfirmState({
          activityLegacyId: resolvedActivity?.legacyId,
          draftBody,
        }),
      );

      return {
        kind: 'pending_confirmation',
        activityLegacyId: resolvedActivity?.legacyId,
        replyText: buildPublishConfirmReply({
          activityLabel: resolvedActivity?.name ?? '活动',
          draftBody,
          shortcutTag: normalizeAiShortcutInput(trimmedInput),
          draftTags,
        }),
        draftBody,
      };
    }

    // 不再校验字段完整性，只要用户在找搭子且活动已知即可创建
    const canCreate =
      publishConfirmReady ||
      readyForDirectSelfPost ||
      (!isDeclineRecommendationsIntent(trimmedInput) &&
        !inSelfPostCollectFlow &&
        (llmReady || (isFindBuddyThread(messages) && hasActivity)));

    if (!canCreate || !hasActivity) {
      return null;
    }

    const publishDraftBody = publishConfirmReady
      ? resolvePublishDraftBody({ messages, conversationState })
      : null;

    const body = await this.buddyContext.buildPostBody({
      ctx,
      input: trimmedInput,
      activityName: resolvedActivity?.name,
      parsedBody:
        publishDraftBody ??
        (readyForDirectSelfPost ? trimmedInput : parsed?.body),
      messages,
      activityLegacyId: resolvedActivity?.legacyId,
    });

    const riskStart = Date.now();
    const useRulesOnlyRisk =
      !image?.trim() &&
      (publishConfirmReady ||
        readyForDirectSelfPost ||
        conversationState?.publishDraft?.fromSelfPost === true);
    const risk = image?.trim()
      ? await this.riskAgent.assessImage({
          body,
          image: image.trim(),
          userId: actor.clientUserId,
          activityLegacyId: resolvedActivity?.legacyId,
        })
      : await this.riskAgent.assess(
          {
            body,
            userId: actor.clientUserId,
            activityLegacyId: resolvedActivity?.legacyId,
          },
          { rulesOnly: useRulesOnlyRisk },
        );
    const msRisk = Date.now() - riskStart;

    this.logger.log(
      `create-post-from-chat timing ms_parse=${msParse} ms_risk=${msRisk} rulesOnly=${useRulesOnlyRisk}`,
    );

    if (!risk.publishable) {
      void this.noticeAgent.notifyPostRejected(
        actor.clientUserId,
        resolvedActivity?.legacyId,
        risk.reason,
      );
      return {
        kind: 'rejected',
        replyText: this.buddyContext.buildRejectionReply(risk.reason),
      };
    }

    const finalBody = risk.sanitizedBody ?? body;
    const tags = this.buddyContext.resolveTags(
      trimmedInput,
      parsed?.tags,
      finalBody,
    );
    // Post location metadata = user's departure city / profile location.
    // Zone/area parsed from body (e.g. "A区") stays in body only.
    const departureCity = ctx.city?.trim();

    const contentTypes = inferPostContentTypes({ tags, body: finalBody });

    const dto: CreatePostDto = {
      body: finalBody,
      activityLegacyId: resolvedActivity?.legacyId,
      eventTitle: resolvedActivity?.name ?? parsed?.eventName,
      ...(departureCity ? { location: departureCity, departureCity } : {}),
      tags,
      contentTypes,
      images: images?.length ? images : undefined,
    };

    const post = await this.postService.createPost(dto, actor, {
      skipRiskCheck: true,
    });
    const activityLabel = resolvedActivity?.name ?? '活动';
    const createdCards = await this.buddyContext.buildRecommendedPostCards(
      [{ postId: post.id, snippet: finalBody }],
      resolvedActivity?.legacyId,
    );
    const createdPost = createdCards[0];

    return {
      kind: 'created',
      postId: post.id,
      activityLegacyId: resolvedActivity?.legacyId,
      createdPost,
      replyText: [
        `已为你发布「${activityLabel}」组队帖 ✅`,
        '',
        TRAVEL_SAFETY_TIP,
        '',
        '点击下方卡片可在活动详情页查看，等待伙伴申请加入。',
      ].join('\n'),
    };
  }
}
