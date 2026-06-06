import type { Post } from '../../../database/schemas/post.schema';
import type {
  HotPostPageCursor,
  PostPageCursor,
} from '../domain/post-cursor.util';
import type { Types } from 'mongoose';

export interface PostQueryFilter {
  userId?: string;
  authorName?: string;
  activityLegacyId?: number;
  status?: string;
}

/** Plain post shape from lean() / toObject() — not a Mongoose document instance. */
export type PostRecord = Post & {
  _id: Types.ObjectId | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export interface IPostRepository {
  findPopular(limit: number): Promise<PostRecord[]>;
  findAll(): Promise<PostRecord[]>;
  findShareFeed(options: {
    limit: number;
    sort: 'new' | 'hot';
  }): Promise<PostRecord[]>;
  findShareFeedPage(options: {
    limit: number;
    sort: 'new' | 'hot';
    cursor?: PostPageCursor | null;
    hotCursor?: HotPostPageCursor | null;
  }): Promise<PostRecord[]>;
  countShareAuthors(): Promise<number>;
  findByActivityLegacyId(activityLegacyId: number): Promise<PostRecord[]>;
  /** Recruiting posts for match/ranking (includes apply-only / unlisted feed posts). */
  findRecruitingByActivityForMatch(
    activityLegacyId: number,
  ): Promise<PostRecord[]>;
  findByActivityLegacyIdPage(
    activityLegacyId: number,
    options: { limit: number; cursor?: PostPageCursor | null },
  ): Promise<PostRecord[]>;
  findByOwner(filter: PostQueryFilter): Promise<PostRecord[]>;
  findById(id: string): Promise<PostRecord | null>;
  findByIds(ids: string[]): Promise<PostRecord[]>;
  create(data: Partial<PostRecord>): Promise<PostRecord>;
  updateById(
    id: string,
    patch: Partial<PostRecord>,
  ): Promise<PostRecord | null>;
  incrementCounter(
    id: string,
    field: 'likes' | 'comments',
    delta?: number,
  ): Promise<PostRecord | null>;
  deleteById(id: string): Promise<boolean>;
  countByOwner(filter: PostQueryFilter): Promise<number>;
  countCompletedByOwner(filter: PostQueryFilter): Promise<number>;
  sumLikesByOwner(filter: PostQueryFilter): Promise<number>;
  existsDuplicateBody(
    userId: string,
    body: string,
    activityLegacyId?: number,
    excludePostId?: string,
  ): Promise<boolean>;
  findOwnerSimilarRecruitingPost(
    userId: string,
    body: string,
    activityLegacyId?: number,
    excludePostId?: string,
  ): Promise<PostRecord | null>;
  existsOwnerRecruitingPostForActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean>;
  findOwnerRecruitingPostForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord | null>;
  findOwnerRecruitingPostsForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord[]>;
  existsOwnerRecruitingPostByContentTypes(
    userId: string,
    contentTypes: string[],
  ): Promise<{ exists: boolean; matchedType?: string }>;
  countByOwnerAndActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<number>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');
