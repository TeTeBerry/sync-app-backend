import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PostApplicationMessageDocument =
  HydratedDocument<PostApplicationMessage>;

/** Messages in a team-apply thread (post owner ↔ applicant). */
@Schema({ timestamps: true })
export class PostApplicationMessage {
  @Prop({ required: true, index: true })
  postId: string;

  /** Always the applicant's user id (thread key with postId). */
  @Prop({ required: true, index: true })
  applicantUserId: string;

  @Prop({ required: true, index: true })
  senderUserId: string;

  @Prop({ required: true })
  body: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostApplicationMessageSchema = SchemaFactory.createForClass(
  PostApplicationMessage,
);
PostApplicationMessageSchema.index({
  postId: 1,
  applicantUserId: 1,
  createdAt: 1,
});
