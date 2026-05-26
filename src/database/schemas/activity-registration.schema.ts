import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ActivityRegistrationDocument = ActivityRegistration & Document;

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

  @Prop({ default: 0 })
  price: number;
}

export const ActivityRegistrationSchema = SchemaFactory.createForClass(
  ActivityRegistration,
);
ActivityRegistrationSchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true },
);
