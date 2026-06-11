import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { LiveInfoCategoryId } from '../../shared/live-info';

export type { LiveInfoCategoryId } from '../../shared/live-info';
export { LIVE_INFO_CATEGORY_IDS } from '../../shared/live-info';

const LiveInfoRatingSchema = {
  categoryId: { type: String, required: true },
  score: { type: Number, required: true, min: 1, max: 5 },
};

export type EventLiveUpdateDocument = HydratedDocument<EventLiveUpdate>;

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

  @Prop({ required: true, index: true, default: 'venue' })
  zoneTag!: string;

  @Prop()
  remark?: string;

  /** Hash of ratings + remark for per-user duplicate detection. */
  @Prop({ index: true })
  contentFingerprint?: string;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: [String], default: [] })
  likedByUserIds!: string[];
}

export const EventLiveUpdateSchema =
  SchemaFactory.createForClass(EventLiveUpdate);

EventLiveUpdateSchema.index({ activityLegacyId: 1, createdAt: -1 });
EventLiveUpdateSchema.index({ activityLegacyId: 1, zoneTag: 1, expiresAt: 1 });
EventLiveUpdateSchema.index({
  activityLegacyId: 1,
  userId: 1,
  contentFingerprint: 1,
  createdAt: -1,
});
EventLiveUpdateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
