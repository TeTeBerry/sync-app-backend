import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { RecognizeTravelPlanReceiptResult } from '@sync/travel-plan-contracts';

export type TravelPlanReceiptRecognizeJobStatus =
  | 'pending'
  | 'completed'
  | 'failed';

@Schema({
  collection: 'travel_plan_receipt_recognize_jobs',
  timestamps: true,
})
export class TravelPlanReceiptRecognizeJob {
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
  status!: TravelPlanReceiptRecognizeJobStatus;

  @Prop({ type: Object, required: true })
  requestParams!: Record<string, unknown>;

  @Prop({ type: Object })
  result?: RecognizeTravelPlanReceiptResult;

  @Prop()
  errorMessage?: string;

  @Prop({ required: true, index: true })
  expiresAt!: Date;
}

export type TravelPlanReceiptRecognizeJobDocument =
  HydratedDocument<TravelPlanReceiptRecognizeJob>;

export const TravelPlanReceiptRecognizeJobSchema = SchemaFactory.createForClass(
  TravelPlanReceiptRecognizeJob,
);

TravelPlanReceiptRecognizeJobSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);
