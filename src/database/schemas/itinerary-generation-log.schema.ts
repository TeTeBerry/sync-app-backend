import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ItineraryGenerationLogDocument = HydratedDocument<ItineraryGenerationLog>;

@Schema({ collection: 'itinerary_generation_logs', timestamps: true })
export class ItineraryGenerationLog {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  @Prop({ type: [String], default: [] })
  selectedDjIds!: string[];

  @Prop({ default: false })
  cached!: boolean;

  @Prop({ default: false })
  llmUsed!: boolean;

  @Prop({ type: Object })
  meta?: Record<string, unknown>;
}

export const ItineraryGenerationLogSchema = SchemaFactory.createForClass(
  ItineraryGenerationLog,
);

ItineraryGenerationLogSchema.index({ createdAt: -1 });
