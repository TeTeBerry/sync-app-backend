import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationType =
  | 'pindan_join_leader'
  | 'pindan_join_member'
  | 'ticket_match';

export interface NotificationMeta {
  pindanLegacyId?: number;
  ticketId?: string;
  activityId?: string;
  actorUserId?: string;
  actorUserName?: string;
  pindanTitle?: string;
  ticketType?: 'sell' | 'buy';
  displayEventName?: string;
}

export type NotificationDocument = Notification & Document;

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
