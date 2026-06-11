import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import type {
  TravelPlanCategory,
  TravelPlanNodeRecord,
} from '../../shared/travel-plan';

export type { TravelPlanCategory, TravelPlanNodeRecord };

export type UserTravelPlanDocument = HydratedDocument<UserTravelPlan>;

@Schema({ collection: 'user_travel_plans', timestamps: true })
export class UserTravelPlan {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  @Prop()
  eventMeta?: string;

  @Prop({ type: Array, default: [] })
  nodes!: TravelPlanNodeRecord[];

  @Prop({ type: Object, default: {} })
  activityConfirmations!: Record<string, boolean>;

  @Prop({ type: Object, default: {} })
  activityPriceOverrides!: Record<string, number>;

  @Prop({ type: [String], default: [] })
  hiddenActivityNodeIds!: string[];
}

export const UserTravelPlanSchema =
  SchemaFactory.createForClass(UserTravelPlan);

UserTravelPlanSchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true },
);
