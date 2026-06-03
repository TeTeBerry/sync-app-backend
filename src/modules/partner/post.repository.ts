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
import type { PostPageCursor } from './domain/post-cursor.util';

function buildOwnerFilter(filter: PostQueryFilter) {
  const base = buildOwnerMongoFilter(filter.userId, filter.authorName);
  if (filter.status) {
    return { ...base, status: filter.status };
  }
  return base;
}

/** Public feeds: legacy posts without the field remain visible. */
const FEED_LISTED_FILTER = { listedInFeed: { $ne: false } } as const;

@Injectable()
export class PostRepository implements IPostRepository {
  constructor(
    @InjectModel(Post.name) private readonly model: Model<PostDocument>,
  ) {}

  async findPopular(limit: number): Promise<PostRecord[]> {
    return this.model
      .find({ status: { $ne: 'hidden' }, ...FEED_LISTED_FILTER })
      .sort({ likes: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async findAll(): Promise<PostRecord[]> {
    return this.model
      .find({ status: { $ne: 'hidden' }, ...FEED_LISTED_FILTER })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByActivityLegacyId(
    activityLegacyId: number,
  ): Promise<PostRecord[]> {
    return this.model
      .find({
        activityLegacyId,
        status: { $ne: 'hidden' },
        ...FEED_LISTED_FILTER,
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findRecruitingByActivityForMatch(
    activityLegacyId: number,
  ): Promise<PostRecord[]> {
    return this.model
      .find({ activityLegacyId, status: 'recruiting' })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findByActivityLegacyIdPage(
    activityLegacyId: number,
    options: { limit: number; cursor?: PostPageCursor | null },
  ): Promise<PostRecord[]> {
    const filter: Record<string, unknown> = {
      activityLegacyId,
      status: { $ne: 'hidden' },
      ...FEED_LISTED_FILTER,
    };
    if (options.cursor) {
      filter.$or = [
        { createdAt: { $lt: options.cursor.createdAt } },
        {
          createdAt: options.cursor.createdAt,
          _id: { $lt: options.cursor.id },
        },
      ];
    }
    return this.model
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(options.limit)
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
    return this.model.findByIdAndUpdate(id, patch, { new: true }).lean();
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
    return (result.deletedCount ?? 0) > 0;
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
      .aggregate<{
        total: number;
      }>([
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

  async existsOwnerRecruitingPostForActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean> {
    const existing = await this.model
      .findOne({ userId, activityLegacyId, status: 'recruiting' })
      .select('_id')
      .lean();
    return Boolean(existing);
  }

  async findOwnerRecruitingPostForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord | null> {
    return this.model
      .findOne({
        ...buildOwnerFilter(filter),
        activityLegacyId,
        status: 'recruiting',
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async existsOwnerRecruitingPostByContentTypes(
    userId: string,
    contentTypes: string[],
  ): Promise<{ exists: boolean; matchedType?: string }> {
    const existing = await this.model
      .findOne({
        userId,
        status: 'recruiting',
        contentTypes: { $in: contentTypes },
      })
      .select('_id contentTypes')
      .lean();

    if (!existing) return { exists: false };

    const matched = contentTypes.find((t) =>
      (existing.contentTypes ?? []).includes(t),
    );
    return { exists: true, matchedType: matched };
  }

  async countByOwnerAndActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<number> {
    return this.model.countDocuments({ userId, activityLegacyId });
  }
}
