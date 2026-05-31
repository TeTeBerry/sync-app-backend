import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { resolveActorUserId } from '../../common/auth/actor-user.util';
import {
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
import { Post, PostDocument } from '../../database/schemas/post.schema';
import {
  PostLike,
  PostLikeDocument,
} from '../../database/schemas/post-like.schema';
import {
  IPostModerationPort,
  POST_MODERATION_PORT,
} from './ports/post-moderation.port';
import {
  IPostNotificationPort,
  POST_NOTIFICATION_PORT,
} from './ports/post-notification.port';
import { UserService } from '../user/user.service';
import { PostMapper } from './post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
} from './interfaces/post.repository.interface';
import { PostRecruitmentService } from '../recruitment/application/post-recruitment.service';
import { POST_COMMENT_SEED } from './post-comment.seed';

@Injectable()
export class PostInteractionService {
  private readonly logger = new Logger(PostInteractionService.name);
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(PostLike.name)
    private readonly likeModel: Model<PostLikeDocument>,
    @InjectModel(PostApplication.name)
    private readonly applicationModel: Model<PostApplicationDocument>,
    @InjectModel(PostComment.name)
    private readonly commentModel: Model<PostCommentDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    private readonly userService: UserService,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    @Inject(POST_MODERATION_PORT)
    private readonly postModeration: IPostModerationPort,
    private readonly postRecruitmentService: PostRecruitmentService,
  ) {}

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

    await this.postRecruitmentService.completeRecruitment(
      postId,
      'buddy_teamed',
      post,
    );

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
      await this.likeModel.deleteOne({ userId: actorUserId, postId: id });
      const updated =
        (await this.repository.incrementCounter(id, 'likes', -1)) ?? post;
      return PostMapper.toEventDetailItem(updated, false);
    }

    try {
      await this.likeModel.create({ userId: actorUserId, postId: id });
    } catch {
      return PostMapper.toEventDetailItem(post, true);
    }

    const updated =
      (await this.repository.incrementCounter(id, 'likes')) ?? post;
    void this.postNotification.notifyLike(post, id, actorUserId, authorName);
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

    void this.postNotification.notifyApplication(post, id, actorUserId, authorName);

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

    const topLevelFilter: FilterQuery<PostCommentDocument> = {
      postId: id,
      $or: [
        { parentCommentId: { $exists: false } },
        { parentCommentId: { $type: 'null' } },
      ],
    };
    const topLevel = await this.commentModel
      .find(topLevelFilter)
      .sort({ createdAt: 1 })
      .lean();

    const parentIds = topLevel.map(row => String(row._id));
    const replyRows =
      parentIds.length > 0
        ? await this.commentModel
            .find({ postId: id, parentCommentId: { $in: parentIds } })
            .sort({ createdAt: 1 })
            .lean()
        : [];

    const repliesByParent = new Map<string, typeof replyRows>();
    for (const reply of replyRows) {
      const parentId = reply.parentCommentId ?? '';
      const bucket = repliesByParent.get(parentId) ?? [];
      bucket.push(reply);
      repliesByParent.set(parentId, bucket);
    }

    const items = await Promise.all(
      topLevel.map(async (comment) => {
        const profile = await this.userService.resolveProfile(
          comment.userId,
          comment.authorName,
        );
        const childRows = repliesByParent.get(String(comment._id)) ?? [];
        const replies = await Promise.all(
          childRows.map(async (reply) => {
            const replyProfile = await this.userService.resolveProfile(
              reply.userId,
              reply.authorName,
            );
            return PostMapper.toCommentItem({
              ...reply,
              authorAvatar: replyProfile?.avatar,
            });
          }),
        );
        return {
          ...PostMapper.toCommentItem({
            ...comment,
            authorAvatar: profile?.avatar,
          }),
          ...(replies.length ? { replies } : {}),
        };
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

    const risk = await this.postModeration.assessComment({
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
    let parentComment: {
      _id?: unknown;
      userId: string;
      authorName?: string;
      postId: string;
    } | null = null;

    if (trimmedParentId) {
      parentComment = await this.commentModel.findById(trimmedParentId).lean();
      if (!parentComment || parentComment.postId !== id) {
        throw new BadRequestException('回复的评论不存在');
      }
      if (
        !isResourceOwnedByClient(
          { userId: post.userId, authorName: post.authorName },
          userId,
          authorName,
        )
      ) {
        throw new ForbiddenException('仅发帖人可以回复评论');
      }
      if (
        isResourceOwnedByClient(
          {
            userId: parentComment.userId,
            authorName: parentComment.authorName,
          },
          post.userId,
          post.authorName,
        )
      ) {
        throw new BadRequestException('不能回复自己的评论');
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

    void this.postNotification.notifyComment(
      post,
      id,
      actorUserId,
      authorName,
      preview,
    );

    if (parentComment) {
      void this.postNotification.notifyCommentReply(
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

  /** Idempotent demo replies for seeded posts (matched by body substring). */
  async ensureDemoPostComments(): Promise<void> {
    for (const entry of POST_COMMENT_SEED) {
      try {
        const filter: Record<string, unknown> = {
          body: { $regex: entry.postBodyContains },
        };
        if (entry.activityLegacyId != null) {
          filter.activityLegacyId = entry.activityLegacyId;
        }

        const post = await this.postModel.findOne(filter).lean();
        if (!post?._id) continue;

        const postId = String(post._id);
        let inserted = 0;

        for (const seed of entry.comments) {
          let parentId: string | undefined;
          const parentExists = await this.commentModel.exists({
            postId,
            userId: seed.userId,
            body: seed.body,
          });

          if (parentExists) {
            const existingParent = await this.commentModel
              .findOne({ postId, userId: seed.userId, body: seed.body })
              .select('_id')
              .lean();
            parentId = existingParent?._id
              ? String(existingParent._id)
              : undefined;
          } else {
            const created = await this.commentModel.create({
              postId,
              userId: seed.userId,
              authorName: seed.authorName,
              body: seed.body,
              createdAt: new Date(Date.now() - seed.ageMs),
            });
            parentId = String(created._id);
            inserted += 1;
          }

          if (!parentId || !seed.replies?.length) continue;

          for (const reply of seed.replies) {
            const replyExists = await this.commentModel.exists({
              postId,
              userId: reply.userId,
              body: reply.body,
              parentCommentId: parentId,
            });
            if (replyExists) continue;

            await this.commentModel.create({
              postId,
              userId: reply.userId,
              authorName: reply.authorName,
              body: reply.body,
              parentCommentId: parentId,
              createdAt: new Date(Date.now() - reply.ageMs),
            });
            inserted += 1;
          }
        }

        if (inserted > 0) {
          const count = await this.commentModel.countDocuments({ postId });
          await this.repository.updateById(postId, { comments: count });
        }
      } catch (error) {
        this.logger.warn(
          `Demo comment seed skipped for "${entry.postBodyContains}": ${(error as Error).message}`,
        );
      }
    }
  }

  async deleteInteractionsForPost(postId: string): Promise<void> {
    await Promise.all([
      this.likeModel.deleteMany({ postId }),
      this.applicationModel.deleteMany({ postId }),
      this.commentModel.deleteMany({ postId }),
    ]);
  }

  async findLikedPostIds(
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
}
