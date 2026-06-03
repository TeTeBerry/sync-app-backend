import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { isResourceOwnedByActor } from '../../common/auth/actor-query.util';
import { resolveOwnerFilterFromActor } from '../../common/utils/owner-filter.util';
import {
  isTeamChatExpired,
  buildTeamChatRetentionFields,
} from '../../common/utils/team-chat-retention.util';
import {
  PostApplication,
  PostApplicationDocument,
} from '../../database/schemas/post-application.schema';
import {
  PostApplicationMessage,
  PostApplicationMessageDocument,
} from '../../database/schemas/post-application-message.schema';
import {
  PostApplicationThreadRead,
  PostApplicationThreadReadDocument,
} from '../../database/schemas/post-application-thread-read.schema';
import { ActivityService } from '../activity/activity.service';
import { UserService } from '../user/user.service';
import type { PostBuddyPreviewDto } from './dto/post-buddy-preview.dto';
import { pickBestMatchingPostRecord } from './utils/buddy-post-match.util';
import type { TeamChatMessageDto } from './dto/team-chat-message.dto';
import type { TeamChatSessionDto } from './dto/team-chat-session.dto';
import { PostMapper } from './post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
} from './interfaces/post.repository.interface';
import { PostRecord } from './interfaces/post.repository.interface';
import { Inject } from '@nestjs/common';

const DEFAULT_APPLY_MESSAGE = '你好，我想加入你的组队～';

const TEAM_CHAT_SESSION_SEP = '__';

export function buildTeamChatSessionId(
  postId: string,
  applicantUserId: string,
): string {
  return `chat${TEAM_CHAT_SESSION_SEP}${encodeURIComponent(postId.trim())}${TEAM_CHAT_SESSION_SEP}${encodeURIComponent(applicantUserId.trim())}`;
}

