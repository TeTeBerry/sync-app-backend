import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import type {
  ItineraryDay,
  ItineraryTimelineDotColor,
  ItineraryTimelineItem,
  ItineraryTimelinePill,
} from '../../shared/itinerary';

export type {
  ItineraryDay,
  ItineraryTimelineDotColor,
  ItineraryTimelineItem,
  ItineraryTimelinePill,
};

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
}

export const UserItinerarySchema = SchemaFactory.createForClass(UserItinerary);

UserItinerarySchema.index({ userId: 1, activityLegacyId: 1 }, { unique: true });
