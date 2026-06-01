import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActivityRegistrationDocument =
  HydratedDocument<ActivityRegistration>;

@Schema({ timestamps: true })
export class ActivityRegistration {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  authorName?: string;

  @Prop({ required: true, index: true })
  activityLegacyId: number;

  @Prop({ default: 'registered' })
  status: 'registered';
}

export const ActivityRegistrationSchema =
  SchemaFactory.createForClass(ActivityRegistration);
ActivityRegistrationSchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true },
);
