import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { resolveOwnerFilterFromActor } from '../../../common/utils/owner-filter.util';
import { canViewPersonalInfo } from '../../../common/utils/privacy.util';
import { UserBlockService } from '../../user/user-block.service';
import { UserService } from '../../user/user.service';
import { PostMapper } from '../post.mapper';
import { PostInteractionService } from '../post-interaction.service';
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
    private readonly userBlockService: UserBlockService,
    private readonly postInteraction: PostInteractionService,
  ) {}

  async listPopular(limit = 20, actor: RequestActor) {
    const rows = await this.repository.findPopular(limit);
    return this.mapPostsWithLiked(rows, PostMapper.toHomeFeedItem, actor);
  }

  async listAll(actor: RequestActor) {
    const rows = await this.repository.findAll();
    return this.mapPostsWithLiked(rows, PostMapper.toHomeFeedItem, actor);
  }

  async listByActivity(activityLegacyId: number, actor: RequestActor) {
    const rows = await this.repository.findByActivityLegacyId(activityLegacyId);
    return this.mapPostsWithLiked(rows, PostMapper.toEventDetailItem, actor);
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

    let items = await this.mapPostsWithLiked(
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
        const [anchorItem] = await this.mapPostsWithLiked(
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
    const postIds = rows.map((row) => String(row._id));
    const applicationsByPost =
      await this.postInteraction.listApplicationsGroupedByPostIds(
        postIds,
        actor,
      );

    return rows.map((row) => {
      const postId = String(row._id);
      const applications = applicationsByPost.get(postId) ?? [];
      return PostMapper.toProfileItem(row, applications);
    });
  }

  findPostById(id: string): Promise<PostRecord | null> {
    return this.repository.findById(id);
  }

  findOwnerRecruitingPostForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ) {
    return this.findOwnerRecruitingPostRecord(activityLegacyId, actor).then(
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

  findOwnerRecruitingPostRecord(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<PostRecord | null> {
    return this.repository.findOwnerRecruitingPostForActivity(
      resolveOwnerFilterFromActor(actor),
      activityLegacyId,
    );
  }

  findOwnerRecruitingPostRecordsForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<PostRecord[]> {
    if (!actor.clientUserId?.trim()) return [];
    return this.repository.findOwnerRecruitingPostsForActivity(
      resolveOwnerFilterFromActor(actor),
      activityLegacyId,
    );
  }

  private async mapPostsWithLiked<T extends { userId?: string }>(
    posts: PostRecord[],
    mapper: (post: PostRecord, liked: boolean, appliedByMe: boolean) => T,
    actor: RequestActor,
  ): Promise<T[]> {
    if (!posts.length) return [];

    const visiblePosts = await this.filterPostsForViewer(posts, actor);
    const postIds = visiblePosts.map((post) => String(post._id));
    const [likedIds, appliedIds] = await Promise.all([
      this.postInteraction.findLikedPostIds(actor.resolvedUserId, postIds),
      this.postInteraction.findAppliedPostIds(actor.resolvedUserId, postIds),
    ]);
    const buddyUserIds = await this.userBlockService.loadBuddyUserIds(
      actor.resolvedUserId,
    );

    const mapped = visiblePosts.map((post) => {
      const id = String(post._id);
      return mapper(post, likedIds.has(id), appliedIds.has(id));
    });

    return this.applyPrivacyToFeedItems(
      mapped,
      actor.resolvedUserId,
      buddyUserIds,
    );
  }

  private async filterPostsForViewer(
    posts: PostRecord[],
    actor: RequestActor,
  ): Promise<PostRecord[]> {
    const excluded = await this.userBlockService.getBlockExclusionSet(
      actor.resolvedUserId,
    );
    if (!excluded.size) return posts;
    return posts.filter((post) => !excluded.has(post.userId));
  }

  private async applyPrivacyToFeedItems<
    T extends {
      userId?: string;
      location?: string;
      name?: string;
      handle?: string;
    },
  >(items: T[], viewerUserId: string, buddyUserIds: Set<string>): Promise<T[]> {
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
        buddyUserIds.has(authorId),
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
