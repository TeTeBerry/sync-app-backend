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
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  isResourceOwnedByActor,
  toRequestActor,
} from '../../common/auth/actor-query.util';
import { isDemoSeedEnabled } from '../../common/utils/seed-policy.util';
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
import { AccountRiskService } from '../account-risk/account-risk.service';
import { UserService } from '../user/user.service';
import {
  clampCommentPageLimit,
  commentCursorFilter,
  decodeCommentCursor,
  encodeCommentCursor,
} from './domain/comment-cursor.util';
import { PostMapper } from './post.mapper';
import { toPostMutationResponse } from './utils/post-mutation-response.util';
import {
  IPostRepository,
  POST_REPOSITORY,
} from './interfaces/post.repository.interface';
import { POST_COMMENT_SEED } from './post-comment.seed';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import {
  PostApplicationMessage,
  PostApplicationMessageDocument,
} from '../../database/schemas/post-application-message.schema';

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
    @InjectModel(PostApplicationMessage.name)
    private readonly applicationMessageModel: Model<PostApplicationMessageDocument>,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,
    private readonly userService: UserService,
    private readonly accountRisk: AccountRiskService,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    @Inject(POST_MODERATION_PORT)
    private readonly postModeration: IPostModerationPort,
    private readonly wechatContentSecurity: WechatContentSecurityService,
  ) {}

  async likePost(id: string, actor: RequestActor) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const actorUserId = actor.resolvedUserId;
    const existing = await this.likeModel
      .findOne({ userId: actorUserId, postId: id })
      .lean();

    if (existing) {
      await this.likeModel.deleteOne({ userId: actorUserId, postId: id });
      const updated =
        (await this.repository.incrementCounter(id, 'likes', -1)) ?? post;
      return toPostMutationResponse(updated, false);
    }

    try {
      await this.likeModel.create({ userId: actorUserId, postId: id });
    } catch {
      return toPostMutationResponse(post, true);
    }

    const updated =
      (await this.repository.incrementCounter(id, 'likes')) ?? post;
    void this.postNotification.notifyLike(
      post,
      id,
      actorUserId,
      actor.displayName,
    );
    return toPostMutationResponse(updated, true);
  }

  async listComments(
    id: string,
    options?: { limit?: number; cursor?: string },
  ) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }
    if (post.status === 'hidden') {
      throw new NotFoundException('帖子不存在');
    }

    const limit = clampCommentPageLimit(options?.limit);
    const decodedCursor = options?.cursor
      ? decodeCommentCursor(options.cursor)
      : null;
    if (options?.cursor && !decodedCursor) {
      throw new BadRequestException('无效的分页游标');
    }

    const topLevelFilter: FilterQuery<PostCommentDocument> = {
      postId: id,
      $or: [
        { parentCommentId: { $exists: false } },
        { parentCommentId: { $type: 'null' } },
      ],
      ...(decodedCursor ? commentCursorFilter(decodedCursor) : {}),
    };

    const topLevel = await this.commentModel
      .find(topLevelFilter)
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit + 1)
      .lean();

    const hasMore = topLevel.length > limit;
    const pageRows = hasMore ? topLevel.slice(0, limit) : topLevel;

    const parentIds = pageRows.map((row) => String(row._id));
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
      pageRows.map(async (comment) => {
        const profile = await this.userService.resolveProfileFromStoredAuthor({
          userId: comment.userId,
          authorName: comment.authorName,
        });
        const childRows = repliesByParent.get(String(comment._id)) ?? [];
        const replies = await Promise.all(
          childRows.map(async (reply) => {
            const replyProfile =
              await this.userService.resolveProfileFromStoredAuthor({
                userId: reply.userId,
                authorName: reply.authorName,
              });
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

    const last = pageRows[pageRows.length - 1] as
      | ((typeof pageRows)[number] & { createdAt?: Date })
      | undefined;
    const nextCursor =
      hasMore && last?._id
        ? encodeCommentCursor({
            _id: last._id,
            createdAt: last.createdAt ?? new Date(0),
          })
        : undefined;

    return {
      items,
      hasMore,
      ...(nextCursor ? { nextCursor } : {}),
    };
  }

  async addComment(
    id: string,
    body: string,
    actor: RequestActor,
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

    await this.accountRisk.assertCanPublish(actor);
    await this.wechatContentSecurity.assertTextSafe(trimmed);

    const risk = await this.postModeration.assessComment({
      body: trimmed,
      actor,
      postId: id,
    });
    if (!risk.publishable) {
      void this.accountRisk.recordPublishRiskViolation(actor, risk, {
        source: 'comment_risk',
        refId: id,
      });
      throw new BadRequestException(risk.reason?.trim() || '评论未通过审核');
    }

    const finalBody = risk.sanitizedBody ?? trimmed;

    const actorUserId = actor.resolvedUserId;
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
        !isResourceOwnedByActor(
          { userId: post.userId, authorName: post.authorName },
          actor,
        )
      ) {
        throw new ForbiddenException('仅发帖人可以回复评论');
      }
      if (
        isResourceOwnedByActor(
          {
            userId: parentComment.userId,
            authorName: parentComment.authorName,
          },
          toRequestActor(post.userId, post.authorName),
        )
      ) {
        throw new BadRequestException('不能回复自己的评论');
      }
    }

    await this.commentModel.create({
      userId: actorUserId,
      authorName: actor.displayName?.trim(),
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
      actor.displayName,
      preview,
    );

    if (parentComment) {
      void this.postNotification.notifyCommentReply(
        post,
        id,
        parentComment,
        actorUserId,
        actor.displayName,
        preview,
      );
    }

    const liked = Boolean(
      await this.likeModel.exists({ userId: actorUserId, postId: id }),
    );
    return toPostMutationResponse(updated, liked);
  }

  /** Idempotent demo replies for seeded posts (matched by body substring). */
  async ensureDemoPostComments(): Promise<void> {
    if (!isDemoSeedEnabled()) return;
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
      this.applicationMessageModel.deleteMany({ postId }),
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

    return new Set(rows.map((row) => row.postId));
  }
}
