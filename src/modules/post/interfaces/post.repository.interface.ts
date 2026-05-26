import { PostDocument } from '../../../database/schemas/post.schema';

export interface PostQueryFilter {
  userId?: string;
  authorName?: string;
  activityLegacyId?: number;
}

export type PostRecord = PostDocument & {
  _id: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export interface IPostRepository {
  findPopular(limit: number): Promise<PostRecord[]>;
  findByActivityLegacyId(activityLegacyId: number): Promise<PostRecord[]>;
  findByOwner(filter: PostQueryFilter): Promise<PostRecord[]>;
  findById(id: string): Promise<PostRecord | null>;
  deleteById(id: string): Promise<boolean>;
  countByOwner(filter: PostQueryFilter): Promise<number>;
  sumLikesByOwner(filter: PostQueryFilter): Promise<number>;
}

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');
