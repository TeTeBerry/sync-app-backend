import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PostCommentDocument = HydratedDocument<PostComment>;

@Schema({ timestamps: true })
export class PostComment {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  authorName?: string;

  @Prop()
  authorAvatar?: string;

  @Prop({ required: true, index: true })
  postId: string;

  /** When set, this comment is a reply to another comment. */
  @Prop({ index: true })
  parentCommentId?: string;

  @Prop({ required: true })
  body: string;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);
/** Index audit: compound index for top-level comment pagination */
PostCommentSchema.index(
  { postId: 1, createdAt: 1, _id: 1 },
  { name: 'post_comment_pagination' },
);
/** Index audit: compound index for reply lookup */
PostCommentSchema.index(
  { postId: 1, parentCommentId: 1, createdAt: 1 },
  { name: 'post_comment_replies' },
);
