import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationInteractionType,
  NotificationMeta,
  NotificationType,
} from '../../database/schemas/notification.schema';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  buildNotificationFromTemplate,
  type NotificationTemplateKey,
} from './notification-templates.util';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  meta?: NotificationMeta;
}

export interface CreateTemplateNotificationInput {
  userId: string;
  templateKey: NotificationTemplateKey;
  templateParams?: Record<string, string>;
  meta?: NotificationMeta;
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  meta?: NotificationMeta;
  createdAt: string;
}

function resolveUserId(actor: RequestActor): string {
  return actor.resolvedUserId?.trim() || 'anonymous';
}

function resolveStoredUserId(userId: string): string {
  return userId?.trim() || 'anonymous';
}

function toDto(doc: {
  _id?: unknown;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read?: boolean;
  meta?: NotificationMeta;
  createdAt?: Date | string;
}): NotificationDto {
  return {
    id: String(doc._id),
    userId: doc.userId,
    type: doc.type,
    title: doc.title,
    body: doc.body,
    read: Boolean(doc.read),
    meta: doc.meta,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : typeof doc.createdAt === 'string'
          ? doc.createdAt
          : new Date().toISOString(),
  };
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async createFromTemplate(
    input: CreateTemplateNotificationInput,
  ): Promise<NotificationDto | null> {
    const built = buildNotificationFromTemplate(
      input.templateKey,
      input.templateParams ?? {},
      input.meta,
    );

    return this.createNotification({
      userId: input.userId,
      type: built.type,
      title: built.title,
      body: built.body,
      meta: built.meta,
    });
  }

  async createNotification(
    input: CreateNotificationInput,
  ): Promise<NotificationDto | null> {
    const userId = resolveStoredUserId(input.userId);
    if (userId === 'anonymous') return null;

    const doc = await this.notificationModel.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      read: false,
      meta: input.meta ?? {},
    });

    return toDto(doc.toObject());
  }

  async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    const rows = inputs
      .map((input) => ({
        userId: resolveStoredUserId(input.userId),
        type: input.type,
        title: input.title,
        body: input.body,
        read: false,
        meta: input.meta ?? {},
      }))
      .filter((row) => row.userId !== 'anonymous');

    if (rows.length === 0) return;
    await this.notificationModel.insertMany(rows);
  }

  async listByUser(actor: RequestActor): Promise<NotificationDto[]> {
    const uid = resolveUserId(actor);
    const rows = await this.notificationModel
      .find({ userId: uid })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return rows.map((row) => toDto(row));
  }

  async unreadCount(actor: RequestActor): Promise<number> {
    const uid = resolveUserId(actor);
    const rows = await this.notificationModel
      .find({ userId: uid, read: false })
      .select({ meta: 1 })
      .limit(200)
      .lean();

    return rows.length;
  }

  async markRead(id: string, actor: RequestActor): Promise<NotificationDto> {
    const uid = resolveUserId(actor);
    const doc = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, userId: uid },
        { $set: { read: true } },
        { new: true },
      )
      .lean();

    if (!doc) {
      throw new NotFoundException('通知不存在');
    }

    return toDto(doc);
  }

  async markAllRead(actor: RequestActor): Promise<{ ok: true }> {
    const uid = resolveUserId(actor);
    await this.notificationModel.updateMany(
      { userId: uid, read: false },
      { $set: { read: true } },
    );
    return { ok: true };
  }

  async deleteOne(id: string, actor: RequestActor): Promise<{ ok: true }> {
    const uid = resolveUserId(actor);
    const result = await this.notificationModel.deleteOne({
      _id: id,
      userId: uid,
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('通知不存在');
    }
    return { ok: true };
  }

  async clearAll(actor: RequestActor): Promise<{ ok: true }> {
    const uid = resolveUserId(actor);
    await this.notificationModel.deleteMany({ userId: uid });
    return { ok: true };
  }

  async countUnreadPostEngagement(
    userId: string,
    postIds: string[],
  ): Promise<number> {
    const uid = resolveStoredUserId(userId);
    if (uid === 'anonymous' || postIds.length === 0) return 0;

    const normalizedPostIds = [
      ...new Set(postIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (!normalizedPostIds.length) return 0;

    return this.notificationModel.countDocuments({
      userId: uid,
      read: false,
      'meta.type': { $in: ['comment', 'comment_reply'] },
      'meta.postId': { $in: normalizedPostIds },
    });
  }

  async hasRecentByMeta(
    userId: string,
    metaType: NotificationInteractionType,
    options?: {
      activityLegacyId?: number;
      postId?: string;
      actorUserId?: string;
      changeSummary?: string;
      sinceMs?: number;
    },
  ): Promise<boolean> {
    const uid = resolveStoredUserId(userId);
    if (uid === 'anonymous') return false;

    const sinceMs = options?.sinceMs ?? 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - sinceMs);

    const filter: Record<string, unknown> = {
      userId: uid,
      'meta.type': metaType,
      createdAt: { $gte: since },
    };

    if (options?.activityLegacyId != null) {
      filter['meta.activityLegacyId'] = options.activityLegacyId;
    }
    if (options?.postId?.trim()) {
      filter['meta.postId'] = options.postId.trim();
    }
    if (options?.actorUserId?.trim()) {
      filter['meta.actorUserId'] = options.actorUserId.trim();
    }
    if (options?.changeSummary?.trim()) {
      filter['meta.changeSummary'] = options.changeSummary.trim();
    }

    const count = await this.notificationModel.countDocuments(filter);
    return count > 0;
  }
}
