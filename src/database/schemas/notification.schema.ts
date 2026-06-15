import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationType = 'general' | 'interaction' | 'system';

/** High-level push category for NoticeAgent routing and client grouping. */
export type NotificationCategory = 'system' | 'general';

/** @deprecated Post like/comment interactions removed — kept for stored meta parsing only. */
export type DeprecatedNotificationInteractionType =
  | 'like'
  | 'comment'
  | 'comment_reply';

/** Deep-link hint for notifications. */
export type NotificationInteractionType =
  | DeprecatedNotificationInteractionType
  | 'activity'
  | 'activity_update'
  | 'post_rejected'
  | 'post_hidden';

export interface NotificationMeta {
  /** UI grouping (system / general). Legacy like/comment values are filtered from inbox. */
  category?: NotificationCategory;
  /** Target activity for event-detail navigation. */
  activityLegacyId?: number;
  /** Target post within the activity feed. */
  postId?: string;
  /** Partner interaction kind; drives client routing when present. */
  type?: NotificationInteractionType;
  actorUserId?: string;
  actorUserName?: string;
  /** i18n template key, e.g. notifications.types.like */
  templateKey?: string;
  /** Interpolation params for client-side i18n rendering. */
  templateParams?: Record<string, string>;
  /** Post rejection reason summary. */
  rejectionReason?: string;
  /** Parent comment ID for reply notifications. */
  parentCommentId?: string;
  /** Activity update summary (e.g. `地点已更新为 …`) for dedupe / display. */
  changeSummary?: string;
}

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ default: false, index: true })
  read: boolean;

  @Prop({ type: Object, default: {} })
  meta?: NotificationMeta;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });
