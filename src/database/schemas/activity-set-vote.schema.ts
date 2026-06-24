import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActivitySetVoteDocument = HydratedDocument<ActivitySetVote>;

@Schema({ timestamps: true })
export class ActivitySetVote {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  activityLegacyId: number;

  /** Up to 3 lineup artistId slugs. */
  @Prop({ type: [String], required: true })
  picks: string[];
}

export const ActivitySetVoteSchema =
  SchemaFactory.createForClass(ActivitySetVote);
ActivitySetVoteSchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true },
);
ActivitySetVoteSchema.index({ activityLegacyId: 1 });
