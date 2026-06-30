import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserActivityEngagementDocument =
  HydratedDocument<UserActivityEngagement>;

@Schema({ collection: 'user_activity_engagements', timestamps: true })
export class UserActivityEngagement {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  activityLegacyId!: number;

  @Prop()
  lineupViewedAt?: string;

  @Prop()
  recruitSearchedAt?: string;
}

export const UserActivityEngagementSchema = SchemaFactory.createForClass(
  UserActivityEngagement,
);

UserActivityEngagementSchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true },
);
