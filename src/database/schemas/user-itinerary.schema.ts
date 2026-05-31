import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ItineraryTimelineDotColor = 'pink' | 'cyan' | 'purple';

export type ItineraryTimelinePill = {
  label: string;
  variant: 'green' | 'pink';
};

export type ItineraryTimelineItem = {
  id: string;
  time: string;
  dotColor: ItineraryTimelineDotColor;
  title: string;
  subtitle?: string;
  timeTag?: string;
  timeTagColor?: ItineraryTimelineDotColor;
  pill?: ItineraryTimelinePill;
  highlighted?: boolean;
};

export type ItineraryDay = {
  id: string;
  label: string;
  bannerDateLabel: string;
  nodeCount: number;
  items: ItineraryTimelineItem[];
};

export type UserItineraryDocument = UserItinerary & Document;

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

UserItinerarySchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true },
);
