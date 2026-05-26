import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostCommentDocument = PostComment & Document;

@Schema({ timestamps: true })
export class PostComment {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  authorName?: string;

  @Prop({ required: true, index: true })
  postId: string;

  /** When set, this comment is a reply to another comment. */
  @Prop({ index: true })
  parentCommentId?: string;

  @Prop({ required: true })
  body: string;
}

export const PostCommentSchema = SchemaFactory.createForClass(PostComment);