@Injectable()
export class TeamChatService {
  private readonly logger = new Logger(TeamChatService.name);
  private lastGlobalPurgeAt = 0;
  private static readonly GLOBAL_PURGE_INTERVAL_MS = 60_000;
  private static readonly GLOBAL_PURGE_BATCH = 500;

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    @InjectModel(PostApplication.name)
    private readonly applicationModel: Model<PostApplicationDocument>,
    @InjectModel(PostApplicationMessage.name)
    private readonly messageModel: Model<PostApplicationMessageDocument>,
    @InjectModel(PostApplicationThreadRead.name)
    private readonly threadReadModel: Model<PostApplicationThreadReadDocument>,
    private readonly userService: UserService,
    private readonly activityService: ActivityService,
  ) {}

  async createInitialMessageOnApply(
    postId: string,
    applicantUserId: string,
    message?: string,
  ): Promise<void> {
    const body = message?.trim() || DEFAULT_APPLY_MESSAGE;
    try {
      await this.messageModel.create({
        postId,
        applicantUserId: applicantUserId.trim(),
        senderUserId: applicantUserId.trim(),
        body,
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) {
        throw error;
      }
    }
  }

  async listSessions(actor: RequestActor): Promise<TeamChatSessionDto[]> {
    await this.purgeExpiredTeamChatMessagesGlobal();

    const actorUserId = actor.resolvedUserId;
    const [asApplicant, ownedPosts] = await Promise.all([
      this.applicationModel
        .find({ userId: actorUserId })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean(),
      this.repository.findByOwner(resolveOwnerFilterFromActor(actor)),
    ]);

    const ownedPostIds = new Set(ownedPosts.map((row) => String(row._id)));
    const ownerApplications =
      ownedPostIds.size > 0
        ? await this.applicationModel
            .find({ postId: { $in: [...ownedPostIds] } })
            .sort({ createdAt: -1 })
            .lean()
        : [];

    const threadKeys = new Map<
      string,
      { postId: string; applicantUserId: string; isOwner: boolean }
    >();

    for (const row of asApplicant) {
      const key = `${row.postId}:${row.userId}`;
      threadKeys.set(key, {
        postId: row.postId,
        applicantUserId: row.userId,
        isOwner: false,
      });
    }

    for (const row of ownerApplications) {
      const key = `${row.postId}:${row.userId}`;
      threadKeys.set(key, {
        postId: row.postId,
        applicantUserId: row.userId,
        isOwner: true,
      });
    }

    await this.purgeExpiredThreadsForKeys(
      [...threadKeys.values()].map((thread) => ({
        postId: thread.postId,
        applicantUserId: thread.applicantUserId,
      })),
    );

    const sessions = await Promise.all(
      [...threadKeys.values()].map((thread) =>
        this.buildSessionDto(
          thread.postId,
          thread.applicantUserId,
          actor,
          thread.isOwner,
        ),
      ),
    );

    return sessions
      .filter((session): session is TeamChatSessionDto => session != null)
      .filter((session) => !isTeamChatExpired(session.destroysAt))
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
  }

  /** Post owner opens chat from profile posts ("沟通"); applicant cannot open. */
  async openChatByOwner(
    postId: string,
    applicantUserId: string,
    actor: RequestActor,
  ): Promise<TeamChatSessionDto> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }
    if (
      !isResourceOwnedByActor(
        { userId: post.userId, authorName: post.authorName },
        actor,
      )
    ) {
      throw new ForbiddenException('仅发帖人可发起沟通');
    }

    const trimmedApplicant = applicantUserId.trim();
    const application = await this.applicationModel
      .findOne({ postId, userId: trimmedApplicant })
      .lean();
    if (!application) {
      throw new NotFoundException('申请不存在');
    }

    if (!application.ownerOpenedChatAt) {
      const now = new Date();
      await this.applicationModel.updateOne(
        { postId, userId: trimmedApplicant },
        { $set: { ownerOpenedChatAt: now } },
      );
      const hasMessages = await this.messageModel.exists({
        postId,
        applicantUserId: trimmedApplicant,
      });
      if (!hasMessages) {
        await this.createInitialMessageOnApply(
          postId,
          trimmedApplicant,
          application.message,
        );
      }
    }

    const session = await this.buildSessionDto(
      postId,
      trimmedApplicant,
      actor,
      true,
    );
    if (!session) {
      throw new NotFoundException('无法创建会话');
    }
    return session;
  }

  async markThreadRead(
    postId: string,
    applicantUserId: string,
    actor: RequestActor,
  ): Promise<{ ok: true; unreadCount: 0 }> {
    await this.assertThreadParticipant(postId, applicantUserId, actor);
    await this.assertChatOpened(postId, applicantUserId);
    const now = new Date();
    await this.threadReadModel.updateOne(
      {
        postId,
        applicantUserId: applicantUserId.trim(),
        userId: actor.resolvedUserId,
      },
      { $set: { lastReadAt: now } },
      { upsert: true },
    );
    return { ok: true, unreadCount: 0 };
  }

  async listMessages(
    postId: string,
    applicantUserId: string,
    actor: RequestActor,
  ): Promise<TeamChatMessageDto[]> {
    const ctx = await this.assertThreadParticipant(
      postId,
      applicantUserId,
      actor,
    );
    await this.assertChatOpened(postId, applicantUserId);
    if (isTeamChatExpired(ctx.retention.destroysAt)) {
      await this.deleteThreadMessages(postId, applicantUserId);
      throw new BadRequestException('临时会话已过期');
    }

    const rows = await this.messageModel
      .find({ postId, applicantUserId: applicantUserId.trim() })
      .sort({ createdAt: 1 })
      .lean();

    const actorUserId = actor.resolvedUserId;
    return rows.map((row) => ({
      id: String(row._id),
      senderUserId: row.senderUserId,
      body: row.body,
      createdAt:
        row.createdAt != null
          ? new Date(row.createdAt).toISOString()
          : new Date().toISOString(),
      role: row.senderUserId === actorUserId ? 'me' : 'peer',
    }));
  }

  async sendMessage(
    postId: string,
    applicantUserId: string,
    body: string,
    actor: RequestActor,
  ): Promise<TeamChatMessageDto> {
    const trimmed = body.trim();
    if (!trimmed) {
      throw new BadRequestException('消息不能为空');
    }

    const ctx = await this.assertThreadParticipant(
      postId,
      applicantUserId,
      actor,
    );
    await this.assertChatOpened(postId, applicantUserId);
    if (isTeamChatExpired(ctx.retention.destroysAt)) {
      await this.deleteThreadMessages(postId, applicantUserId);
      throw new BadRequestException('临时会话已过期');
    }

    const doc = await this.messageModel.create({
      postId,
      applicantUserId: applicantUserId.trim(),
      senderUserId: actor.resolvedUserId,
      body: trimmed,
    });

    return {
      id: String(doc._id),
      senderUserId: doc.senderUserId,
      body: doc.body,
      createdAt: (doc.createdAt ?? new Date()).toISOString(),
      role: 'me',
    };
  }

  private async buildSessionDto(
    postId: string,
    applicantUserId: string,
    actor: RequestActor,
    isOwner: boolean,
  ): Promise<TeamChatSessionDto | null> {
    const post = await this.repository.findById(postId);
    if (!post) return null;

    const application = await this.applicationModel
      .findOne({ postId, userId: applicantUserId.trim() })
      .lean();
    if (!application) return null;

    if (
      !(await this.isThreadChatOpened(application, postId, applicantUserId))
    ) {
      return null;
    }

    const actorUserId = actor.resolvedUserId;
    const ownerMatch = isResourceOwnedByActor(
      { userId: post.userId, authorName: post.authorName },
      actor,
    );
    const isApplicant = applicantUserId.trim() === actorUserId;
    if (!ownerMatch && !isApplicant) return null;

    const retention = await this.resolveRetention(post);
    const lastMessage = await this.messageModel
      .findOne({ postId, applicantUserId: applicantUserId.trim() })
      .sort({ createdAt: -1 })
      .lean();

    const peerUserId = isOwner ? applicantUserId.trim() : post.userId;
    const peerProfile = await this.userService.resolveProfileFromStoredAuthor({
      userId: peerUserId,
      authorName: isOwner ? application.authorName : post.authorName,
    });

    const buddyPreview = await this.resolvePeerBuddyPreview(
      post,
      applicantUserId.trim(),
      isOwner,
    );

    const lastBody =
      lastMessage?.body?.trim() ||
      application.message?.trim() ||
      DEFAULT_APPLY_MESSAGE;
    const lastAt =
      lastMessage?.createdAt != null
        ? new Date(lastMessage.createdAt).toISOString()
        : application.createdAt != null
          ? new Date(application.createdAt).toISOString()
          : new Date().toISOString();

    const unreadCount = await this.countUnreadForThread(
      postId,
      applicantUserId,
      actor.resolvedUserId,
    );

    return {
      sessionId: buildTeamChatSessionId(postId, applicantUserId),
      postId,
      applicantUserId: applicantUserId.trim(),
      postTitle: post.eventTitle,
      ...retention,
      peerUserId,
      peerName:
        peerProfile?.name ??
        (isOwner ? application.authorName?.trim() : post.authorName?.trim()) ??
        '用户',
      peerAvatar: peerProfile?.avatar,
      buddyPreview,
      lastMessage: lastBody,
      lastMessageAt: lastAt,
      unreadCount,
      applicationStatus: application.status,
      postRecruitmentStatus: PostMapper.toStatusLabel(post.status),
      isOwner,
    };
  }

  private async countUnreadForThread(
    postId: string,
    applicantUserId: string,
    actorUserId: string,
  ): Promise<number> {
    const read = await this.threadReadModel
      .findOne({
        postId,
        applicantUserId: applicantUserId.trim(),
        userId: actorUserId,
      })
      .lean();

    const filter: Record<string, unknown> = {
      postId,
      applicantUserId: applicantUserId.trim(),
      senderUserId: { $ne: actorUserId },
    };
    if (read?.lastReadAt) {
      filter.createdAt = { $gt: read.lastReadAt };
    }

    return this.messageModel.countDocuments(filter);
  }

  private async resolvePeerBuddyPreview(
    targetPost: PostRecord,
    applicantUserId: string,
    viewerIsOwner: boolean,
  ): Promise<PostBuddyPreviewDto> {
    if (viewerIsOwner) {
      const recruiting = await this.findBestRecruitingPostForUser(
        applicantUserId,
        targetPost,
      );
      if (recruiting) {
        return PostMapper.toBuddyPreview(recruiting);
      }
      return {
        body: '想一起组队参加活动，期待与你同行～',
        tags: ['#组队'],
      };
    }

    return PostMapper.toBuddyPreview(targetPost);
  }

  private async findBestRecruitingPostForUser(
    userId: string,
    targetPost: PostRecord,
  ): Promise<PostRecord | null> {
    const activityLegacyId = targetPost.activityLegacyId;
    if (activityLegacyId == null) return null;
    const candidates =
      await this.repository.findOwnerRecruitingPostsForActivity(
        { userId },
        activityLegacyId,
      );
    return pickBestMatchingPostRecord(targetPost, candidates);
  }

  private async resolveRetention(post: PostRecord): Promise<{
    activityLegacyId?: number;
    activityEndAt?: string;
    destroysAt?: string;
  }> {
    const legacyId = post.activityLegacyId;
    if (legacyId == null) return {};
    try {
      const activity = await this.activityService.findByLegacyId(legacyId);
      return buildTeamChatRetentionFields(
        activity?.date,
        activity?.name,
        legacyId,
      );
    } catch {
      return buildTeamChatRetentionFields(undefined, undefined, legacyId);
    }
  }

  private async isThreadChatOpened(
    application: { ownerOpenedChatAt?: Date },
    postId: string,
    applicantUserId: string,
  ): Promise<boolean> {
    if (application.ownerOpenedChatAt) return true;
    const exists = await this.messageModel.exists({
      postId,
      applicantUserId: applicantUserId.trim(),
    });
    return Boolean(exists);
  }

  private async assertChatOpened(
    postId: string,
    applicantUserId: string,
  ): Promise<void> {
    const application = await this.applicationModel
      .findOne({ postId, userId: applicantUserId.trim() })
      .lean();
    if (!application) {
      throw new NotFoundException('申请不存在');
    }
    if (
      !(await this.isThreadChatOpened(application, postId, applicantUserId))
    ) {
      throw new ForbiddenException('帖主尚未发起沟通');
    }
  }

  private async assertThreadParticipant(
    postId: string,
    applicantUserId: string,
    actor: RequestActor,
  ): Promise<{
    post: PostRecord;
    application: { status: string; message?: string; ownerOpenedChatAt?: Date };
    retention: { destroysAt?: string };
  }> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const application = await this.applicationModel
      .findOne({ postId, userId: applicantUserId.trim() })
      .lean();
    if (!application) {
      throw new NotFoundException('申请不存在');
    }

    const actorUserId = actor.resolvedUserId;
    const isOwner = isResourceOwnedByActor(
      { userId: post.userId, authorName: post.authorName },
      actor,
    );
    const isApplicant = applicantUserId.trim() === actorUserId;
    if (!isOwner && !isApplicant) {
      throw new ForbiddenException('无权访问该会话');
    }

    const retention = await this.resolveRetention(post);
    return { post, application, retention };
  }

  private threadKey(postId: string, applicantUserId: string): string {
    return `${postId}:${applicantUserId.trim()}`;
  }

  private async deleteThreadMessages(
    postId: string,
    applicantUserId: string,
  ): Promise<void> {
    await this.messageModel.deleteMany({
      postId,
      applicantUserId: applicantUserId.trim(),
    });
  }

  /** Remove message rows for threads past destroysAt. */
  async purgeExpiredThreadsForKeys(
    keys: Array<{ postId: string; applicantUserId: string }>,
  ): Promise<number> {
    if (!keys.length) return 0;

    const unique = new Map<
      string,
      { postId: string; applicantUserId: string }
    >();
    for (const key of keys) {
      const applicantUserId = key.applicantUserId?.trim();
      const postId = key.postId?.trim();
      if (!postId || !applicantUserId) continue;
      unique.set(this.threadKey(postId, applicantUserId), {
        postId,
        applicantUserId,
      });
    }
    if (!unique.size) return 0;

    const postIds = [...new Set([...unique.values()].map((k) => k.postId))];
    const postById = new Map<string, PostRecord>();
    await Promise.all(
      postIds.map(async (id) => {
        const post = await this.repository.findById(id);
        if (post) postById.set(id, post);
      }),
    );

    const expired = (
      await Promise.all(
        [...unique.values()].map(async (key) => {
          const post = postById.get(key.postId);
          if (!post) return null;
          const retention = await this.resolveRetention(post);
          return isTeamChatExpired(retention.destroysAt) ? key : null;
        }),
      )
    ).filter(
      (key): key is { postId: string; applicantUserId: string } => key != null,
    );

    if (!expired.length) return 0;

    const result = await this.messageModel.deleteMany({
      $or: expired.map((key) => ({
        postId: key.postId,
        applicantUserId: key.applicantUserId,
      })),
    });

    if (result.deletedCount > 0) {
      this.logger.log(
        `Purged ${result.deletedCount} expired team-chat message(s) across ${expired.length} thread(s)`,
      );
    }

    return expired.length;
  }

  /** Throttled scan of message threads (housekeeping for inactive users). */
  private async purgeExpiredTeamChatMessagesGlobal(): Promise<void> {
    const now = Date.now();
    if (
      now - this.lastGlobalPurgeAt <
      TeamChatService.GLOBAL_PURGE_INTERVAL_MS
    ) {
      return;
    }
    this.lastGlobalPurgeAt = now;

    const rows = await this.messageModel.aggregate<{
      _id: { postId: string; applicantUserId: string };
    }>([
      {
        $group: {
          _id: { postId: '$postId', applicantUserId: '$applicantUserId' },
        },
      },
      { $limit: TeamChatService.GLOBAL_PURGE_BATCH },
    ]);

    const keys = rows
      .map((row) => ({
        postId: row._id?.postId,
        applicantUserId: row._id?.applicantUserId,
      }))
      .filter((key): key is { postId: string; applicantUserId: string } =>
        Boolean(key.postId?.trim() && key.applicantUserId?.trim()),
      );

    await this.purgeExpiredThreadsForKeys(keys);
  }

  async loadBuddyPreviewsForApplicants(
    applicantUserIds: string[],
    targetPost: PostRecord,
  ): Promise<Map<string, PostBuddyPreviewDto>> {
    const map = new Map<string, PostBuddyPreviewDto>();
    if (!applicantUserIds.length || targetPost.activityLegacyId == null) {
      return map;
    }

    const uniqueIds = [...new Set(applicantUserIds.map((id) => id.trim()))];
    await Promise.all(
      uniqueIds.map(async (userId) => {
        const post = await this.findBestRecruitingPostForUser(
          userId,
          targetPost,
        );
        if (post) {
          map.set(userId, PostMapper.toBuddyPreview(post));
        }
      }),
    );
    return map;
  }
}
