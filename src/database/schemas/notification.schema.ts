import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationType = 'general' | 'interaction' | 'system' | 'match';

/** High-level push category for NoticeAgent routing and client grouping. */
export type NotificationCategory =
  | 'comment'
  | 'like'
  | 'buddy_recommend'
  | 'system'
  | 'general';

/** Deep-link hint for partner interactions (like / comment / application). */
export type NotificationInteractionType =
  | 'like'
  | 'comment'
  | 'comment_reply'
  | 'application'
  | 'activity'
  | 'activity_update'
  | 'post_rejected'
  | 'post_hidden';

export interface NotificationMeta {
  /** NoticeAgent category (comment / like / buddy_recommend / system). */
  category?: NotificationCategory;
  /** Target activity for event-detail navigation. */
  activityLegacyId?: number;
  /** Target post within the activity feed. */
  postId?: string;
  /** Partner interaction kind; drives client routing when present. */
  type?: NotificationInteractionType;
  /** @deprecated Prefer activityLegacyId (number). */
  activityId?: string;
  actorUserId?: string;
  actorUserName?: string;
  /** i18n template key, e.g. notifications.types.like */
  templateKey?: string;
  /** Interpolation params for client-side i18n rendering. */
  templateParams?: Record<string, string>;
  /** AI match recommendation post IDs. */
  matchPostIds?: string[];
  /** Post rejection reason summary. */
  rejectionReason?: string;
  /** Parent comment ID for reply notifications. */
  parentCommentId?: string;
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
