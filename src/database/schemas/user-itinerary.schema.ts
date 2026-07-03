import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import type { ItineraryDay, ItineraryMeetup } from '@sync/itinerary-contracts';

export type {
  ItineraryDay,
  ItineraryTimelineDotColor,
  ItineraryTimelineItem,
  ItineraryTimelinePill,
} from '@sync/itinerary-contracts';

export type UserItineraryDocument = HydratedDocument<UserItinerary>;

@Schema({ collection: 'user_itineraries', timestamps: true })
export class UserItinerary {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  @Prop({ type: [String], default: [] })
  selectedDjIds!: string[];

  @Prop({ required: true })
  eventMeta!: string;

  @Prop({ type: Array, default: [] })
  days!: ItineraryDay[];

  @Prop({ type: Object })
  meetup?: ItineraryMeetup;

  /** When set, this document is shared by all TripPlan members. */
  @Prop({ index: true, sparse: true })
  tripPlanId?: string;

  /** Last editor among TripPlan members (collab mode). */
  @Prop()
  lastEditedByUserId?: string;
}

export const UserItinerarySchema = SchemaFactory.createForClass(UserItinerary);

UserItinerarySchema.index({ userId: 1, activityLegacyId: 1 }, { unique: true });
UserItinerarySchema.index(
  { tripPlanId: 1 },
  { unique: true, sparse: true, name: 'user_itinerary_trip_plan' },
);
