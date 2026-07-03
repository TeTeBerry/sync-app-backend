import { Inject, Injectable } from '@nestjs/common';
import type {
  NotificationCategory,
  NotificationInteractionType,
  NotificationMeta,
} from '../../database/schemas/notification.schema';
import { NotificationService } from '../../modules/notification/notification.service';
import type { NotificationTemplateKey } from '../../modules/notification/notification-templates.util';
import { toRequestActor } from '../../common/auth/actor-query.util';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../modules/user/interfaces/user.repository.interface';
import { UserService } from '../../modules/user/user.service';
import { WechatSubscribeMessageService } from '../../modules/auth/wechat-subscribe-message.service';

export interface NoticeDispatchInput {
  userId: string;
  category: NotificationCategory;
  templateKey: NotificationTemplateKey;
  templateParams?: Record<string, string>;
  meta?: NotificationMeta;
  dedupe?: {
    metaType: NotificationInteractionType;
    activityLegacyId?: number;
    actorUserId?: string;
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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly wechatSubscribe: WechatSubscribeMessageService,
  ) {}

  async notifyActivityUpdate(
    userIds: string[],
    activityLegacyId: number,
    activityName: string,
    changeSummary: string,
    activityDate?: string,
    activityLocation?: string,
    wechatUserIds?: string[],
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

    const wechatRecipients =
      wechatUserIds != null
        ? recipients.filter((userId) =>
            new Set(wechatUserIds.map((id) => id.trim()).filter(Boolean)).has(
              userId,
            ),
          )
        : recipients;

    void this.sendActivityUpdateSubscribe({
      recipientUserIds: wechatRecipients,
      activityLegacyId,
      activityName,
      activityDate,
      activityLocation,
    });
  }

  async notifyProactiveNudge(params: {
    userId: string;
    activityLegacyId: number;
    ruleId: string;
    copy: string;
    activityName?: string;
    prefillQuery?: string;
    openLineup?: boolean;
  }): Promise<void> {
    const displayEventName = params.activityName?.trim();
    if (params.ruleId === 'draft_ready') {
      await this.notificationService.createNotification({
        userId: params.userId,
        type: 'system',
        title: '活动提醒',
        body: params.copy,
        meta: {
          type: 'activity_update',
          activityLegacyId: params.activityLegacyId,
        },
      });
      return;
    }

    await this.notificationService.createNotification({
      userId: params.userId,
      type: 'system',
      title: '活动提醒',
      body: params.copy,
      meta: {
        type: 'proactive_nudge',
        activityLegacyId: params.activityLegacyId,
        nudgeRule: params.ruleId,
        ...(displayEventName ? { displayEventName } : {}),
        ...(params.prefillQuery?.trim()
          ? { prefillQuery: params.prefillQuery.trim() }
          : {}),
        ...(params.openLineup ? { openLineup: true } : {}),
      },
    });
  }

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

  private async sendActivityUpdateSubscribe(params: {
    recipientUserIds: string[];
    activityLegacyId: number;
    activityName: string;
    activityDate?: string;
    activityLocation?: string;
  }): Promise<void> {
    if (!this.wechatSubscribe.isActivityUpdateEnabled()) return;

    await Promise.all(
      params.recipientUserIds.map(async (userId) => {
        const user = await this.userRepository.findByExternalId(userId.trim());
        const openid = user?.openid?.trim();
        if (!openid) return;

        await this.wechatSubscribe.sendActivityUpdateNotice({
          openid,
          activityLegacyId: params.activityLegacyId,
          activityName: params.activityName,
          activityDate: params.activityDate,
          activityLocation: params.activityLocation,
        });
      }),
    );
  }
}
