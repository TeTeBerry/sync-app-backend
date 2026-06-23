import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { PostRecruitStatus, PostStatus } from '../../shared/partner';

export type { PostRecruitStatus, PostStatus };
export type PostDocument = HydratedDocument<Post>;

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

  /** 出发城市（与作者展示 location 区分） */
  @Prop({ index: true })
  departureCity?: string;

  @Prop({ required: true })
  body: string;

  /** 列表摘要：正文前 280 字符，避免列表接口返回全文 body */
  @Prop({ default: '' })
  bodyPreview: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  /** active=可见；hidden=审核/违规隐藏 */
  @Prop({ default: 'active' })
  status: PostStatus;

  /**
   * When false, post is stored for owner/apply flows but omitted from public activity feeds.
   * Missing field is treated as true (legacy posts).
   */
  @Prop({ default: true })
  listedInFeed: boolean;

  @Prop({ default: 0 })
  comments: number;

  /** Buddy recruit wall: open = recruiting; full = closed by author. */
  @Prop({ default: 'open' })
  recruitStatus: PostRecruitStatus;

  /** Total slots the author wants to fill (including self when applicable). */
  @Prop()
  slotsTotal?: number;

  /** Slots already filled per author self-report. */
  @Prop()
  slotsFilled?: number;
}

export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ createdAt: -1 });
PostSchema.index({ activityLegacyId: 1, createdAt: -1 });
PostSchema.index({ activityLegacyId: 1, status: 1, departureCity: 1 });
PostSchema.index({ activityLegacyId: 1, status: 1, createdAt: -1 });
PostSchema.index({ status: 1, createdAt: -1 });
/** Index audit: compound index for activity feed with listedInFeed filter */
PostSchema.index(
  { activityLegacyId: 1, listedInFeed: 1, status: 1, createdAt: -1, _id: -1 },
  { name: 'activity_feed_compound' },
);
/** Index audit: owner list sorted by createdAt */
PostSchema.index({ userId: 1, createdAt: -1 });
