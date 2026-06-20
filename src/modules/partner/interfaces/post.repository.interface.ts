import type { Post } from '../../../database/schemas/post.schema';
import type { PostPageCursor } from '../domain/post-cursor.util';
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
  findByActivityLegacyId(activityLegacyId: number): Promise<PostRecord[]>;
  findByActivityLegacyIdPage(
    activityLegacyId: number,
    options: { limit: number; cursor?: PostPageCursor | null },
  ): Promise<PostRecord[]>;
  findByOwner(filter: PostQueryFilter): Promise<PostRecord[]>;
  findByOwnerPage(
    filter: PostQueryFilter,
    options: { limit: number; cursor?: PostPageCursor | null },
  ): Promise<PostRecord[]>;
  findById(id: string): Promise<PostRecord | null>;
  findByIds(ids: string[]): Promise<PostRecord[]>;
  create(data: Partial<PostRecord>): Promise<PostRecord>;
  updateById(
    id: string,
    patch: Partial<PostRecord>,
  ): Promise<PostRecord | null>;
  deleteById(id: string): Promise<boolean>;
  countByOwner(filter: PostQueryFilter): Promise<number>;
  existsDuplicateBody(
    userId: string,
    body: string,
    activityLegacyId?: number,
    excludePostId?: string,
  ): Promise<boolean>;
  findOwnerSimilarActivePost(
    userId: string,
    body: string,
    activityLegacyId?: number,
    excludePostId?: string,
  ): Promise<PostRecord | null>;
  existsOwnerActivePostForActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean>;
  findOwnerActivePostForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord | null>;
  findOwnerActivePostsForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord[]>;
  countByOwnerAndActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<number>;
  incrementCommentCount(id: string): Promise<PostRecord | null>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');
