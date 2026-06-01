import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  isResourceOwnedByActor,
} from '../../common/auth/actor-query.util';
import { resolveOwnerFilterFromActor } from '../../common/utils/owner-filter.util';
import { sumProfilePostLikes } from '../../common/utils/profile-likes.util';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import { ActivityService } from '../activity/activity.service';
import {
  IPostNotificationPort,
  POST_NOTIFICATION_PORT,
} from './ports/post-notification.port';
import { canViewPersonalInfo } from '../../common/utils/privacy.util';
import { UserBlockService } from '../user/user-block.service';
import { UserService } from '../user/user.service';
import { ChromaService } from '../../ai/rag/chroma.service';
import type { PostStatus } from '../../database/schemas/post.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostMapper } from './post.mapper';
import {
  POST_SEED,
  STORM_ACTIVITY_LEGACY_ID,
  STORM_COMPLETED_DEMO_POST_SEED,
  STORM_DEMO_POST_SEED,
} from './post.seed';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostQueryFilter,
  PostRecord,
} from './interfaces/post.repository.interface';
import { PostWriteService } from './application/post-write.service';
import { PostInteractionService } from './post-interaction.service';
import {
  buildMatchCriteriaPatch,
  inferDepartureCityFromText,
  normalizeCityName,
} from '../../ai/match/buddy-match-criteria.util';
import { PostRecruitmentService } from '../recruitment/application/post-recruitment.service';
import {
  clampActivityPostsLimit,
  decodePostCursor,
  encodePostCursor,
} from './domain/post-cursor.util';

