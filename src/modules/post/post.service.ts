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
import {
  PostApplication,
  PostApplicationDocument,
} from '../../database/schemas/post-application.schema';
import {
  PostComment,
  PostCommentDocument,
} from '../../database/schemas/post-comment.schema';
import {
  PostLike,
  PostLikeDocument,
} from '../../database/schemas/post-like.schema';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import { ActivityService } from '../activity/activity.service';
import { NoticeAgent } from '../../ai/agents/notice.agent';
import { UserService } from '../user/user.service';
import { ChromaService } from '../../ai/rag/chroma.service';
import { RiskAgent } from '../../ai/agents/risk.agent';
import type { PostStatus } from '../../database/schemas/post.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostMapper } from './post.mapper';
import { POST_SEED } from './post.seed';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostQueryFilter,
  PostRecord,
} from './interfaces/post.repository.interface';

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
    @InjectModel(PostLike.name)
    private readonly likeModel: Model<PostLikeDocument>,
    @InjectModel(PostApplication.name)
    private readonly applicationModel: Model<PostApplicationDocument>,
    @InjectModel(PostComment.name)
    private readonly commentModel: Model<PostCommentDocument>,
    private readonly userService: UserService,
    private readonly activityService: ActivityService,
    private readonly chromaService: ChromaService,
    private readonly noticeAgent: NoticeAgent,
    private readonly riskAgent: RiskAgent,
  ) {}

  async onModuleInit() {
    const count = await this.postModel.estimatedDocumentCount();
    if (count === 0) {
      const inserted = await this.postModel.insertMany(POST_SEED);
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
        activityCode: activity?.code,
        activityLegacyId: post.activityLegacyId,
        status: post.status,
      });
    }
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
      activityCode: activity?.code,
      activityLegacyId: post.activityLegacyId,
      status: post.status,
    });
  }

  private async findLikedPostIds(
    actorUserId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    if (!postIds.length) return new Set();

    const rows = await this.likeModel
      .find({ userId: actorUserId, postId: { $in: postIds } })
      .select('postId')
      .lean();

    return new Set(rows.map(row => row.postId));
  }

  private async mapPostsWithLiked<T>(
    posts: PostRecord[],
    mapper: (post: PostRecord, liked: boolean) => T,
    userId?: string,
    authorName?: string,
  ): Promise<T[]> {
    if (!posts.length) return [];

    const actorUserId = resolveActorUserId(userId, authorName);
    const postIds = posts.map(post => String(post._id));
    const likedIds = await this.findLikedPostIds(actorUserId, postIds);

    return posts.map(post =>
      mapper(post, likedIds.has(String(post._id))),
    );
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

  async createPost(
    dto: CreatePostDto,
    userId?: string,
    authorName?: string,
    options?: { skipRiskCheck?: boolean },
  ) {
    const profile = await this.userService.resolveProfile(userId, authorName);
    const ownerUserId = resolveActorUserId(userId, authorName);
    const activity =
      dto.activityLegacyId != null
        ? await this.activityService.findByLegacyId(dto.activityLegacyId)
        : null;

    const eventTitle =
      dto.eventTitle?.trim() ||
      activity?.name ||
      '组队帖';

    let status: PostStatus = 'recruiting';
    let rejectionReason: string | undefined;

    if (!options?.skipRiskCheck) {
      const risk = await this.riskAgent.assess({
        body: dto.body.trim(),
        userId,
        activityLegacyId: dto.activityLegacyId ?? activity?.legacyId,
      });
      if (!risk.publishable) {
        status = 'hidden';
        rejectionReason = risk.reason;
      }
    }

    const created = await this.repository.create({
      userId: ownerUserId,
      authorName: profile?.name ?? authorName?.trim() ?? 'Zara Chen',
      authorHandle: profile?.handle,
      authorAvatar: profile?.avatar,
      activityLegacyId: dto.activityLegacyId ?? activity?.legacyId,
      eventTitle,
      location: dto.location?.trim() || profile?.location || activity?.location,
      body: dto.body.trim(),
      tags: dto.tags ?? [],
      status,
      likes: 0,
      comments: 0,
    });

    const postId = String(created._id);

    if (status === 'hidden') {
      void this.noticeAgent.notifyPostHidden(
        ownerUserId,
        postId,
        created.activityLegacyId,
        rejectionReason,
      );
      return PostMapper.toEventDetailItem(created);
    }

    void this.chromaService.syncPostEmbeddingStatus({
      postId,
      userId: ownerUserId,
      body: created.body,
      eventTitle: created.eventTitle,
      tags: created.tags,
      location: created.location,
      activityCode: activity?.code,
      activityLegacyId: created.activityLegacyId,
      status,
    });

    return PostMapper.toEventDetailItem(created);
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
    void this.noticeAgent.notifyPostHidden(
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
    if (dto.status) patch.status = dto.status;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('没有可更新的字段');
    }

    const updated = await this.repository.updateById(id, patch);
    if (!updated) {
      throw new NotFoundException('帖子不存在');
    }

    void this.syncPostEmbeddingForRecord(updated);

    return PostMapper.toProfileItem(updated);
  }

  async acceptPostApplication(
    postId: string,
    applicantUserId: string,
    ownerUserId?: string,
    ownerAuthorName?: string,
  ): Promise<{ ok: true }> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (
      ownerUserId != null &&
      !isResourceOwnedByClient(
        { userId: post.userId, authorName: post.authorName },
        ownerUserId,
        ownerAuthorName,
      )
    ) {
      throw new ForbiddenException('无权处理该帖子的申请');
    }

    const application = await this.applicationModel
      .findOne({ postId, userId: applicantUserId.trim() })
      .lean();
    if (!application) {
      throw new NotFoundException('申请不存在');
    }

    await this.applicationModel.updateOne(
      { postId, userId: applicantUserId.trim() },
      { status: 'accepted' },
    );

    const updated = await this.repository.updateById(postId, {
      status: 'completed',
    });

    if (updated) {
      void this.syncPostEmbeddingForRecord(updated);
    } else {
      void this.chromaService.deprecatePostEmbedding(postId);
    }

    return { ok: true };
  }

  async likePost(id: string, userId?: string, authorName?: string) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const actorUserId = resolveActorUserId(userId, authorName);
    const existing = await this.likeModel
      .findOne({ userId: actorUserId, postId: id })
      .lean();

    if (existing) {
      return PostMapper.toEventDetailItem(post, true);
    }

    try {
      await this.likeModel.create({ userId: actorUserId, postId: id });
    } catch {
      return PostMapper.toEventDetailItem(post, true);
    }

    const updated =
      (await this.repository.incrementCounter(id, 'likes')) ?? post;
    void this.noticeAgent.notifyLike(post, id, actorUserId, authorName);
    return PostMapper.toEventDetailItem(updated, true);
  }

  async applyToPost(id: string, userId?: string, authorName?: string) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const actorUserId = resolveActorUserId(userId, authorName);
    if (
      isResourceOwnedByClient(
        { userId: post.userId, authorName: post.authorName },
        userId,
        authorName,
      )
    ) {
      throw new BadRequestException('不能申请加入自己的帖子');
    }

    const existing = await this.applicationModel
      .findOne({ userId: actorUserId, postId: id })
      .lean();
    if (existing) {
      return { ok: true as const, alreadyApplied: true };
    }

    try {
      await this.applicationModel.create({
        userId: actorUserId,
        authorName: authorName?.trim(),
        postId: id,
        status: 'pending',
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return { ok: true as const, alreadyApplied: true };
      }
      throw error;
    }

    void this.noticeAgent.notifyApplication(post, id, actorUserId, authorName);

    return { ok: true as const, alreadyApplied: false };
  }

  async listComments(id: string) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }
    if (post.status === 'hidden') {
      throw new NotFoundException('帖子不存在');
    }

    const comments = await this.commentModel
      .find({
        postId: id,
        $or: [{ parentCommentId: { $exists: false } }, { parentCommentId: null }],
      })
      .sort({ createdAt: 1 })
      .lean();

    const items = await Promise.all(
      comments.map(async (comment) => {
        const profile = await this.userService.resolveProfile(
          comment.userId,
          comment.authorName,
        );
        return PostMapper.toCommentItem({
          ...comment,
          authorAvatar: profile?.avatar,
        });
      }),
    );

    return items;
  }

  async addComment(
    id: string,
    body: string,
    userId?: string,
    authorName?: string,
    parentCommentId?: string,
  ) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }
    if (post.status === 'hidden') {
      throw new NotFoundException('帖子不存在');
    }

    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('评论内容不能为空');
    }

    const risk = await this.riskAgent.assessComment({
      body: trimmed,
      userId,
      postId: id,
    });
    if (!risk.publishable) {
      throw new BadRequestException(risk.reason?.trim() || '评论未通过审核');
    }

    const finalBody = risk.sanitizedBody ?? trimmed;

    const actorUserId = resolveActorUserId(userId, authorName);
    const trimmedParentId = parentCommentId?.trim();
    let parentComment: { _id?: unknown; userId: string; postId: string } | null = null;

    if (trimmedParentId) {
      parentComment = await this.commentModel.findById(trimmedParentId).lean();
      if (!parentComment || parentComment.postId !== id) {
        throw new BadRequestException('回复的评论不存在');
      }
    }

    await this.commentModel.create({
      userId: actorUserId,
      authorName: authorName?.trim(),
      postId: id,
      parentCommentId: trimmedParentId,
      body: finalBody,
    });

    const updated =
      (await this.repository.incrementCounter(id, 'comments')) ?? post;
    const preview =
      finalBody.length > 40 ? `${finalBody.slice(0, 40)}…` : finalBody;

    void this.noticeAgent.notifyComment(
      post,
      id,
      actorUserId,
      authorName,
      preview,
    );

    if (parentComment) {
      void this.noticeAgent.notifyCommentReply(
        post,
        id,
        parentComment,
        actorUserId,
        authorName,
        preview,
      );
    }

    return PostMapper.toEventDetailItem(updated);
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
      this.likeModel.deleteMany({ postId: id }),
      this.applicationModel.deleteMany({ postId: id }),
      this.commentModel.deleteMany({ postId: id }),
      this.chromaService.deprecatePostEmbedding(id),
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
