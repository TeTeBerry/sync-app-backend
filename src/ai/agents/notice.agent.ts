import { Injectable } from '@nestjs/common';
import type {
  NotificationCategory,
  NotificationInteractionType,
  NotificationMeta,
} from '../../database/schemas/notification.schema';
import { NotificationService } from '../../modules/notification/notification.service';
import type { NotificationTemplateKey } from '../../modules/notification/notification-templates.util';
import { toRequestActor } from '../../common/auth/actor-query.util';
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
}