@Injectable()
export class PostService implements OnModuleInit {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    private readonly userService: UserService,
    private readonly userBlockService: UserBlockService,
    private readonly activityService: ActivityService,
    private readonly chromaService: ChromaService,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    private readonly postWriteService: PostWriteService,
    private readonly postInteraction: PostInteractionService,
    private readonly postRecruitmentService: PostRecruitmentService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.postModel.estimatedDocumentCount();
      if (count === 0) {
        const inserted = await this.postModel.insertMany(POST_SEED);
        await this.syncPostEmbeddings(inserted as PostDocument[]);
      }
    } catch (error) {
      this.logger.warn(`Post seed failed: ${(error as Error).message}`);
    }

    try {
      await this.ensureStormDemoPosts();
    } catch (error) {
      this.logger.warn(
        `Storm demo posts init failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.ensureStormCompletedDemoPosts();
    } catch (error) {
      this.logger.warn(
        `Storm completed demo posts init failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.patchStormDemoDepartureCities();
    } catch (error) {
      this.logger.warn(
        `Departure city patch failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.reindexRecruitingEmbeddings();
    } catch (error) {
      this.logger.warn(
        `Recruiting reindex failed: ${(error as Error).message}`,
      );
    }

    try {
      await this.postInteraction.ensureDemoPostComments();
    } catch (error) {
      this.logger.warn(`Demo comment seed failed: ${(error as Error).message}`);
    }
  }

  /** 已有库时补全风暴电音节招募帖，便于测 AI 搭子推荐卡片 */
  private async ensureStormDemoPosts(): Promise<void> {
    const recruitingCount = await this.postModel.countDocuments({
      activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
      status: 'recruiting',
    });
    if (recruitingCount >= 10) {
      return;
    }

    const inserted: PostDocument[] = [];

    for (const seed of STORM_DEMO_POST_SEED) {
      const exists = await this.postModel.exists({
        activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
        userId: seed.userId,
        body: seed.body,
      });
      if (exists) continue;

      const doc = await this.postModel.create(seed);
      inserted.push(doc);
    }

    if (inserted.length) {
      await this.syncPostEmbeddings(inserted);
    }
  }

  /** 已有库时补全风暴电音节「已组队」帖，便于活动详情组队完成态测试 */
  private async ensureStormCompletedDemoPosts(): Promise<void> {
    for (const seed of STORM_COMPLETED_DEMO_POST_SEED) {
      const exists = await this.postModel.exists({
        activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
        userId: seed.userId,
        body: seed.body,
      });
      if (exists) continue;
      await this.postModel.create(seed);
    }
  }

  private async syncPostEmbeddings(posts: PostDocument[]) {
    const recruitingPosts = posts.filter((p) => p.status === 'recruiting');
    if (!recruitingPosts.length) return;

    // 批量并行查询活动，避免 N+1
    const uniqueLegacyIds = [
      ...new Set(
        recruitingPosts
          .map((p) => p.activityLegacyId)
          .filter((id): id is number => id != null),
      ),
    ];
    const activityResults = await Promise.all(
      uniqueLegacyIds.map((id) => this.activityService.findByLegacyId(id)),
    );
    const activityMap = new Map(
      activityResults.filter(Boolean).map((a) => [a!.legacyId, a]),
    );

    // 并行同步向量
    await Promise.all(
      recruitingPosts.map((post) => {
        const activity =
          post.activityLegacyId != null
            ? activityMap.get(post.activityLegacyId)
            : null;
        return this.chromaService.syncPostEmbeddingStatus({
          postId: String(post._id),
          userId: post.userId,
          body: post.body,
          eventTitle: post.eventTitle,
          tags: post.tags,
          location: post.location,
          departureCity: post.departureCity,
          activityCode: activity?.code,
          activityLegacyId: post.activityLegacyId,
          status: post.status,
        });
      }),
    );
  }

  private async patchStormDemoDepartureCities(): Promise<void> {
    for (const seed of STORM_DEMO_POST_SEED) {
      const departureCity =
        seed.departureCity ??
        normalizeCityName(seed.location) ??
        inferDepartureCityFromText(seed.body);
      if (!departureCity) continue;

      await this.postModel.updateMany(
        {
          activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
          userId: seed.userId,
          body: seed.body,
        },
        {
          $set: {
            departureCity,
            matchCriteria: {
              activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
              departureCity,
            },
          },
        },
      );
    }
  }

  private async reindexRecruitingEmbeddings(): Promise<void> {
    const recruiting = await this.postModel
      .find({ status: 'recruiting' })
      .lean();
    await this.postWriteService.reindexRecruitingEmbeddings(
      recruiting as PostRecord[],
      async (legacyId) => {
        if (legacyId == null) return undefined;
        const activity = await this.activityService.findByLegacyId(legacyId);
        return activity?.code;
      },
    );
  }

  private async syncPostEmbeddingForRecord(post: PostRecord): Promise<void> {
    const activity =
      post.activityLegacyId != null
        ? await this.activityService.findByLegacyId(post.activityLegacyId)
        : null;

    await this.chromaService.syncPostEmbeddingStatus({
      postId: String(post._id),
      userId: post.userId,
      body: post.body,
      eventTitle: post.eventTitle,
      tags: post.tags,
      location: post.location,
      departureCity: post.departureCity,
      activityCode: activity?.code,
      activityLegacyId: post.activityLegacyId,
      status: post.status,
    });
  }

  private async findLikedPostIds(
    actorUserId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    return this.postInteraction.findLikedPostIds(actorUserId, postIds);
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

  private async mapPostsWithLiked<
    T extends {
      userId?: string;
      location?: string;
      name?: string;
      handle?: string;
    },
  >(
    posts: PostRecord[],
    mapper: (post: PostRecord, liked: boolean) => T,
    actor: RequestActor,
  ): Promise<T[]> {
    if (!posts.length) return [];

    const visiblePosts = await this.filterPostsForViewer(posts, actor);
    const postIds = visiblePosts.map((post) => String(post._id));
    const likedIds = await this.findLikedPostIds(actor.resolvedUserId, postIds);
    const buddyUserIds = await this.userBlockService.loadBuddyUserIds(
      actor.resolvedUserId,
    );

    const mapped = visiblePosts.map((post) =>
      mapper(post, likedIds.has(String(post._id))),
    );

    return this.applyPrivacyToFeedItems(
      mapped,
      actor.resolvedUserId,
      buddyUserIds,
    );
  }

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
        anchorRecord.status !== 'hidden'
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

  listByOwner(actor: RequestActor) {
    const filter = resolveOwnerFilterFromActor(actor);
    return this.repository
      .findByOwner(filter)
      .then((rows) => rows.map(PostMapper.toProfileItem));
  }

  async findPostById(id: string): Promise<PostRecord | null> {
    return this.repository.findById(id);
  }

  async findOwnerRecruitingPostForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<{
    id: string;
    body: string;
    eventTitle?: string;
    activityLegacyId?: number;
    departureCity?: string;
  } | null> {
    const record = await this.findOwnerRecruitingPostRecord(
      activityLegacyId,
      actor,
    );
    if (!record) return null;
    return {
      id: String(record._id),
      body: record.body ?? '',
      eventTitle: record.eventTitle,
      activityLegacyId: record.activityLegacyId,
      departureCity: record.departureCity,
    };
  }

  async findOwnerRecruitingPostRecord(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<PostRecord | null> {
    return this.repository.findOwnerRecruitingPostForActivity(
      resolveOwnerFilterFromActor(actor),
      activityLegacyId,
    );
  }

  async createPost(
    dto: CreatePostDto,
    actor: RequestActor,
    options?: { skipRiskCheck?: boolean },
  ) {
    return this.postWriteService.createPost(dto, actor, options);
  }

  async hidePostForViolation(
    postId: string,
    reason?: string,
  ): Promise<boolean> {
    const post = await this.repository.findById(postId);
    if (!post || post.status === 'hidden') {
      return false;
    }

    const updated = await this.repository.updateById(postId, {
      status: 'hidden',
    });
    if (!updated) {
      return false;
    }

    void this.chromaService.deprecatePostEmbedding(postId);
    void this.postNotification.notifyPostHidden(
      post.userId,
      postId,
      post.activityLegacyId,
      reason,
    );
    return true;
  }

  async updateOwnedPost(
    id: string,
    dto: UpdatePostDto,
    actor: RequestActor,
  ) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (
      !isResourceOwnedByActor(
        { userId: post.userId, authorName: post.authorName },
        actor,
      )
    ) {
      throw new ForbiddenException('无权编辑该帖子');
    }

    const patch: Partial<Post> = {};
    if (dto.body?.trim()) patch.body = dto.body.trim();
    if (dto.eventTitle?.trim()) patch.eventTitle = dto.eventTitle.trim();
    if (dto.location?.trim()) patch.location = dto.location.trim();
    if (dto.departureCity?.trim())
      patch.departureCity = dto.departureCity.trim();
    if (dto.images) patch.images = dto.images;

    if (dto.body?.trim() || dto.departureCity?.trim() || dto.location?.trim()) {
      const criteriaPatch = buildMatchCriteriaPatch({
        body: (dto.body ?? post.body).trim(),
        tags: post.tags,
        location: dto.location?.trim() ?? post.location,
        departureCity: dto.departureCity?.trim() ?? post.departureCity,
        activityLegacyId: post.activityLegacyId,
      });
      patch.departureCity = criteriaPatch.departureCity;
      patch.matchCriteria = criteriaPatch.matchCriteria;
    }

    if (dto.status === 'completed') {
      const closed = await this.postRecruitmentService.completeRecruitment(
        id,
        'owner_manual',
        post,
      );
      if (!closed) {
        throw new NotFoundException('帖子不存在');
      }
      return PostMapper.toProfileItem(closed);
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('没有可更新的字段');
    }

    const updated = await this.repository.updateById(id, patch);
    if (!updated) {
      throw new NotFoundException('帖子不存在');
    }

    this.postWriteService.scheduleEmbeddingSyncForRecord(updated);

    return PostMapper.toProfileItem(updated);
  }

  acceptPostApplication(
    postId: string,
    applicantUserId: string,
    owner?: RequestActor,
  ) {
    return this.postInteraction.acceptPostApplication(
      postId,
      applicantUserId,
      owner,
    );
  }

  likePost(id: string, actor: RequestActor) {
    return this.postInteraction.likePost(id, actor);
  }

  applyToPost(id: string, actor: RequestActor) {
    return this.postInteraction.applyToPost(id, actor);
  }

  listComments(id: string) {
    return this.postInteraction.listComments(id);
  }

  addComment(
    id: string,
    body: string,
    actor: RequestActor,
    parentCommentId?: string,
  ) {
    return this.postInteraction.addComment(
      id,
      body,
      actor,
      parentCommentId,
    );
  }

  async deleteOwnedPost(id: string, actor: RequestActor) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const isOwner = isResourceOwnedByActor(
      { userId: post.userId, authorName: post.authorName },
      actor,
    );

    if (!isOwner) {
      throw new ForbiddenException('无权删除该帖子');
    }

    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw new NotFoundException('帖子不存在');
    }

    await Promise.all([
      this.postInteraction.deleteInteractionsForPost(id),
      Promise.resolve(this.postWriteService.deprecateEmbedding(id)),
    ]);

    return { ok: true as const };
  }

  countByOwner(actor: RequestActor) {
    return this.repository.countByOwner(resolveOwnerFilterFromActor(actor));
  }

  countCompletedByOwner(actor: RequestActor) {
    return this.repository.countCompletedByOwner(
      resolveOwnerFilterFromActor(actor),
    );
  }

  async sumLikesByOwner(actor: RequestActor) {
    const rows = await this.repository.findByOwner(
      resolveOwnerFilterFromActor(actor),
    );
    return sumProfilePostLikes(rows);
  }
}
