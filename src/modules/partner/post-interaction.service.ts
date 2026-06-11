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
import type { PostApplicationItemDto } from './dto/post-application-item.dto';
import type { PostBuddyPreviewDto } from './dto/post-buddy-preview.dto';
import type { ApplyToPostDto } from './dto/apply-to-post.dto';
import {
  buildLightApplyInitialMessage,
  lightApplyToBuddyPreview,
  normalizeLightApplyInput,
} from './light-apply.util';
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
import { PostRecruitmentService } from '../recruitment/application/post-recruitment.service';
import { PostTeamPairService } from './application/post-team-pair.service';
import { ApplicationBuddyPreviewService } from './application/application-buddy-preview.service';
import { POST_COMMENT_SEED } from './post-comment.seed';
import { assertUserUgcTexts } from '../../common/media/user-ugc-text.util';
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
    private readonly buddyPreviewService: ApplicationBuddyPreviewService,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    @Inject(POST_MODERATION_PORT)
    private readonly postModeration: IPostModerationPort,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly postRecruitmentService: PostRecruitmentService,
    private readonly postTeamPairService: PostTeamPairService,
  ) {}

  async acceptPostApplication(
    postId: string,
    applicantUserId: string,
    owner?: RequestActor,
  ): Promise<{ ok: true }> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    if (
      owner != null &&
      !isResourceOwnedByActor(
        { userId: post.userId, authorName: post.authorName },
        owner,
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

    const ownerName =
      owner?.displayName?.trim() || post.authorName?.trim() || '发帖人';
    await this.postTeamPairService.onOwnerAcceptedApplication(
      post,
      applicantUserId,
      ownerName,
    );

    return { ok: true };
  }

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

  async applyToPost(id: string, actor: RequestActor, body?: ApplyToPostDto) {
    const post = await this.repository.findById(id);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const actorUserId = actor.resolvedUserId;
    if (
      isResourceOwnedByActor(
        { userId: post.userId, authorName: post.authorName },
        actor,
      )
    ) {
      throw new BadRequestException('不能申请加入自己的帖子');
    }

    const lightApply = normalizeLightApplyInput(body?.lightApply);
    const note = body?.message?.trim();
    const initialMessagePreview = lightApply
      ? buildLightApplyInitialMessage(lightApply, note)
      : note;
    await assertUserUgcTexts(this.wechatContentSecurity, [
      note,
      lightApply?.departureCity,
      lightApply?.genderPref,
      initialMessagePreview,
    ]);
    const existing = await this.applicationModel
      .findOne({ userId: actorUserId, postId: id })
      .lean();
    if (existing) {
      return { ok: true as const, alreadyApplied: true };
    }

    const initialMessage = initialMessagePreview;

    try {
      await this.applicationModel.create({
        userId: actorUserId,
        authorName: actor.displayName?.trim(),
        postId: id,
        status: 'pending',
        ...(note && !lightApply ? { message: note } : {}),
        ...(lightApply
          ? {
              lightDepartureCity: lightApply.departureCity,
              lightTripDays: lightApply.tripDays,
              lightGenderPref: lightApply.genderPref,
              ...(note ? { message: note } : {}),
            }
          : {}),
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return { ok: true as const, alreadyApplied: true };
      }
      throw error;
    }

    if (lightApply) {
      void this.userService
        .mergeProfileCityIfEmpty(actorUserId, lightApply.departureCity)
        .catch((err) => {
          this.logger.warn({
            msg: 'light_apply_profile_city_merge_failed',
            userId: actorUserId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }

    void this.postNotification.notifyApplication(
      post,
      id,
      actorUserId,
      actor.displayName,
      initialMessage,
    );

    return { ok: true as const, alreadyApplied: false };
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

  async listApplicationsForPost(
    postId: string,
    owner: RequestActor,
  ): Promise<PostApplicationItemDto[]> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }
    if (
      !isResourceOwnedByActor(
        { userId: post.userId, authorName: post.authorName },
        owner,
      )
    ) {
      throw new ForbiddenException('无权查看该帖子的申请');
    }

    const rows = await this.applicationModel
      .find({ postId })
      .sort({ createdAt: -1 })
      .lean();

    return this.mapApplicationRows(rows);
  }

  async listApplicationsGroupedByPostIds(
    postIds: string[],
    owner: RequestActor,
  ): Promise<Map<string, PostApplicationItemDto[]>> {
    const grouped = new Map<string, PostApplicationItemDto[]>();
    if (!postIds.length) return grouped;

    const ownedPostIds: string[] = [];
    const postById = new Map<
      string,
      Awaited<ReturnType<IPostRepository['findById']>>
    >();
    for (const postId of postIds) {
      const post = await this.repository.findById(postId);
      if (
        post &&
        isResourceOwnedByActor(
          { userId: post.userId, authorName: post.authorName },
          owner,
        )
      ) {
        ownedPostIds.push(postId);
        postById.set(postId, post);
        grouped.set(postId, []);
      }
    }

    if (!ownedPostIds.length) return grouped;

    const rows = await this.applicationModel
      .find({ postId: { $in: ownedPostIds } })
      .sort({ createdAt: -1 })
      .lean();

    const previewsByPost = new Map<string, Map<string, PostBuddyPreviewDto>>();
    await Promise.all(
      ownedPostIds.map(async (postId) => {
        const post = postById.get(postId);
        if (!post) return;
        const applicantIds = rows
          .filter((row) => row.postId === postId)
          .map((row) => row.userId);
        const previews =
          await this.buddyPreviewService.loadBuddyPreviewsForApplicants(
            applicantIds,
            post,
          );
        previewsByPost.set(postId, previews);
      }),
    );

    await Promise.all(
      rows.map(async (row) => {
        const buddyPreview = previewsByPost.get(row.postId)?.get(row.userId);
        const item = await this.mapApplicationRow(row, buddyPreview);
        const list = grouped.get(row.postId) ?? [];
        list.push(item);
        grouped.set(row.postId, list);
      }),
    );

    return grouped;
  }

  private async mapApplicationRows(
    rows: Array<{
      _id: { toString(): string } | string;
      userId: string;
      authorName?: string;
      status: 'pending' | 'accepted' | 'rejected';
      message?: string;
      createdAt?: Date | string;
    }>,
  ): Promise<PostApplicationItemDto[]> {
    return Promise.all(rows.map((row) => this.mapApplicationRow(row)));
  }

  private async mapApplicationRow(
    row: {
      _id: { toString(): string } | string;
      userId: string;
      authorName?: string;
      status: 'pending' | 'accepted' | 'rejected';
      message?: string;
      createdAt?: Date | string;
    },
    buddyPreview?: PostBuddyPreviewDto,
  ): Promise<PostApplicationItemDto> {
    const profile = await this.userService.resolveProfileFromStoredAuthor({
      userId: row.userId,
      authorName: row.authorName,
    });
    return PostMapper.toApplicationItem(
      row,
      {
        name: profile?.name,
        avatar: profile?.avatar,
      },
      buddyPreview,
    );
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

  async findAppliedPostIds(
    actorUserId: string,
    postIds: string[],
  ): Promise<Set<string>> {
    if (!postIds.length) return new Set();

    const rows = await this.applicationModel
      .find({ userId: actorUserId, postId: { $in: postIds } })
      .select('postId')
      .lean();

    return new Set(rows.map((row) => row.postId));
  }
}
