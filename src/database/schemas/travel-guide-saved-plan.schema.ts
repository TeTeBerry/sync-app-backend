import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  TravelGuidePlan,
  AiGuidePlanFormValues,
} from '../../shared/travel-guide';

@Schema({ collection: 'travel_guide_saved_plans', timestamps: true })
export class TravelGuideSavedPlan {
  @Prop({ required: true, unique: true, index: true })
  guideId!: string;

  @Prop({ required: true, index: true })
  ownerUserId!: string;

  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  /** 生成表单（不含 guideId） */
  @Prop({ type: Object, required: true })
  form!: AiGuidePlanFormValues;

  @Prop({ type: Object, required: true })
  plan!: TravelGuidePlan;

  @Prop({ required: true, index: true })
  expiresAt!: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TravelGuideSavedPlanDocument =
  HydratedDocument<TravelGuideSavedPlan>;

export const TravelGuideSavedPlanSchema =
  SchemaFactory.createForClass(TravelGuideSavedPlan);

TravelGuideSavedPlanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
