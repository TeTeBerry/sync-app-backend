import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { ActivityService } from '../../activity/activity.service';
import { ChromaService } from '../../../ai/rag/chroma.service';
import type { PostStatus } from '../../../database/schemas/post.schema';
import { UserService } from '../../user/user.service';
import {
  IPostModerationPort,
  POST_MODERATION_PORT,
} from '../ports/post-moderation.port';
import {
  IPostNotificationPort,
  POST_NOTIFICATION_PORT,
} from '../ports/post-notification.port';
import { CreatePostDto } from '../dto/create-post.dto';
import { PostMapper } from '../post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from '../interfaces/post.repository.interface';
import { resolveActorUserId } from '../../../common/auth/actor-user.util';
import { buildMatchCriteriaPatch } from '../../../ai/match/buddy-match-criteria.util';
import { inferPostContentTypes } from '../utils/post-content-type.util';
@Injectable()
export class PostWriteService {
  private readonly logger = new Logger(PostWriteService.name);

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    private readonly userService: UserService,
    private readonly activityService: ActivityService,
    private readonly chromaService: ChromaService,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    @Inject(POST_MODERATION_PORT)
    private readonly postModeration: IPostModerationPort,
  ) {}

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

    const eventTitle = dto.eventTitle?.trim() || activity?.name || '组队帖';

    let status: PostStatus = 'recruiting';
    let bodyToSave = dto.body.trim();
    let rejectionReason: string | undefined;

    if (!options?.skipRiskCheck) {
      const risk = await this.postModeration.assessPost({
        body: bodyToSave,
        userId,
        activityLegacyId: dto.activityLegacyId ?? activity?.legacyId,
      });
      if (!risk.publishable) {
        status = 'hidden';
        rejectionReason = risk.reason;
      } else if (risk.sanitizedBody) {
        bodyToSave = risk.sanitizedBody;
      }
    }

    const activityLegacyId = dto.activityLegacyId ?? activity?.legacyId;
    const location =
      dto.location?.trim() || profile?.location || activity?.location;
    const criteriaPatch = buildMatchCriteriaPatch({
      body: bodyToSave,
      tags: dto.tags,
      location,
      departureCity: dto.departureCity,
      activityLegacyId,
    });

    // 推断内容类型（支持交集）
    const contentTypes = dto.contentTypes?.length
      ? dto.contentTypes
      : inferPostContentTypes({ tags: dto.tags, body: bodyToSave });

    // 同一活动发帖数量限制：最多 8 篇
    const MAX_POSTS_PER_ACTIVITY = 8;
    if (activityLegacyId != null) {
      const activityPostCount = await this.repository.countByOwnerAndActivity(
        ownerUserId,
        activityLegacyId,
      );
      if (activityPostCount >= MAX_POSTS_PER_ACTIVITY) {
        throw new ConflictException(
          `您在「${eventTitle}」已发布 ${MAX_POSTS_PER_ACTIVITY} 篇帖子，达到上限。请先删除或修改之前的帖子后再发布。`,
        );
      }
    }

    const created = await this.repository.create({
      userId: ownerUserId,
      authorName: profile?.name ?? authorName?.trim() ?? 'Zara Chen',
      authorHandle: profile?.handle,
      authorAvatar: profile?.avatar,
      activityLegacyId,
      eventTitle,
      location,
      departureCity: criteriaPatch.departureCity,
      matchCriteria: criteriaPatch.matchCriteria,
      body: bodyToSave,
      tags: dto.tags ?? [],
      contentTypes,
      status,
      likes: 0,
      comments: 0,
      images: dto.images ?? [],
    });

    const postId = String(created._id);

    if (status === 'hidden') {
      void this.postNotification.notifyPostHidden(
        ownerUserId,
        postId,
        created.activityLegacyId,
        rejectionReason,
      );
      return PostMapper.toEventDetailItem(created);
    }

    this.scheduleEmbeddingUpsert({
      postId,
      userId: ownerUserId,
      body: created.body,
      eventTitle: created.eventTitle,
      tags: created.tags,
      location: created.location,
      departureCity: created.departureCity,
      activityCode: activity?.code,
      activityLegacyId: created.activityLegacyId,
      status,
    });

    return PostMapper.toEventDetailItem(created);
  }

  scheduleEmbeddingUpsert(input: {
    postId: string;
    userId: string;
    body: string;
    eventTitle: string;
    tags?: string[];
    location?: string;
    departureCity?: string;
    activityCode?: string;
    activityLegacyId?: number;
    status?: PostStatus;
  }): void {
    void this.chromaService.syncPostEmbeddingStatus(input).catch((error) => {
      this.logger.warn(
        `Chroma upsert failed for post ${input.postId}: ${(error as Error).message}`,
      );
    });
  }

  scheduleEmbeddingSyncForRecord(
    post: PostRecord,
    activity?: { code?: string } | null,
  ): void {
    if (post.status !== 'recruiting') return;

    this.scheduleEmbeddingUpsert({
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

  /** Re-sync all recruiting post vectors (startup / repair). */
  async reindexRecruitingEmbeddings(
    posts: PostRecord[],
    resolveActivityCode: (legacyId?: number) => Promise<string | undefined>,
  ): Promise<void> {
    for (const post of posts) {
      if (post.status !== 'recruiting') continue;
      const code = await resolveActivityCode(post.activityLegacyId);
      this.scheduleEmbeddingSyncForRecord(post, code ? { code } : null);
    }
  }

  scheduleEmbeddingDeprecate(postId: string): void {
    void this.deprecateEmbedding(postId);
  }

  async deprecateEmbedding(postId: string): Promise<void> {
    await this.chromaService.deprecatePostEmbedding(postId);
  }
}
