import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  NotificationMeta,
  NotificationType,
} from '@sync/notification-contracts';

export type {
  NotificationCategory,
  NotificationInteractionType,
  NotificationMeta,
  NotificationType,
} from '@sync/notification-contracts';

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
