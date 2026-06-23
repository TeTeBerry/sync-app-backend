import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { CreatePostDto } from '../../modules/partner/dto/create-post.dto';
import {
  IPostQueryPort,
  POST_QUERY_PORT,
} from '../../modules/partner/ports/post-query.port';
import {
  IPostWritePort,
  POST_WRITE_PORT,
} from '../../modules/partner/ports/post-write.port';
import { NoticeAgent, RiskAgent, TextParseAgent } from '../agents';
import type { ConversationState } from '../conversation';
import {
  enterCollectPostBodyState,
  enterPublishConfirmState,
} from '../conversation';
import { ChatMessageDto } from '@sync/chat-contracts';
import { parseConversationContext } from '../conversation/conversation-context.parser';
import {
  buildExistingPostGuidanceReply,
  isExplicitReplacePostIntent,
} from '../conversation/existing-post-guidance.util';
import {
  buildPublishConfirmReply,
  isAwaitingPublishConfirmation,
  isPublishConfirmIntent,
  resolvePublishDraftBody,
} from '../publish/publish-confirm.util';
import {
  buildCollectPostBodyPromptReply,
  isAwaitingSelfPostBodyCollection,
  isBuddyPostEntryIntent,
} from '../publish/buddy-post-flow.util';
import { AccountRiskService } from '../../modules/account-risk/account-risk.service';
import { BuddyContextService } from './buddy-context.service';
import {
  isTicketPublishProhibited,
  TICKET_PUBLISH_FORBIDDEN_MESSAGE,
} from './ticket-publish-policy.util';
import type { PostIntentCreateAttempt } from './buddy.types';
import { TRAVEL_SAFETY_TIP } from '../risk/risk-sanitize.util';

export interface CreatePostFromChatParams {
  messages: ChatMessageDto[];
  input: string;
  actor: RequestActor;
  activityLegacyId?: number;
  conversationState?: ConversationState | null;
  onStateChange?: (state: ConversationState) => void;
  fromAgentTool?: boolean;
}

@Injectable()
export class CreatePostFromChatUseCase {
  private readonly logger = new Logger(CreatePostFromChatUseCase.name);

  constructor(
    private readonly textParseAgent: TextParseAgent,
    private readonly riskAgent: RiskAgent,
    private readonly noticeAgent: NoticeAgent,
    @Inject(POST_QUERY_PORT) private readonly postQuery: IPostQueryPort,
    @Inject(POST_WRITE_PORT) private readonly postWrite: IPostWritePort,
    private readonly buddyContext: BuddyContextService,
    private readonly accountRisk: AccountRiskService,
  ) {}

  async execute(
    params: CreatePostFromChatParams,
  ): Promise<PostIntentCreateAttempt> {
    const {
      messages,
      input,
      actor,
      activityLegacyId,
      conversationState,
      onStateChange,
      fromAgentTool,
    } = params;
    const trimmedInput = input.trim();

    if (
      !this.buddyContext.shouldAttemptPostCreation(
        messages,
        trimmedInput,
        activityLegacyId,
        conversationState,
        { fromAgentTool },
      )
    ) {
      return null;
    }

    const ctx = parseConversationContext(messages, trimmedInput);
    const parseInput = {
      messages,
      input: trimmedInput,
      activityLegacyId,
    };

    const parseStart = Date.now();
    const [parsed, resolvedFromRequest] = await Promise.all([
      this.textParseAgent.parse(parseInput),
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

    const hasActivity = Boolean(resolvedActivity?.legacyId);
    const llmReady = parsed?.ready === true && Boolean(parsed.body?.trim());

    if (
      hasActivity &&
      resolvedActivity?.legacyId &&
      actor.clientUserId &&
      !skipExistingPostGuidance
    ) {
      const existing = await this.postQuery.findOwnerActivePostForActivity(
        resolvedActivity.legacyId,
        actor,
      );
      if (existing) {
        const fromBuddyPostEntryIntent = isBuddyPostEntryIntent(trimmedInput);
        return {
          kind: 'existing_post',
          postId: existing.id,
          activityLegacyId: resolvedActivity.legacyId,
          replyText: buildExistingPostGuidanceReply({
            activityLabel:
              resolvedActivity.name ?? existing.eventTitle ?? '活动',
            postBody: existing.body,
            fromSelfPostIntent: fromBuddyPostEntryIntent,
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
        replyText: buildCollectPostBodyPromptReply(
          resolvedActivity?.name ?? '活动',
        ),
      };
    }

    // 缺失字段不再阻断发帖，仅作为建议信息融入帖子内容

    if (
      isBuddyPostEntryIntent(trimmedInput) &&
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
        replyText: buildCollectPostBodyPromptReply(
          resolvedActivity?.name ?? '活动',
        ),
      };
    }

    const publishDraftBody = publishConfirmReady
      ? resolvePublishDraftBody({ messages, conversationState })
      : null;
    const bodyForTicketCheck = publishDraftBody?.trim() || trimmedInput;
    if (
      bodyForTicketCheck &&
      isTicketPublishProhibited({
        body: bodyForTicketCheck,
        tags: this.buddyContext.resolveTags(
          trimmedInput,
          parsed?.tags,
          bodyForTicketCheck,
        ),
      })
    ) {
      void this.accountRisk.recordTicketPolicyViolation(
        actor,
        TICKET_PUBLISH_FORBIDDEN_MESSAGE,
      );
      return {
        kind: 'rejected',
        replyText: TICKET_PUBLISH_FORBIDDEN_MESSAGE,
      };
    }

    const readyForDirectSelfPost =
      inSelfPostCollectFlow &&
      hasActivity &&
      Boolean(trimmedInput) &&
      !isBuddyPostEntryIntent(trimmedInput) &&
      !publishConfirmReady;

    const canCreate =
      publishConfirmReady ||
      readyForDirectSelfPost ||
      (!isBuddyPostEntryIntent(trimmedInput) &&
        !inSelfPostCollectFlow &&
        hasActivity &&
        llmReady);

    if (!canCreate || !hasActivity) {
      return null;
    }

    await this.accountRisk.assertCanPublish(actor);

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
      publishConfirmReady ||
      readyForDirectSelfPost ||
      conversationState?.publishDraft?.fromSelfPost === true;
    const risk = await this.riskAgent.assess(
      {
        body,
        actor,
        activityLegacyId: resolvedActivity?.legacyId,
      },
      { rulesOnly: useRulesOnlyRisk },
    );
    const msRisk = Date.now() - riskStart;

    this.logger.log(
      `create-post-from-chat timing ms_parse=${msParse} ms_risk=${msRisk} rulesOnly=${useRulesOnlyRisk}`,
    );

    if (!risk.publishable) {
      void this.accountRisk.recordPublishRiskViolation(actor, risk, {
        source: 'ai_post_reject',
      });
      void this.noticeAgent.notifyPostRejected(
        actor,
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

    if (isTicketPublishProhibited({ body: finalBody, tags })) {
      void this.accountRisk.recordTicketPolicyViolation(
        actor,
        TICKET_PUBLISH_FORBIDDEN_MESSAGE,
      );
      return {
        kind: 'rejected',
        replyText: TICKET_PUBLISH_FORBIDDEN_MESSAGE,
      };
    }

    const dto: CreatePostDto = {
      body: finalBody,
      activityLegacyId: resolvedActivity?.legacyId,
      eventTitle: resolvedActivity?.name ?? parsed?.eventName,
      ...(departureCity ? { location: departureCity, departureCity } : {}),
      tags,
    };

    const post = await this.postWrite.createPost(dto, actor, {
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
