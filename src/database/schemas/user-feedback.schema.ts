import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserFeedbackDocument = HydratedDocument<UserFeedback>;

@Schema({ timestamps: true })
export class UserFeedback {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  content: string;
}

export const UserFeedbackSchema = SchemaFactory.createForClass(UserFeedback);
UserFeedbackSchema.index({ userId: 1, createdAt: -1 });
