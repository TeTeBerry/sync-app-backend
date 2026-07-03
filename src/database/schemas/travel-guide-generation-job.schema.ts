import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  TravelGuidePlan,
  AiGuidePlanFormValues,
} from '@sync/travel-guide-contracts';
import type {
  TravelGuideGenerationJobProgress,
  TravelGuideGenerationJobStatus,
} from '@sync/travel-guide-contracts';

export type { TravelGuideGenerationJobStatus };

@Schema({ collection: 'travel_guide_generation_jobs', timestamps: true })
export class TravelGuideGenerationJob {
  @Prop({ required: true, unique: true, index: true })
  jobId!: string;

  @Prop({ required: true })
  activityLegacyId!: number;

  @Prop({ required: true })
  ownerUserId!: string;

  @Prop({
    required: true,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  })
  status!: TravelGuideGenerationJobStatus;

  /** Same params hash as generation cache — dedupe in-flight jobs per user. */
  @Prop({ required: true })
  dedupeKey!: string;

  @Prop({ type: Object, required: true })
  requestParams!: Record<string, unknown>;

  @Prop({ type: Object })
  plan?: TravelGuidePlan;

  @Prop()
  errorMessage?: string;

  @Prop({ type: Object })
  progress?: TravelGuideGenerationJobProgress;

  @Prop({ required: true, index: true })
  expiresAt!: Date;

  /** TripPlan this guide belongs to (collab mode). */
  @Prop({ index: true, sparse: true })
  tripPlanId?: string;
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
TravelGuideGenerationJobSchema.index(
  { ownerUserId: 1, dedupeKey: 1, status: 1 },
  { name: 'travel_guide_job_dedupe' },
);
TravelGuideGenerationJobSchema.index(
  { ownerUserId: 1, activityLegacyId: 1, status: 1, updatedAt: -1 },
  { name: 'travel_guide_job_latest_completed' },
);
