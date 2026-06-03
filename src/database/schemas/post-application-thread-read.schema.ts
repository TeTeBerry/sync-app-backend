import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PostApplicationThreadReadDocument =
  HydratedDocument<PostApplicationThreadRead>;

/** Per-user read cursor for a team-apply chat thread. */
@Schema({ timestamps: true })
export class PostApplicationThreadRead {
  @Prop({ required: true, index: true })
  postId: string;

  @Prop({ required: true, index: true })
  applicantUserId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  lastReadAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const PostApplicationThreadReadSchema = SchemaFactory.createForClass(
  PostApplicationThreadRead,
);
PostApplicationThreadReadSchema.index(
  { postId: 1, applicantUserId: 1, userId: 1 },
  { unique: true },
);
