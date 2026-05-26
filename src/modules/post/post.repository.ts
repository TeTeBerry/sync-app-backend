import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import {
  IPostRepository,
  PostQueryFilter,
  PostRecord,
} from './interfaces/post.repository.interface';

function buildOwnerFilter(filter: PostQueryFilter) {
  const clauses: Record<string, unknown>[] = [];
  if (filter.userId?.trim()) {
    clauses.push({ userId: filter.userId.trim() });
  }
  if (filter.authorName?.trim()) {
    clauses.push({ authorName: filter.authorName.trim() });
  }
  if (clauses.length === 0) {
    return {};
  }
  return { $or: clauses };
}

@Injectable()
export class PostRepository implements IPostRepository {
  constructor(
    @InjectModel(Post.name) private readonly model: Model<PostDocument>,
  ) {}

  async findPopular(limit: number): Promise<PostRecord[]> {
    return this.model.find().sort({ likes: -1, createdAt: -1 }).limit(limit).lean();
  }

  async findByActivityLegacyId(activityLegacyId: number): Promise<PostRecord[]> {
    return this.model
      .find({ activityLegacyId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByOwner(filter: PostQueryFilter): Promise<PostRecord[]> {
    return this.model.find(buildOwnerFilter(filter)).sort({ createdAt: -1 }).lean();
  }

  async findById(id: string): Promise<PostRecord | null> {
    return this.model.findById(id).lean();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async countByOwner(filter: PostQueryFilter): Promise<number> {
    return this.model.countDocuments(buildOwnerFilter(filter));
  }

  async sumLikesByOwner(filter: PostQueryFilter): Promise<number> {
    const rows = await this.model
      .aggregate<{ total: number }>([
        { $match: buildOwnerFilter(filter) },
        { $group: { _id: null, total: { $sum: '$likes' } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }
}
