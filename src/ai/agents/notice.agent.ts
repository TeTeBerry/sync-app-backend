import { Injectable } from '@nestjs/common';
import type {
  NotificationCategory,
  NotificationInteractionType,
  NotificationMeta,
} from '../../database/schemas/notification.schema';
import { NotificationService } from '../../modules/notification/notification.service';
import type { NotificationTemplateKey } from '../../modules/notification/notification-templates.util';
import { toRequestActor } from '../../common/auth/actor-query.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { UserService } from '../../modules/user/user.service';

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
    /** Activity update: same summary within window → skip. */
    changeSummary?: string;
    sinceMs?: number;
  };
}

@Injectable()
export class NoticeAgent {
  readonly id = 'notice';

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  async notifyPostRejected(
    actor: RequestActor,
    activityLegacyId: number | undefined,
    reason?: string,
  ): Promise<void> {
    const uid = actor.clientUserId?.trim();
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

  async notifyActivityUpdate(
    userIds: string[],
    activityLegacyId: number,
    activityName: string,
    changeSummary: string,
  ): Promise<void> {
    const recipients = [
      ...new Set(userIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (!recipients.length) return;

    await Promise.all(
      recipients.map((userId) =>
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
            changeSummary,
          },
          dedupe: {
            metaType: 'activity_update',
            activityLegacyId,
            changeSummary,
            sinceMs: 7 * 24 * 60 * 60 * 1000,
          },
        }),
      ),
    );
  }

  async notifyComment(params: {
    recipientUserId: string;
    postId: string;
    activityLegacyId?: number;
    actorUserId: string;
    actorUserName?: string;
    commentPreview?: string;
  }): Promise<void> {
    const recipient = params.recipientUserId?.trim();
    const actorUserId = params.actorUserId?.trim();
    if (!recipient || !actorUserId || recipient === actorUserId) return;

    const actor = params.actorUserName?.trim() || '有人';
    const preview = this.truncateCommentPreview(params.commentPreview);

    await this.dispatch({
      userId: recipient,
      category: 'general',
      templateKey: 'comment',
      templateParams: { actor, preview },
      meta: {
        type: 'comment',
        postId: params.postId,
        activityLegacyId: params.activityLegacyId,
        actorUserId,
        actorUserName: actor,
      },
    });
  }

  async notifyCommentReply(params: {
    recipientUserId: string;
    postId: string;
    activityLegacyId?: number;
    actorUserId: string;
    actorUserName?: string;
    commentPreview?: string;
    parentCommentId: string;
  }): Promise<void> {
    const recipient = params.recipientUserId?.trim();
    const actorUserId = params.actorUserId?.trim();
    if (!recipient || !actorUserId || recipient === actorUserId) return;

    const actor = params.actorUserName?.trim() || '有人';
    const preview = this.truncateCommentPreview(params.commentPreview);

    await this.dispatch({
      userId: recipient,
      category: 'general',
      templateKey: 'commentReply',
      templateParams: { actor, preview },
      meta: {
        type: 'comment_reply',
        postId: params.postId,
        activityLegacyId: params.activityLegacyId,
        actorUserId,
        actorUserName: actor,
        parentCommentId: params.parentCommentId,
      },
    });
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
          changeSummary: input.dedupe.changeSummary,
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
    return this.userService.isNotificationsEnabled(toRequestActor(userId));
  }

  private buildRejectionReasonSummary(reason?: string): string {
    const normalized = reason?.trim() ?? '';
    const reasonHints: Record<string, string> = {
      '内容疑似重复字符 spam': '内容格式异常，请用自然语言重新描述组队需求。',
      你已在此活动发布过组队帖:
        '你在此活动已有帖子。请打开「我的」→ 我的帖子编辑，或在活动详情页查看。',
      你已发布过相同内容的组队帖:
        '你已经发布过相同内容的帖子，可在个人主页或活动详情页查看。',
      内容疑似黄牛倒票或加价引流:
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
      内容疑似黄牛倒票或加价引流: '帖子因疑似黄牛倒票或加价引流已被自动隐藏。',
      '内容疑似站外引流（如微信导流）': '帖子因疑似站外引流已被自动隐藏。',
    };

    return (
      reasonHints[normalized] ??
      (normalized || '内容违反社区规范，帖子已自动隐藏')
    );
  }

  private truncateCommentPreview(body?: string): string {
    const normalized = body?.replace(/\s+/g, ' ').trim() ?? '';
    if (!normalized) return '…';
    if (normalized.length <= 40) return normalized;
    return `${normalized.slice(0, 40)}…`;
  }
}
