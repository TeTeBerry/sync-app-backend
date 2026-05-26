import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import { buildOwnerMongoFilter } from '../../common/utils/demo-owner.util';
import {
  IPostRepository,
  PostQueryFilter,
  PostRecord,
} from './interfaces/post.repository.interface';

function buildOwnerFilter(filter: PostQueryFilter) {
  return buildOwnerMongoFilter(filter.userId, filter.authorName);
}

@Injectable()
export class PostRepository implements IPostRepository {
  constructor(
    @InjectModel(Post.name) private readonly model: Model<PostDocument>,
  ) {}

  async findPopular(limit: number): Promise<PostRecord[]> {
    return this.model
      .find({ status: { $ne: 'hidden' } })
      .sort({ likes: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async findByActivityLegacyId(
    activityLegacyId: number,
  ): Promise<PostRecord[]> {
    return this.model
      .find({ activityLegacyId, status: { $ne: 'hidden' } })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByOwner(filter: PostQueryFilter): Promise<PostRecord[]> {
    return this.model
      .find(buildOwnerFilter(filter))
      .sort({ createdAt: -1 })
      .lean();
  }

  async findById(id: string): Promise<PostRecord | null> {
    return this.model.findById(id).lean();
  }

  async create(data: Partial<PostRecord>): Promise<PostRecord> {
    const doc = await this.model.create(data);
    return doc.toObject() as PostRecord;
  }

  async updateById(
    id: string,
    patch: Partial<PostRecord>,
  ): Promise<PostRecord | null> {
    return this.model
      .findByIdAndUpdate(id, patch, { new: true })
      .lean();
  }

  async incrementCounter(
    id: string,
    field: 'likes' | 'comments',
    delta = 1,
  ): Promise<PostRecord | null> {
    return this.model
      .findByIdAndUpdate(id, { $inc: { [field]: delta } }, { new: true })
      .lean();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async countByOwner(filter: PostQueryFilter): Promise<number> {
    return this.model.countDocuments(buildOwnerFilter(filter));
  }

  async countCompletedByOwner(filter: PostQueryFilter): Promise<number> {
    return this.model.countDocuments({
      ...buildOwnerFilter(filter),
      status: 'completed',
    });
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

  async existsDuplicateBody(
    userId: string,
    body: string,
    activityLegacyId?: number,
  ): Promise<boolean> {
    const normalized = body.trim();
    if (!normalized) return false;

    const query: Record<string, unknown> = {
      userId,
      body: normalized,
    };
    if (activityLegacyId != null) {
      query.activityLegacyId = activityLegacyId;
    }

    const existing = await this.model.findOne(query).select('_id').lean();
    return Boolean(existing);
  }
}
