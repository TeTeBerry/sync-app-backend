import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DEMO_OWNER_USER_ID,
  isDemoOwnerClient,
  isResourceOwnedByClient,
} from '../../common/utils/demo-owner.util';
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

function resolveOwnerFilter(
  userId?: string,
  authorName?: string,
): PostQueryFilter {
  return {
    userId: userId?.trim() || undefined,
    authorName: authorName?.trim() || undefined,
  };
}

function resolveActorUserId(userId?: string, authorName?: string): string {
  const uid = userId?.trim();
  if (isDemoOwnerClient(uid, authorName)) {
    return DEMO_OWNER_USER_ID;
  }
  return uid || DEMO_OWNER_USER_ID;
}

@Injectable()
export class PostService implements OnModuleInit {
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
  ) {}

  async onModuleInit() {
    const count = await this.postModel.estimatedDocumentCount();
    if (count === 0) {
      const inserted = await this.postModel.insertMany(POST_SEED);
      await this.syncPostEmbeddings(inserted);
    }
    await this.ensureStormDemoPosts();
    await this.patchStormDemoDepartureCities();
    await this.reindexRecruitingEmbeddings();
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

  private async syncPostEmbeddings(posts: PostDocument[]) {
    for (const post of posts) {
      if (post.status !== 'recruiting') continue;

      const activity =
        post.activityLegacyId != null
          ? await this.activityService.findByLegacyId(post.activityLegacyId)
          : null;

      await this.chromaService.syncPostEmbeddingStatus({
        postId: String(post._id ?? post.id),
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
      async legacyId => {
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
      postId: String(post._id ?? post.id),
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
    userId?: string,
    authorName?: string,
  ): Promise<PostRecord[]> {
    const actorUserId = resolveActorUserId(userId, authorName);
    const excluded = await this.userBlockService.getBlockExclusionSet(actorUserId);
    if (!excluded.size) return posts;
    return posts.filter(post => !excluded.has(post.userId));
  }

  private async applyPrivacyToFeedItems<T extends {
    userId?: string;
    location?: string;
    name?: string;
    handle?: string;
  }>(
    items: T[],
    viewerUserId: string,
    buddyUserIds: Set<string>,
  ): Promise<T[]> {
    const authorIds = [
      ...new Set(items.map(item => item.userId).filter(Boolean) as string[]),
    ];
    if (!authorIds.length) return items;

    const privacyMap = await this.userService.findPrivacyLevelsByExternalIds(
      authorIds,
    );

    return items.map(item => {
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

  private async mapPostsWithLiked<T extends {
    userId?: string;
    location?: string;
    name?: string;
    handle?: string;
  }>(
    posts: PostRecord[],
    mapper: (post: PostRecord, liked: boolean) => T,
    userId?: string,
    authorName?: string,
  ): Promise<T[]> {
    if (!posts.length) return [];

    const actorUserId = resolveActorUserId(userId, authorName);
    const visiblePosts = await this.filterPostsForViewer(posts, userId, authorName);
    const postIds = visiblePosts.map(post => String(post._id));
    const likedIds = await this.findLikedPostIds(actorUserId, postIds);
    const buddyUserIds = await this.userBlockService.loadBuddyUserIds(actorUserId);

    const mapped = visiblePosts.map(post =>
      mapper(post, likedIds.has(String(post._id))),
    );

    return this.applyPrivacyToFeedItems(mapped, actorUserId, buddyUserIds);
  }

  async listPopular(limit = 20, userId?: string, authorName?: string) {
    const rows = await this.repository.findPopular(limit);
    return this.mapPostsWithLiked(
      rows,
      PostMapper.toHomeFeedItem,
      userId,
      authorName,
    );
  }

  async listAll(userId?: string, authorName?: string) {
    const rows = await this.repository.findAll();
    return this.mapPostsWithLiked(
      rows,
      PostMapper.toHomeFeedItem,
      userId,
      authorName,
    );
  }

  async listByActivity(
    activityLegacyId: number,
    userId?: string,
    authorName?: string,
  ) {
    const rows = await this.repository.findByActivityLegacyId(activityLegacyId);
    return this.mapPostsWithLiked(
      rows,
      PostMapper.toEventDetailItem,
      userId,
      authorName,
    );
  }

  listByOwner(userId?: string, authorName?: string) {
    const filter = resolveOwnerFilter(userId, authorName);
    return this.repository
      .findByOwner(filter)
      .then(rows => rows.map(PostMapper.toProfileItem));
  }

  async findPostById(id: string): Promise<PostRecord | null> {
    return this.repository.findById(id);
  }

  async findOwnerRecruitingPostForActivity(
    activityLegacyId: number,
    userId?: string,
    authorName?: string,
  ): Promise<{
    id: string;
    body: string;
    eventTitle?: string;
    activityLegacyId?: number;
    departureCity?: string;
  } | null> {
    const record = await this.findOwnerRecruitingPostRecord(
      activityLegacyId,
      userId,
      authorName,
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
    userId?: string,
    authorName?: string,
  ): Promise<PostRecord | null> {
    return this.repository.findOwnerRecruitingPostForActivity(
      resolveOwnerFilter(userId, authorName),
      activityLegacyId,
    );
  }

  async createPost(
    dto: CreatePostDto,
    userId?: string,
    authorName?: string,
    options?: { skipRiskCheck?: boolean },
  ) {
    return this.postWriteService.createPost(dto, userId, authorName, options);
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
    userId?: string,
    authorName?: string,
  ) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (
      !isResourceOwnedByClient(
        { userId: post.userId, authorName: post.authorName },
        userId,
        authorName,
      )
    ) {
      throw new ForbiddenException('无权编辑该帖子');
    }

    const patch: Partial<Post> = {};
    if (dto.body?.trim()) patch.body = dto.body.trim();
    if (dto.eventTitle?.trim()) patch.eventTitle = dto.eventTitle.trim();
    if (dto.location?.trim()) patch.location = dto.location.trim();
    if (dto.departureCity?.trim()) patch.departureCity = dto.departureCity.trim();
    if (dto.status) patch.status = dto.status;

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
    ownerUserId?: string,
    ownerAuthorName?: string,
  ) {
    return this.postInteraction.acceptPostApplication(
      postId,
      applicantUserId,
      ownerUserId,
      ownerAuthorName,
    );
  }

  likePost(id: string, userId?: string, authorName?: string) {
    return this.postInteraction.likePost(id, userId, authorName);
  }

  applyToPost(id: string, userId?: string, authorName?: string) {
    return this.postInteraction.applyToPost(id, userId, authorName);
  }

  listComments(id: string) {
    return this.postInteraction.listComments(id);
  }

  addComment(
    id: string,
    body: string,
    userId?: string,
    authorName?: string,
    parentCommentId?: string,
  ) {
    return this.postInteraction.addComment(
      id,
      body,
      userId,
      authorName,
      parentCommentId,
    );
  }

  async deleteOwnedPost(id: string, userId?: string, authorName?: string) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const isOwner = isResourceOwnedByClient(
      { userId: post.userId, authorName: post.authorName },
      userId,
      authorName,
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

  countByOwner(userId?: string, authorName?: string) {
    return this.repository.countByOwner(resolveOwnerFilter(userId, authorName));
  }

  countCompletedByOwner(userId?: string, authorName?: string) {
    return this.repository.countCompletedByOwner(
      resolveOwnerFilter(userId, authorName),
    );
  }

  sumLikesByOwner(userId?: string, authorName?: string) {
    return this.repository.sumLikesByOwner(
      resolveOwnerFilter(userId, authorName),
    );
  }
}
