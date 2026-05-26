import { Injectable } from '@nestjs/common';
import type {
  NotificationCategory,
  NotificationInteractionType,
  NotificationMeta,
} from '../../database/schemas/notification.schema';
import { NotificationService } from '../../modules/notification/notification.service';
import type { NotificationTemplateKey } from '../../modules/notification/notification-templates.util';
import { UserService } from '../../modules/user/user.service';
import type { PostRecord } from '../../modules/post/interfaces/post.repository.interface';
import { isResourceOwnedByClient } from '../../common/utils/demo-owner.util';

export interface NoticeInteractionCopy {
  templateKey: NotificationTemplateKey;
  templateParams: Record<string, string>;
}

export interface NoticeDispatchInput {
  userId: string;
  category: NotificationCategory;
  templateKey: NotificationTemplateKey;
  templateParams?: Record<string, string>;
  meta?: NotificationMeta;
  /** Skip duplicate check when false (default true for interaction pushes). */
  dedupe?: {
    metaType: NotificationInteractionType;
    activityLegacyId?: number;
    postId?: string;
    actorUserId?: string;
    sinceMs?: number;
  };
}

const MATCH_RECOMMENDATION_DEDUPE_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class NoticeAgent {
  readonly id = 'notice';

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  async notifyLike(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    actorName?: string,
  ): Promise<void> {
    await this.notifyPostOwnerInteraction(post, postId, actorUserId, actorName, 'like', {
      templateKey: 'like',
      templateParams: { actor: actorName?.trim() || '有人' },
    });
  }

  async notifyComment(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    actorName: string | undefined,
    preview: string,
  ): Promise<void> {
    const actorLabel = actorName?.trim() || '有人';
    await this.notifyPostOwnerInteraction(post, postId, actorUserId, actorName, 'comment', {
      templateKey: 'comment',
      templateParams: { actor: actorLabel, preview },
    });
  }

  async notifyCommentReply(
    post: PostRecord,
    postId: string,
    parentComment: { _id?: unknown; userId: string; authorName?: string },
    actorUserId: string,
    actorName: string | undefined,
    preview: string,
  ): Promise<void> {
    const parentUserId = parentComment.userId?.trim();
    if (!parentUserId || parentUserId === actorUserId) {
      return;
    }

    if (parentUserId === post.userId?.trim()) {
      return;
    }

    await this.dispatch({
      userId: parentUserId,
      category: 'comment',
      templateKey: 'commentReply',
      templateParams: {
        actor: actorName?.trim() || '有人',
        preview,
      },
      meta: {
        activityLegacyId: post.activityLegacyId,
        postId,
        type: 'comment_reply',
        actorUserId,
        actorUserName: actorName?.trim(),
        parentCommentId: String(parentComment._id),
      },
      dedupe: {
        metaType: 'comment_reply',
        postId,
        actorUserId,
        sinceMs: 60 * 60 * 1000,
      },
    });
  }

  async notifyApplication(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    actorName?: string,
  ): Promise<void> {
    await this.notifyPostOwnerInteraction(
      post,
      postId,
      actorUserId,
      actorName,
      'application',
      {
        templateKey: 'application',
        templateParams: { actor: actorName?.trim() || '有人' },
      },
    );
  }

  async notifyPostRejected(
    userId: string | undefined,
    activityLegacyId: number | undefined,
    reason?: string,
  ): Promise<void> {
    const uid = userId?.trim();
    if (!uid) return;

    const reasonText = this.buildRejectionReasonSummary(reason);
    await this.dispatch({
      userId: uid,
      category: 'system',
      templateKey: 'postRejected',
      templateParams: { reason: reasonText },
      meta: {
        activityLegacyId,
        type: 'post_rejected',
        rejectionReason: reasonText,
      },
    });
  }

  async notifyPostHidden(
    userId: string | undefined,
    postId: string,
    activityLegacyId: number | undefined,
    reason?: string,
  ): Promise<void> {
    const uid = userId?.trim();
    if (!uid) return;

    const reasonText = this.buildHiddenReasonSummary(reason);
    await this.dispatch({
      userId: uid,
      category: 'system',
      templateKey: 'postHidden',
      templateParams: { reason: reasonText },
      meta: {
        activityLegacyId,
        postId,
        type: 'post_hidden',
        rejectionReason: reasonText,
      },
    });
  }

  async notifyMatchRecommendation(
    userId: string | undefined,
    activityLegacyId: number,
    activityName: string,
    matchPostIds: string[],
    count: number,
  ): Promise<void> {
    const uid = userId?.trim();
    if (!uid || count === 0) return;

    await this.dispatch({
      userId: uid,
      category: 'buddy_recommend',
      templateKey: 'matchRecommendation',
      templateParams: {
        activityName,
        count: String(count),
      },
      meta: {
        activityLegacyId,
        type: 'match_recommendation',
        matchPostIds,
        postId: matchPostIds[0],
      },
      dedupe: {
        metaType: 'match_recommendation',
        activityLegacyId,
        sinceMs: MATCH_RECOMMENDATION_DEDUPE_MS,
      },
    });
  }

  async notifyActivityUpdate(
    userIds: string[],
    activityLegacyId: number,
    activityName: string,
    changeSummary: string,
  ): Promise<void> {
    const recipients = [...new Set(userIds.map(id => id.trim()).filter(Boolean))];
    if (!recipients.length) return;

    await Promise.all(
      recipients.map(userId =>
        this.dispatch({
          userId,
          category: 'system',
          templateKey: 'activityUpdate',
          templateParams: {
            activityName,
            changeSummary,
          },
          meta: {
            activityLegacyId,
            type: 'activity_update',
          },
        }),
      ),
    );
  }

  /**
   * Central entry for all push notifications.
   * Respects user notification settings and optional deduplication.
   */
  async dispatch(input: NoticeDispatchInput): Promise<void> {
    const userId = input.userId?.trim();
    if (!userId) return;

    if (!(await this.shouldNotify(userId))) {
      return;
    }

    if (input.dedupe) {
      const isDuplicate = await this.notificationService.hasRecentByMeta(
        userId,
        input.dedupe.metaType,
        {
          activityLegacyId: input.dedupe.activityLegacyId,
          postId: input.dedupe.postId,
          actorUserId: input.dedupe.actorUserId,
          sinceMs: input.dedupe.sinceMs,
        },
      );
      if (isDuplicate) {
        return;
      }
    }

    await this.notificationService.createFromTemplate({
      userId,
      templateKey: input.templateKey,
      templateParams: input.templateParams ?? {},
      meta: {
        ...input.meta,
        category: input.category,
      },
    });
  }

  private async shouldNotify(userId: string): Promise<boolean> {
    return this.userService.isNotificationsEnabled(userId);
  }

  private async notifyPostOwnerInteraction(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    actorName: string | undefined,
    interactionType: NotificationInteractionType,
    copy: NoticeInteractionCopy,
  ): Promise<void> {
    const ownerUserId = post.userId?.trim();
    if (!ownerUserId || ownerUserId === actorUserId) {
      return;
    }

    if (
      isResourceOwnedByClient(
        { userId: post.userId, authorName: post.authorName },
        actorUserId,
        actorName,
      )
    ) {
      return;
    }

    const category: NotificationCategory =
      interactionType === 'like' ? 'like' : 'comment';

    await this.dispatch({
      userId: ownerUserId,
      category,
      templateKey: copy.templateKey,
      templateParams: copy.templateParams,
      meta: {
        activityLegacyId: post.activityLegacyId,
        postId,
        type: interactionType,
        actorUserId,
        actorUserName: actorName?.trim(),
      },
    });
  }

  private buildRejectionReasonSummary(reason?: string): string {
    const normalized = reason?.trim() ?? '';
    const reasonHints: Record<string, string> = {
      '内容疑似重复字符 spam': '内容格式异常，请用自然语言重新描述组队需求。',
      '你已在此活动发布过组队帖':
        '你在此活动已有招募中的组队帖。请打开「我的」→ 我的帖子编辑，或在活动详情页查看。',
      '你已发布过相同内容的组队帖':
        '你已经发布过相同内容的帖子，可在个人主页或活动详情页查看。',
      '内容疑似黄牛倒票或加价引流':
        '平台禁止黄牛倒票、加价出票等行为，请修改后重试。',
      '内容疑似站外引流（如微信导流）':
        '请勿在帖子中引导至微信等站外渠道，请修改后重试。',
    };

    return (
      reasonHints[normalized] ??
      (normalized && normalized !== '内容未通过审核'
        ? normalized
        : '内容未通过审核，请修改后重试。')
    );
  }

  private buildHiddenReasonSummary(reason?: string): string {
    const normalized = reason?.trim() ?? '';
    const reasonHints: Record<string, string> = {
      '内容疑似黄牛倒票或加价引流':
        '帖子因疑似黄牛倒票或加价引流已被自动隐藏。',
      '内容疑似站外引流（如微信导流）':
        '帖子因疑似站外引流已被自动隐藏。',
    };

    return (
      reasonHints[normalized] ??
      (normalized || '内容违反社区规范，帖子已自动隐藏')
    );
  }
}
