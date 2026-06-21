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
import { arePostBodiesSimilar } from './utils/post-body-similarity.util';

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
      })
      .sort({ createdAt: -1 })
      .limit(limit)
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

  async findByOwnerPage(
    filter: PostQueryFilter,
    options: { limit: number; cursor?: PostPageCursor | null },
  ): Promise<PostRecord[]> {
    const query = buildOwnerFilter(filter);
    if (options.cursor) {
      (query as Record<string, unknown>).$or = [
        { createdAt: { $lt: options.cursor.createdAt } },
        {
          createdAt: options.cursor.createdAt,
          _id: { $lt: options.cursor.id },
        },
      ];
    }
    return this.model
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(options.limit)
      .lean();
  }

  async findById(id: string): Promise<PostRecord | null> {
    return this.model.findById(id).lean();
  }

  async findByIds(ids: string[]): Promise<PostRecord[]> {
    if (!ids.length) return [];
    return this.model
      .find({ _id: { $in: ids } })
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(data: Partial<PostRecord>): Promise<PostRecord> {
    const created = await this.model.create(data);
    return created.toObject() as PostRecord;
  }

  async updateById(
    id: string,
    patch: Partial<PostRecord>,
  ): Promise<PostRecord | null> {
    return this.model.findByIdAndUpdate(id, patch, { new: true }).lean();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id });
    return (result.deletedCount ?? 0) > 0;
  }

  async countByOwner(filter: PostQueryFilter): Promise<number> {
    return this.model.countDocuments(buildOwnerFilter(filter));
  }

  async existsDuplicateBody(
    userId: string,
    body: string,
    activityLegacyId?: number,
    excludePostId?: string,
  ): Promise<boolean> {
    const similar = await this.findOwnerSimilarActivePost(
      userId,
      body,
      activityLegacyId,
      excludePostId,
    );
    return similar != null;
  }

  async findOwnerSimilarActivePost(
    userId: string,
    body: string,
    activityLegacyId?: number,
    excludePostId?: string,
  ): Promise<PostRecord | null> {
    const filter: Record<string, unknown> = {
      userId,
      status: { $ne: 'hidden' },
    };
    if (activityLegacyId != null) {
      filter.activityLegacyId = activityLegacyId;
    }
    if (excludePostId) {
      filter._id = { $ne: excludePostId };
    }

    const rows = await this.model.find(filter).sort({ createdAt: -1 }).lean();
    for (const row of rows) {
      if (arePostBodiesSimilar(body, row.body ?? '')) {
        return row;
      }
    }
    return null;
  }

  async existsOwnerActivePostForActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<boolean> {
    const count = await this.model.countDocuments({
      userId,
      activityLegacyId,
      status: { $ne: 'hidden' },
    });
    return count > 0;
  }

  async findOwnerActivePostsForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord[]> {
    return this.model
      .find({
        ...buildOwnerFilter(filter),
        activityLegacyId,
        status: { $ne: 'hidden' },
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOwnerActivePostForActivity(
    filter: PostQueryFilter,
    activityLegacyId: number,
  ): Promise<PostRecord | null> {
    const rows = await this.findOwnerActivePostsForActivity(
      filter,
      activityLegacyId,
    );
    return rows[0] ?? null;
  }

  async countByOwnerAndActivity(
    userId: string,
    activityLegacyId: number,
  ): Promise<number> {
    return this.model.countDocuments({ userId, activityLegacyId });
  }

  async incrementCommentCount(id: string): Promise<PostRecord | null> {
    return this.model
      .findByIdAndUpdate(id, { $inc: { comments: 1 } }, { new: true })
      .lean();
  }

  async decrementCommentCount(
    id: string,
    amount = 1,
  ): Promise<PostRecord | null> {
    const delta = Math.max(1, Math.trunc(amount));
    const post = await this.model.findById(id).lean();
    if (!post) return null;
    const next = Math.max(0, (post.comments ?? 0) - delta);
    return this.model
      .findByIdAndUpdate(id, { comments: next }, { new: true })
      .lean();
  }
}
