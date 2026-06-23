import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  TravelGuidePlan,
  AiGuidePlanFormValues,
} from '../../shared/travel-guide';
import type { TravelGuideGenerationJobStatus } from '../../shared/travel-guide';

export type { TravelGuideGenerationJobStatus };

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
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  })
  status!: TravelGuideGenerationJobStatus;

  /** Same params hash as generation cache — dedupe in-flight jobs per user. */
  @Prop({ required: true, index: true })
  dedupeKey!: string;

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
