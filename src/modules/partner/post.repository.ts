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
import type {
  HotPostPageCursor,
  PostPageCursor,
} from './domain/post-cursor.util';
import { arePostBodiesSimilar } from './utils/post-body-similarity.util';
import { TEAM_POST_FEED_FILTER } from './utils/post-content-type.util';

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
      .find({
        status: { $ne: 'hidden' },
        ...FEED_LISTED_FILTER,
        ...TEAM_POST_FEED_FILTER,
      })
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

  async findShareFeed(options: {
    limit: number;
    sort: 'new' | 'hot';
  }): Promise<PostRecord[]> {
    const filter = {
      status: { $ne: 'hidden' },
      ...FEED_LISTED_FILTER,
      contentTypes: 'share',
    };
    if (options.sort === 'hot') {
      return this.model
        .find(filter)
        .sort({ likes: -1, createdAt: -1 })
        .limit(options.limit)
        .lean();
    }

    return this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .lean();
  }

  async findShareFeedPage(options: {
    limit: number;
    sort: 'new' | 'hot';
    cursor?: PostPageCursor | null;
    hotCursor?: HotPostPageCursor | null;
  }): Promise<PostRecord[]> {
    const baseFilter = {
      status: { $ne: 'hidden' },
      ...FEED_LISTED_FILTER,
      contentTypes: 'share',
    };

    if (options.sort === 'hot') {
      const filter: Record<string, unknown> = { ...baseFilter };
      const hotCursor = options.hotCursor;
      if (hotCursor) {
        filter.$or = [
          { likes: { $lt: hotCursor.likes } },
          {
            likes: hotCursor.likes,
            createdAt: { $lt: hotCursor.createdAt },
          },
          {
            likes: hotCursor.likes,
            createdAt: hotCursor.createdAt,
            _id: { $lt: hotCursor.id },
          },
        ];
      }
      return this.model
        .find(filter)
        .sort({ likes: -1, createdAt: -1, _id: -1 })
        .limit(options.limit)
        .lean();
    }

    const filter: Record<string, unknown> = { ...baseFilter };
    const cursor = options.cursor;
    if (cursor) {
      filter.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        {
          createdAt: cursor.createdAt,
          _id: { $lt: cursor.id },
        },
      ];
    }

    return this.model
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(options.limit)
      .lean();
  }

  async countShareAuthors(): Promise<number> {
    const userIds = await this.model.distinct('userId', {
      status: { $ne: 'hidden' },
      ...FEED_LISTED_FILTER,
      contentTypes: 'share',
      userId: { $exists: true, $nin: [null, ''] },
    });
    return userIds.length;
  }

  async findByActivityLegacyId(
    activityLegacyId: number,
  ): Promise<PostRecord[]> {
    return this.model
      .find({
        activityLegacyId,
        status: { $ne: 'hidden' },
        ...FEED_LISTED_FILTER,
        ...TEAM_POST_FEED_FILTER,
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findRecruitingByActivityForMatch(
    activityLegacyId: number,
  ): Promise<PostRecord[]> {
    return this.model
      .find({
        activityLegacyId,
        status: 'recruiting',
        ...TEAM_POST_FEED_FILTER,
      })
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
      ...TEAM_POST_FEED_FILTER,
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
      .find({ ...buildOwnerFilter(filter), ...TEAM_POST_FEED_FILTER })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findById(id: string): Promise<PostRecord | null> {
    return this.model.findById(id).lean();
  }

  async findByIds(ids: string[]): Promise<PostRecord[]> {
    if (!ids.length) return [];
    return this.model
      .find({ _id: { $in: ids }, status: { $ne: 'hidden' } })
      .lean();
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
      ...TEAM_POST_FEED_FILTER,
    });
  }

  async sumLikesByOwner(filter: PostQueryFilter): Promise<number> {
    const rows = await this.model
      .aggregate<{
        total: number;
      }>([
        { $match: { ...buildOwnerFilter(filter), ...TEAM_POST_FEED_FILTER } },
        { $group: { _id: null, total: { $sum: '$likes' } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  async findOwnerSimilarRecruitingPost(
    userId: string,
    body: string,
    activityLegacyId?: number,
    excludePostId?: string,
  ): Promise<PostRecord | null> {
    const trimmed = body.trim();
    if (!trimmed) return null;

    const query: Record<string, unknown> = {
      userId,
      status: 'recruiting',
    };
    if (activityLegacyId != null) {
      query.activityLegacyId = activityLegacyId;
    }

    const candidates = await this.model
      .find(query)
      .select('_id body status activityLegacyId')
      .sort({ createdAt: -1 })
      .limit(32)
      .lean();

    for (const row of candidates) {
      if (excludePostId && String(row._id) === excludePostId) continue;
      if (arePostBodiesSimilar(trimmed, row.body ?? '')) {
        return row as PostRecord;
      }
    }

    return null;
  }

  async existsDuplicateBody(
    userId: string,
    body: string,
    activityLegacyId?: number,
    excludePostId?: string,
  ): Promise<boolean> {
    const similar = await this.findOwnerSimilarRecruitingPost(
      userId,
      body,
      activityLegacyId,
      excludePostId,
    );
    return Boolean(similar);
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

  async findOwnerRecruitingPostsForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord[]> {
    return this.model
      .find({
        ...buildOwnerFilter(filter),
        activityLegacyId,
        status: 'recruiting',
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOwnerRecruitingPostForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord | null> {
    const rows = await this.findOwnerRecruitingPostsForActivity(
      filter,
      activityLegacyId,
    );
    return rows[0] ?? null;
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
