import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TravelPlanCategory =
  | 'flight'
  | 'transport'
  | 'hotel'
  | 'dining'
  | 'event';

export type TravelPlanNodeRecord = {
  id: string;
  category: TravelPlanCategory;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  title: string;
  subtitle: string;
  detail?: string;
  price?: number;
  confirmed: boolean;
};

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
