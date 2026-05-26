import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostApplicationDocument = PostApplication & Document;

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
}

export const PostApplicationSchema =
  SchemaFactory.createForClass(PostApplication);
PostApplicationSchema.index({ userId: 1, postId: 1 }, { unique: true });
