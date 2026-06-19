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
} from '../../../ai/buddy/ticket-publish-policy.util';
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
import { isCommentByPostOwner } from '../utils/comment-ownership.util';

function resolveCommentRiskReason(risk: RuleMatchResult): string {
  if (risk.violationType === 'traffic_diversion') {
    return COMMENT_CONTACT_FORBIDDEN_MESSAGE;
  }
  return risk.reason?.trim() || '评论未通过审核';
}

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
      const profile = await this.userService.resolveProfile(actor);
      if (!isPostOwnedByActor(post, actor, profile?.name)) {
        throw new ForbiddenException('仅发帖人可以回复评论');
      }
      if (isCommentByPostOwner(parentComment, post)) {
        throw new BadRequestException('不能回复自己的评论');
      }
    }

    await this.commentModel.create({
      userId: actorUserId,
      authorName: actor.displayName?.trim(),
      postId: id,
      parentCommentId: trimmedParentId,
      body: trimmed,
    });

    this.dispatchCommentNotification({
      post,
      postId: id,
      actorUserId,
      actorUserName: actor.displayName?.trim(),
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
