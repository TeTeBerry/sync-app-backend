import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TripPlanDocument = HydratedDocument<TripPlan>;

@Schema({ collection: 'trip_plans', timestamps: true })
export class TripPlan {
  @Prop({ required: true })
  activityLegacyId!: number;

  @Prop({ required: true, index: true })
  ownerId!: string;

  @Prop({ type: [String], default: [] })
  memberIds!: string[];

  /** TravelGuideGenerationJob.jobId for the guide associated with this plan. */
  @Prop()
  guideId?: string;

  /** UserItinerary._id for the itinerary associated with this plan. */
  @Prop()
  itineraryId?: string;

  /** UserTravelPlan._id for the ledger associated with this plan. */
  @Prop()
  travelPlanId?: string;

  /** Short-lived token for inviting members via WeChat share. */
  @Prop()
  shareToken?: string;

  /** When shareToken expires (24h from creation). */
  @Prop()
  shareTokenExpiresAt?: Date;
}

export const TripPlanSchema = SchemaFactory.createForClass(TripPlan);
TripPlanSchema.index({ ownerId: 1, activityLegacyId: 1 }, { unique: true });
TripPlanSchema.index({ shareToken: 1 });
