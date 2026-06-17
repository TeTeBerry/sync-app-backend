import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { resolveOwnerFilterFromActor } from '../../../common/utils/owner-filter.util';
import { canViewPersonalInfo } from '../../../common/utils/privacy.util';
import { UserService } from '../../user/user.service';
import { PostMapper } from '../post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from '../interfaces/post.repository.interface';
import {
  clampActivityPostsLimit,
  decodePostCursor,
  encodePostCursor,
} from '../domain/post-cursor.util';

/** Read-side post queries (lists, enrichment, owner lookups). */
@Injectable()
export class PostQueryService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    private readonly userService: UserService,
  ) {}

  async listPopular(limit = 20, actor: RequestActor) {
    const rows = await this.repository.findPopular(limit);
    return this.mapPosts(rows, PostMapper.toHomeFeedItem, actor);
  }

  async listByActivity(activityLegacyId: number, actor: RequestActor) {
    const rows = await this.repository.findByActivityLegacyId(activityLegacyId);
    return this.mapPosts(rows, PostMapper.toEventDetailItem, actor);
  }

  async listByActivityPage(
    activityLegacyId: number,
    options: {
      limit?: number;
      cursor?: string;
      anchorPostId?: string;
    },
    actor: RequestActor,
  ) {
    const limit = clampActivityPostsLimit(options.limit);
    const decodedCursor = options.cursor
      ? decodePostCursor(options.cursor)
      : null;
    if (options.cursor && !decodedCursor) {
      throw new BadRequestException('无效的分页游标');
    }

    const rows = await this.repository.findByActivityLegacyIdPage(
      activityLegacyId,
      { limit: limit + 1, cursor: decodedCursor },
    );
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    let items = await this.mapPosts(
      pageRows,
      PostMapper.toEventDetailItem,
      actor,
    );

    const anchorId = options.anchorPostId?.trim();
    if (anchorId && !items.some((post) => post.id === anchorId)) {
      const anchorRecord = await this.repository.findById(anchorId);
      if (
        anchorRecord &&
        anchorRecord.activityLegacyId === activityLegacyId &&
        anchorRecord.status !== 'hidden' &&
        anchorRecord.listedInFeed !== false
      ) {
        const [anchorItem] = await this.mapPosts(
          [anchorRecord],
          PostMapper.toEventDetailItem,
          actor,
        );
        if (anchorItem) {
          items = [anchorItem, ...items.filter((post) => post.id !== anchorId)];
        }
      }
    }

    const nextCursor =
      hasMore && pageRows.length > 0
        ? encodePostCursor(pageRows[pageRows.length - 1])
        : undefined;

    return { items, nextCursor, hasMore };
  }

  async listByOwner(actor: RequestActor) {
    const filter = resolveOwnerFilterFromActor(actor);
    const rows = await this.repository.findByOwner(filter);
    return rows.map((row) => PostMapper.toProfileItem(row));
  }

  findPostById(id: string): Promise<PostRecord | null> {
    return this.repository.findById(id);
  }

  findOwnerActivePostForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ) {
    return this.findOwnerActivePostRecord(activityLegacyId, actor).then(
      (record) => {
        if (!record) return null;
        return {
          id: String(record._id),
          body: record.body ?? '',
          eventTitle: record.eventTitle,
          activityLegacyId: record.activityLegacyId,
          departureCity: record.departureCity,
        };
      },
    );
  }

  findOwnerActivePostRecord(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<PostRecord | null> {
    return this.repository.findOwnerActivePostForActivity(
      resolveOwnerFilterFromActor(actor),
      activityLegacyId,
    );
  }

  findOwnerActivePostRecordsForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<PostRecord[]> {
    if (!actor.clientUserId?.trim()) return Promise.resolve([]);
    return this.repository.findOwnerActivePostsForActivity(
      resolveOwnerFilterFromActor(actor),
      activityLegacyId,
    );
  }

  mapEventDetailPosts(posts: PostRecord[], actor: RequestActor) {
    return this.mapPosts(posts, PostMapper.toEventDetailItem, actor);
  }

  private async mapPosts<T extends { userId?: string }>(
    posts: PostRecord[],
    mapper: (post: PostRecord) => T,
    actor: RequestActor,
  ): Promise<T[]> {
    if (!posts.length) return [];

    const mapped = posts.map((post) => mapper(post));
    return this.applyPrivacyToFeedItems(mapped, actor.resolvedUserId);
  }

  private async applyPrivacyToFeedItems<
    T extends {
      userId?: string;
      location?: string;
      name?: string;
      handle?: string;
    },
  >(items: T[], viewerUserId: string): Promise<T[]> {
    const authorIds = [
      ...new Set(items.map((item) => item.userId).filter(Boolean) as string[]),
    ];
    if (!authorIds.length) return items;

    const privacyMap =
      await this.userService.findPrivacyLevelsByExternalIds(authorIds);

    return items.map((item) => {
      const authorId = item.userId?.trim();
      if (!authorId || authorId === viewerUserId) return item;

      const canView = canViewPersonalInfo(
        privacyMap.get(authorId),
        false,
        false,
      );
      if (canView) return item;

      return {
        ...item,
        location: '',
        name: '用户',
        handle: '@user',
      };
    });
  }
}
