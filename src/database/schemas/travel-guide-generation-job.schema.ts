import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { TravelGuidePlan } from '../../modules/travel-guide/domain/travel-guide.types';

export type TravelGuideGenerationJobStatus = 'pending' | 'completed' | 'failed';

@Schema({ collection: 'travel_guide_generation_jobs', timestamps: true })
export class TravelGuideGenerationJob {
  @Prop({ required: true, unique: true, index: true })
  jobId!: string;

  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  @Prop({ required: true, index: true })
  ownerUserId!: string;

  @Prop({
    required: true,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status!: TravelGuideGenerationJobStatus;

  @Prop({ type: Object, required: true })
  requestParams!: Record<string, unknown>;

  @Prop({ type: Object })
  plan?: TravelGuidePlan;

  @Prop()
  errorMessage?: string;

  @Prop({ required: true, index: true })
  expiresAt!: Date;
}

export type TravelGuideGenerationJobDocument =
  HydratedDocument<TravelGuideGenerationJob>;

export const TravelGuideGenerationJobSchema = SchemaFactory.createForClass(
  TravelGuideGenerationJob,
);

TravelGuideGenerationJobSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);
