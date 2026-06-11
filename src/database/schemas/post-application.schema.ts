import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PostApplicationDocument = HydratedDocument<PostApplication>;

@Schema({ timestamps: true })
export class PostApplication {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  authorName?: string;

  @Prop({ required: true, index: true })
  postId: string;

  @Prop({ default: 'pending' })
  status: 'pending' | 'accepted' | 'rejected';

  /** Optional note from applicant shown to post author. */
  @Prop()
  message?: string;

  /** Legacy light-apply fields (retained for historical records). */
  @Prop()
  lightDepartureCity?: string;

  @Prop()
  lightTripDays?: number;

  @Prop()
  lightGenderPref?: string;

  /** Legacy: post owner opened chat from profile (removed feature). */
  @Prop()
  ownerOpenedChatAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostApplicationSchema =
  SchemaFactory.createForClass(PostApplication);
PostApplicationSchema.index({ userId: 1, postId: 1 }, { unique: true });
