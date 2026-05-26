import { Injectable, Logger } from '@nestjs/common';
import {
  isAiShortcutTag,
  normalizeAiShortcutInput,
} from '../../common/utils/demo-owner.util';
import { CreatePostDto } from '../../modules/post/dto/create-post.dto';
import { PostService } from '../../modules/post/post.service';
import {
  ImageParseAgent,
  NoticeAgent,
  RiskAgent,
  TextParseAgent,
} from '../agents';
import type { ConversationState } from '../conversation';
import { enterClarifyBuddyState, enterPublishConfirmState } from '../conversation';
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
  isSupplementDetailInput,
} from '../conversation/existing-post-guidance.util';
import {
  buildPublishConfirmReply,
  isAwaitingPublishConfirmation,
  isPublishConfirmIntent,
} from '../publish/publish-confirm.util';
import {
  buildBuddyCopyVariants,
} from '../conversation/buddy-copy.util';
import { buildBuddyClarifyReply } from '../conversation/buddy-clarify.util';
import {
  isAwaitingRecommendationsGate,
  isDeclineRecommendationsIntent,
} from '../gate/recommend-gate.util';
import { detectUserIntent, isExactQuickReply } from '../intent/user-intent';
import { BuddyContextService } from './buddy-context.service';
import type { PostIntentCreateAttempt } from './buddy.types';

export interface CreatePostFromChatParams {
  messages: ChatMessageDto[];
  input: string;
  userId?: string;
  userName?: string;
  activityLegacyId?: number;
  image?: string;
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

  async execute(params: CreatePostFromChatParams): Promise<PostIntentCreateAttempt> {
    const {
      messages,
      input,
      userId,
      userName,
      activityLegacyId,
      image,
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

    if (resolvedActivity?.legacyId && !isExplicitReplacePostIntent(trimmedInput)) {
      const existingPost =
        await this.postService.findOwnerRecruitingPostForActivity(
          resolvedActivity.legacyId,
          userId,
          userName,
        );
      if (existingPost) {
        const supplement =
          isSupplementDetailInput(trimmedInput) ||
          isShortContextReply(trimmedInput)
            ? trimmedInput
            : undefined;
        const shouldGuideExisting =
          (isShortcutWithActivity ||
            publishConfirmReady ||
            supplement != null ||
            isFindBuddyThread(messages) ||
            detectUserIntent(trimmedInput) === 'find_buddy');

        if (shouldGuideExisting) {
          const activityLabel =
            resolvedActivity.name ?? existingPost.eventTitle ?? '活动';
          return {
            kind: 'existing_post',
            postId: existingPost.id,
            activityLegacyId: resolvedActivity.legacyId,
            replyText: buildExistingPostGuidanceReply({
              activityLabel,
              postBody: existingPost.body,
              supplement,
            }),
          };
        }
      }
    }

    const missing = getMissingBuddyFields(ctx, activityLegacyId);
    const hasActivity = Boolean(resolvedActivity?.legacyId);
    const allBuddyFieldsPresent = missing.length === 0;
    const llmReady = parsed?.ready === true && Boolean(parsed.body?.trim());

    if (
      missing.length > 0 &&
      isFindBuddyThread(messages) &&
      !publishConfirmReady &&
      !isShortcutWithActivity &&
      !isAiShortcutTag(trimmedInput)
    ) {
      onStateChange?.(enterClarifyBuddyState());
      return {
        kind: 'rejected',
        replyText: buildBuddyClarifyReply(
          missing,
          ctx,
          resolvedActivity?.name,
        ),
      };
    }

    if (isShortcutWithActivity && hasActivity && !publishConfirmReady) {
      const draftBody = await this.buddyContext.buildPostBody({
        ctx,
        input: trimmedInput,
        activityName: resolvedActivity?.name,
        parsedBody: parsed?.body,
        messages,
        activityLegacyId: resolvedActivity?.legacyId,
      });

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
        }),
        draftBody,
        copyVariants: buildBuddyCopyVariants(
          draftBody,
          resolvedActivity?.name,
          ctx,
        ),
      };
    }

    const canCreate =
      publishConfirmReady ||
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

    const body = await this.buddyContext.buildPostBody({
      ctx,
      input: trimmedInput,
      activityName: resolvedActivity?.name,
      parsedBody: parsed?.body,
      messages,
      activityLegacyId: resolvedActivity?.legacyId,
    });

    const riskStart = Date.now();
    const useRulesOnlyRisk = publishConfirmReady && !image?.trim();
    const risk = image?.trim()
      ? await this.riskAgent.assessImage({
          body,
          image: image.trim(),
          userId,
          activityLegacyId: resolvedActivity?.legacyId,
        })
      : await this.riskAgent.assess(
          {
            body,
            userId,
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
        userId,
        resolvedActivity?.legacyId,
        risk.reason,
      );
      return {
        kind: 'rejected',
        replyText: this.buddyContext.buildRejectionReply(risk.reason),
      };
    }

    const finalBody = risk.sanitizedBody ?? body;
    const tags = this.buddyContext.resolveTags(trimmedInput, parsed?.tags);
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
}
