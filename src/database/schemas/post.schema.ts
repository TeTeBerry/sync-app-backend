import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { BuddyMatchCriteria } from '../../ai/match/buddy-match.types';

export type PostDocument = Post & Document;

export type PostStatus = 'recruiting' | 'completed' | 'hidden';

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  authorName: string;

  @Prop()
  authorHandle?: string;

  @Prop()
  authorAvatar?: string;

  @Prop({ index: true })
  activityLegacyId?: number;

  @Prop({ required: true })
  eventTitle: string;

  @Prop()
  location?: string;

  /** 出发城市（匹配主字段，与作者展示 location 区分） */
  @Prop({ index: true })
  departureCity?: string;

  @Prop({ type: Object })
  matchCriteria?: BuddyMatchCriteria;

  @Prop({ required: true })
  body: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 'recruiting' })
  status: PostStatus;

  @Prop({ default: 0 })
  likes: number;

  @Prop({ default: 0 })
  comments: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ createdAt: -1 });
PostSchema.index({ activityLegacyId: 1, createdAt: -1 });
PostSchema.index({ activityLegacyId: 1, status: 1, departureCity: 1 });
