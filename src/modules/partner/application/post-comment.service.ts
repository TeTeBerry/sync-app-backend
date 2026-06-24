import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { isPostOwnedByActor } from '../../../common/auth/actor-query.util';
import {
  assertUserUgcTexts,
  collectCommentUgcTexts,
} from '../../../common/media/user-ugc-text.util';
import {
  PostComment,
  PostCommentDocument,
} from '../../../database/schemas/post-comment.schema';
import {
  isTicketPublishProhibited,
  TICKET_PUBLISH_FORBIDDEN_MESSAGE,
} from '../../../ai/risk/ticket-publish-policy.util';
import {
  COMMENT_CONTACT_FORBIDDEN_MESSAGE,
  matchRiskRules,
  type RuleMatchResult,
} from '../../../ai/risk/risk-rules.util';
import { AccountRiskService } from '../../account-risk/account-risk.service';
import { UserService } from '../../user/user.service';
import {
  clampCommentPageLimit,
  commentCursorFilter,
  decodeCommentCursor,
  encodeCommentCursor,
} from '../domain/comment-cursor.util';
import { PostMapper } from '../post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
} from '../interfaces/post.repository.interface';
import {
  IPostNotificationPort,
  POST_NOTIFICATION_PORT,
} from '../ports/post-notification.port';
import { WechatContentSecurityService } from '../../auth/wechat-content-security.service';
import { assertCommentHasNoContactInfo } from '../utils/post-contact.util';
import {
  isCommentByPostOwner,
  isCommentOwnedByActor,
} from '../utils/comment-ownership.util';

function resolveCommentRiskReason(risk: RuleMatchResult): string {
  if (risk.violationType === 'traffic_diversion') {
    return COMMENT_CONTACT_FORBIDDEN_MESSAGE;
  }
  return risk.reason?.trim() || '评论未通过审核';
}

type CommentListItem = ReturnType<typeof PostMapper.toCommentItem> & {
  replies?: CommentListItem[];
};

