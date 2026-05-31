import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FestivalSessionDocument = FestivalSession & Document;

@Schema({ collection: 'festival_sessions', timestamps: true })
export class FestivalSession {
  @Prop({ required: true, index: true })
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
