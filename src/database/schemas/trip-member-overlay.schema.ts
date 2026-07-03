import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TripMemberOverlayDocument = HydratedDocument<TripMemberOverlay>;

export type TripMemberGuideOverlay = {
  flights?: string;
  hotel?: string;
  arrivalAt?: string;
  /** When true, teammates can see this member's overlay summary. */
  visibleToMembers?: boolean;
};

export type TripMemberItineraryMark = 'must' | 'maybe' | 'skip';

@Schema({ collection: 'trip_member_overlays', timestamps: true })
export class TripMemberOverlay {
  @Prop({ required: true, index: true })
  tripPlanId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ type: Object })
  guideOverlay?: TripMemberGuideOverlay;

  @Prop({ type: Object, default: {} })
  itineraryMarks?: Record<string, TripMemberItineraryMark>;

  @Prop({ type: Object, default: {} })
  itineraryNotes?: Record<string, string>;
}

export const TripMemberOverlaySchema =
  SchemaFactory.createForClass(TripMemberOverlay);

TripMemberOverlaySchema.index(
  { tripPlanId: 1, userId: 1 },
  { unique: true, name: 'trip_member_overlay_plan_user' },
);
