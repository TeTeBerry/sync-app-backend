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

  /** Light apply when applicant has no recruiting post yet. */
  @Prop()
  lightDepartureCity?: string;

  @Prop()
  lightTripDays?: number;

  @Prop()
  lightGenderPref?: string;

  /** Set when post owner opens chat from profile post list ("沟通"). */
  @Prop()
  ownerOpenedChatAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostApplicationSchema =
  SchemaFactory.createForClass(PostApplication);
PostApplicationSchema.index({ userId: 1, postId: 1 }, { unique: true });
