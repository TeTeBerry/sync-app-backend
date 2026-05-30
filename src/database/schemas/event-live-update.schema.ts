import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { LiveInfoCategoryId } from '../../modules/live-info/domain/live-info-categories';

export type { LiveInfoCategoryId } from '../../modules/live-info/domain/live-info-categories';
export { LIVE_INFO_CATEGORY_IDS } from '../../modules/live-info/domain/live-info-categories';

const LiveInfoRatingSchema = {
  categoryId: { type: String, required: true },
  score: { type: Number, required: true, min: 1, max: 5 },
};

export type EventLiveUpdateDocument = EventLiveUpdate & Document;

@Schema({ collection: 'event_live_updates', timestamps: true })
export class EventLiveUpdate {
  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop()
  authorName?: string;

  @Prop()
  avatar?: string;

  @Prop({ type: [LiveInfoRatingSchema], required: true })
  ratings!: { categoryId: LiveInfoCategoryId; score: number }[];

  @Prop()
  remark?: string;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: [String], default: [] })
  likedByUserIds!: string[];
}

export const EventLiveUpdateSchema =
  SchemaFactory.createForClass(EventLiveUpdate);

EventLiveUpdateSchema.index({ activityLegacyId: 1, createdAt: -1 });
EventLiveUpdateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
