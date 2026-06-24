import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FestivalSessionDocument = HydratedDocument<FestivalSession>;

@Schema({ collection: 'festival_sessions', timestamps: true })
export class FestivalSession {
  @Prop({ required: true })
  activityLegacyId!: number;

  @Prop({ required: true })
  dateKey!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  bannerDateLabel!: string;

  @Prop({ default: 0 })
  sortOrder!: number;
}

export const FestivalSessionSchema =
  SchemaFactory.createForClass(FestivalSession);

FestivalSessionSchema.index(
  { activityLegacyId: 1, dateKey: 1 },
  { unique: true },
);
/** Schedule load sort — itinerary-schedule.service.ts */
FestivalSessionSchema.index(
  { activityLegacyId: 1, sortOrder: 1 },
  { name: 'festival_session_activity_sort' },
);