@Injectable()
export class PostCommentService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(PostComment.name)
    private readonly commentModel: Model<PostCommentDocument>,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    private readonly accountRisk: AccountRiskService,
    private readonly userService: UserService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
  ) {}

  async listComments(
    id: string,
    options?: { limit?: number; cursor?: string },
  ) {
    const post = await this.repository.findById(id);
    if (!post || post.status === 'hidden') {
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

    const items = pageRows.map((comment) => {
      const childRows = repliesByParent.get(String(comment._id)) ?? [];
      const replies = childRows.map((reply) => PostMapper.toCommentItem(reply));
      return {
        ...PostMapper.toCommentItem(comment),
        ...(replies.length ? { replies } : {}),
      };
    });

    const enrichedItems = await this.enrichCommentItems(items);

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
      items: enrichedItems,
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
    if (!post || post.status === 'hidden') {
      throw new NotFoundException('帖子不存在');
    }

    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('评论内容不能为空');
    }

    await this.accountRisk.assertCanPublish(actor);
    await this.assertCommentBodySafe(trimmed, actor, id);

    const actorUserId = actor.resolvedUserId;
    const trimmedParentId = parentCommentId?.trim();
    const profile = await this.userService.resolveProfile(actor);
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
      if (!isPostOwnedByActor(post, actor, profile?.name)) {
        throw new ForbiddenException('仅发帖人可以回复评论');
      }
      if (isCommentByPostOwner(parentComment, post)) {
        throw new BadRequestException('不能回复自己的评论');
      }
    }

    const authorName =
      profile?.name?.trim() || actor.displayName?.trim() || '用户';
    const authorAvatar = profile?.avatar?.trim() || '';

    await this.commentModel.create({
      userId: actorUserId,
      authorName,
      authorAvatar,
      postId: id,
      parentCommentId: trimmedParentId,
      body: trimmed,
    });

    this.dispatchCommentNotification({
      post,
      postId: id,
      actorUserId,
      actorUserName: authorName,
      commentPreview: trimmed,
      parentComment,
      parentCommentId: trimmedParentId,
    });

    const updated = (await this.repository.incrementCommentCount(id)) ?? post;

    return {
      id,
      comments: updated.comments ?? 0,
    };
  }

  async deleteCommentsForPost(postId: string): Promise<void> {
    await this.commentModel.deleteMany({ postId });
  }

  async deleteOwnedComment(
    postId: string,
    commentId: string,
    actor: RequestActor,
  ) {
    const post = await this.repository.findById(postId);
    if (!post || post.status === 'hidden') {
      throw new NotFoundException('帖子不存在');
    }

    const comment = await this.commentModel.findById(commentId).lean();
    if (!comment || comment.postId !== postId) {
      throw new NotFoundException('评论不存在');
    }

    const profile = await this.userService.resolveProfile(actor);
    if (
      !isCommentOwnedByActor(
        comment,
        actor.resolvedUserId,
        profile?.name ?? actor.displayName,
      )
    ) {
      throw new ForbiddenException('无权删除该评论');
    }

    const commentObjectId = String(comment._id);
    const replyCount = await this.commentModel.countDocuments({
      postId,
      parentCommentId: commentObjectId,
    });
    await this.commentModel.deleteMany({
      postId,
      $or: [{ _id: comment._id }, { parentCommentId: commentObjectId }],
    });

    const removedCount = 1 + replyCount;
    const updated =
      (await this.repository.decrementCommentCount(postId, removedCount)) ??
      post;

    return {
      id: postId,
      comments: updated.comments ?? 0,
    };
  }

  private dispatchCommentNotification(params: {
    post: { userId?: string; activityLegacyId?: number; eventTitle?: string };
    postId: string;
    actorUserId: string;
    actorUserName?: string;
    commentPreview: string;
    parentComment: { userId: string } | null;
    parentCommentId?: string;
  }): void {
    const {
      post,
      postId,
      actorUserId,
      actorUserName,
      commentPreview,
      parentComment,
      parentCommentId,
    } = params;

    const base = {
      postId,
      activityLegacyId: post.activityLegacyId,
      activityTitle: post.eventTitle?.trim(),
      actorUserId,
      actorUserName,
      commentPreview,
    };

    if (parentCommentId && parentComment) {
      const recipientUserId = parentComment.userId?.trim();
      if (!recipientUserId) return;
      this.postNotification.notifyCommentReply({
        ...base,
        recipientUserId,
        parentCommentId,
      });
      return;
    }

    const recipientUserId = post.userId?.trim();
    if (!recipientUserId || recipientUserId === actorUserId) return;
    this.postNotification.notifyComment({
      ...base,
      recipientUserId,
    });
  }

  private async enrichCommentItems(
    items: CommentListItem[],
  ): Promise<CommentListItem[]> {
    const userIds = new Set<string>();
    const collectIds = (rows: CommentListItem[]) => {
      for (const row of rows) {
        const uid = row.userId?.trim();
        if (uid) userIds.add(uid);
        if (row.replies?.length) collectIds(row.replies);
      }
    };
    collectIds(items);

    const summaries = await this.userService.findAuthorSummariesByExternalIds([
      ...userIds,
    ]);

    const apply = (row: CommentListItem): CommentListItem => {
      const summary = summaries.get(row.userId?.trim() ?? '');
      return {
        ...row,
        authorName: summary?.name || row.authorName,
        avatar: summary?.avatar || row.avatar,
        ...(row.replies?.length ? { replies: row.replies.map(apply) } : {}),
      };
    };

    return items.map(apply);
  }

  private async assertCommentBodySafe(
    body: string,
    actor: RequestActor,
    postId: string,
  ): Promise<void> {
    assertCommentHasNoContactInfo(body);

    if (isTicketPublishProhibited({ body })) {
      void this.accountRisk.recordTicketPolicyViolation(
        actor,
        TICKET_PUBLISH_FORBIDDEN_MESSAGE,
      );
      throw new BadRequestException(TICKET_PUBLISH_FORBIDDEN_MESSAGE);
    }

    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectCommentUgcTexts(body),
    );

    const risk = matchRiskRules(body);
    if (risk) {
      void this.accountRisk.recordPublishRiskViolation(actor, risk, {
        source: 'comment_risk',
        refId: postId,
      });
      throw new BadRequestException(resolveCommentRiskReason(risk));
    }
  }
}
