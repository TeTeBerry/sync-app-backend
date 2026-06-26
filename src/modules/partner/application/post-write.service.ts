import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  isTicketPublishProhibited,
  TICKET_PUBLISH_FORBIDDEN_MESSAGE,
} from '../../../ai/risk/ticket-publish-policy.util';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../../activity/ports/activity-lookup.port';
import type { PostStatus } from '../../../database/schemas/post.schema';
import { normalizeRecruitUnityTags } from '@sync/partner-contracts';
import { AccountRiskService } from '../../account-risk/account-risk.service';
import { UserProfileSyncService } from '../../user/user-profile-sync.service';
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
import { UpdatePostDto } from '../dto/update-post.dto';
import { UpdatePostRecruitDto } from '../dto/update-post-recruit.dto';
import { PostMapper } from '../post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from '../interfaces/post.repository.interface';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { isPostOwnedByActor } from '../../../common/auth/actor-query.util';
import { resolveDepartureCity } from '../utils/departure-city.util';
import {
  assertUserUgcTexts,
  collectPostWriteUgcTexts,
} from '../../../common/media/user-ugc-text.util';
import { assertPostHasNoContactInfo } from '../utils/post-contact.util';
import { normalizeRecruitFields } from '../utils/buddy-post-recruit.util';
import { BffReadCacheInvalidationService } from '../../../infra/cache/bff-read-cache.service';
import { WechatContentSecurityService } from '../../auth/wechat-content-security.service';

@Injectable()
export class PostWriteService {
  private readonly logger = new Logger(PostWriteService.name);

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    private readonly userService: UserService,
    private readonly userProfileSync: UserProfileSyncService,
    private readonly accountRisk: AccountRiskService,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    @Inject(POST_MODERATION_PORT)
    private readonly postModeration: IPostModerationPort,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly bffCacheInvalidation: BffReadCacheInvalidationService,
  ) {}

  private async toCreatedEventDetailItem(
    post: PostRecord,
    moderationReason?: string,
  ) {
    const item = PostMapper.toEventDetailItem(post);
    return {
      ...item,
      status: post.status ?? 'active',
      ...(moderationReason ? { moderationReason } : {}),
    };
  }

  async createPost(
    dto: CreatePostDto,
    actor: RequestActor,
    options?: { skipRiskCheck?: boolean },
  ) {
    await this.accountRisk.assertCanPublish(actor);
    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectPostWriteUgcTexts(dto),
    );

    const profile = await this.userService.resolveProfile(actor);
    const ownerUserId = actor.resolvedUserId;

    const activity =
      dto.activityLegacyId != null
        ? await this.activityLookup.findByLegacyId(dto.activityLegacyId)
        : null;

    const eventTitle = dto.eventTitle?.trim() || activity?.name || '帖子';

    let status: PostStatus = 'active';
    let bodyToSave = dto.body.trim();
    let rejectionReason: string | undefined;

    assertPostHasNoContactInfo(bodyToSave);

    if (
      isTicketPublishProhibited({
        body: bodyToSave,
        tags: dto.tags,
      })
    ) {
      void this.accountRisk.recordTicketPolicyViolation(
        actor,
        TICKET_PUBLISH_FORBIDDEN_MESSAGE,
      );
      throw new BadRequestException(TICKET_PUBLISH_FORBIDDEN_MESSAGE);
    }

    const structuredBuddyForm = Boolean(dto.tags?.length);

    if (!options?.skipRiskCheck) {
      const risk = await this.postModeration.assessPost(
        {
          body: bodyToSave,
          actor,
          activityLegacyId: dto.activityLegacyId ?? activity?.legacyId,
        },
        structuredBuddyForm ? { rulesOnly: true } : undefined,
      );
      if (!risk.publishable) {
        void this.accountRisk.recordPublishRiskViolation(actor, risk, {
          source: 'post_risk',
        });
        status = 'hidden';
        rejectionReason = risk.reason;
      } else if (risk.sanitizedBody) {
        bodyToSave = risk.sanitizedBody;
      }
    }

    const activityLegacyId = dto.activityLegacyId ?? activity?.legacyId;
    const location = dto.location?.trim() || activity?.location;
    const departureCity = resolveDepartureCity({
      departureCity: dto.departureCity,
      location,
      body: bodyToSave,
    });

    const similarActive = await this.repository.findOwnerSimilarActivePost(
      ownerUserId,
      bodyToSave,
      activityLegacyId,
    );
    if (similarActive) {
      throw new ConflictException(
        activityLegacyId != null
          ? `您在「${eventTitle}」已有内容相近的帖子，请勿重复发布。可编辑原帖后再发新帖。`
          : '您已有内容相近的帖子，请勿重复发布。可编辑原帖后再发新帖。',
      );
    }

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

    const listedInFeed = dto.listedInFeed !== false;
    const recruit = normalizeRecruitFields({
      recruitStatus: dto.recruitStatus,
      slotsTotal: dto.slotsTotal,
      slotsFilled: dto.slotsFilled,
      body: bodyToSave,
    });
    const recruitUnityTags = normalizeRecruitUnityTags(dto.recruitUnityTags);

    const BODY_PREVIEW_MAX = 280;
    const bodyPreview =
      bodyToSave.length > BODY_PREVIEW_MAX
        ? bodyToSave.slice(0, BODY_PREVIEW_MAX)
        : '';

    assertPostHasNoContactInfo(bodyToSave);
    await assertUserUgcTexts(this.wechatContentSecurity, [
      bodyToSave,
      ...(dto.tags ?? []),
      location,
      departureCity,
      eventTitle,
    ]);

    const created = await this.repository.create({
      userId: ownerUserId,
      authorName: profile?.name ?? actor.displayName?.trim() ?? '用户',
      authorHandle: profile?.handle,
      authorAvatar: profile?.avatar,
      activityLegacyId,
      eventTitle,
      location,
      departureCity,
      body: bodyToSave,
      bodyPreview,
      tags: dto.tags ?? [],
      recruitUnityTags,
      status,
      listedInFeed,
      recruitStatus: recruit.recruitStatus,
      ...(recruit.slotsTotal != null ? { slotsTotal: recruit.slotsTotal } : {}),
      ...(recruit.slotsFilled != null
        ? { slotsFilled: recruit.slotsFilled }
        : {}),
    });

    const postId = String(created._id);

    this.userProfileSync.applyBuddyPostHints(actor, {
      body: bodyToSave,
      location,
      departureCity,
      tags: dto.tags,
    });

    if (activityLegacyId != null) {
      await this.bffCacheInvalidation.invalidateHomeForUser(ownerUserId);
      await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
        ownerUserId,
        activityLegacyId,
      );
      if (status !== 'hidden' && listedInFeed) {
        void this.activityLookup.refreshCache().catch(() => undefined);
      }
    }

    if (status === 'hidden') {
      void this.postNotification.notifyPostHidden(
        ownerUserId,
        postId,
        created.activityLegacyId,
        rejectionReason,
      );
      return this.toCreatedEventDetailItem(created, rejectionReason);
    }

    return this.toCreatedEventDetailItem(created);
  }

  async updateRecruitStatus(
    postId: string,
    dto: UpdatePostRecruitDto,
    actor: RequestActor,
  ) {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const profile = await this.userService.resolveProfile(actor);
    const ownerUserId = actor.resolvedUserId;
    if (!(await isPostOwnedByActor(post, actor, profile?.name))) {
      throw new ForbiddenException('无权修改该帖子');
    }

    const recruit = normalizeRecruitFields({
      recruitStatus: dto.recruitStatus,
      slotsTotal: dto.slotsTotal ?? post.slotsTotal,
      slotsFilled: dto.slotsFilled ?? post.slotsFilled,
      body: post.body,
    });

    const updated = await this.repository.updateById(postId, {
      recruitStatus: recruit.recruitStatus,
      ...(recruit.slotsTotal != null ? { slotsTotal: recruit.slotsTotal } : {}),
      ...(recruit.slotsFilled != null
        ? { slotsFilled: recruit.slotsFilled }
        : {}),
    });
    if (!updated) {
      throw new NotFoundException('帖子不存在');
    }

    if (updated.activityLegacyId != null) {
      await this.bffCacheInvalidation.invalidateHomeForUser(ownerUserId);
      await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
        ownerUserId,
        updated.activityLegacyId,
      );
    }

    return PostMapper.toEventDetailItem(updated);
  }

  async updatePost(postId: string, dto: UpdatePostDto, actor: RequestActor) {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundException('帖子不存在');
    }

    const profile = await this.userService.resolveProfile(actor);
    const ownerUserId = actor.resolvedUserId;
    if (!(await isPostOwnedByActor(post, actor, profile?.name))) {
      throw new ForbiddenException('无权修改该帖子');
    }

    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectPostWriteUgcTexts(dto),
    );

    let bodyToSave = dto.body.trim();
    assertPostHasNoContactInfo(bodyToSave);

    if (
      isTicketPublishProhibited({
        body: bodyToSave,
        tags: dto.tags,
      })
    ) {
      void this.accountRisk.recordTicketPolicyViolation(
        actor,
        TICKET_PUBLISH_FORBIDDEN_MESSAGE,
      );
      throw new BadRequestException(TICKET_PUBLISH_FORBIDDEN_MESSAGE);
    }

    const structuredBuddyForm = Boolean(dto.tags?.length);
    const risk = await this.postModeration.assessPost(
      {
        body: bodyToSave,
        actor,
        activityLegacyId: post.activityLegacyId,
      },
      structuredBuddyForm ? { rulesOnly: true } : undefined,
    );
    if (!risk.publishable) {
      void this.accountRisk.recordPublishRiskViolation(actor, risk, {
        source: 'post_risk',
      });
      throw new BadRequestException(risk.reason ?? '内容不符合发布规范');
    }
    if (risk.sanitizedBody) {
      bodyToSave = risk.sanitizedBody;
    }

    const activityLegacyId = post.activityLegacyId;
    const location = dto.location?.trim() || post.location;
    const departureCity = resolveDepartureCity({
      departureCity: dto.departureCity,
      location,
      body: bodyToSave,
    });

    const similarActive = await this.repository.findOwnerSimilarActivePost(
      ownerUserId,
      bodyToSave,
      activityLegacyId,
      postId,
    );
    if (similarActive) {
      const eventTitle = post.eventTitle?.trim() || '本场活动';
      throw new ConflictException(
        activityLegacyId != null
          ? `您在「${eventTitle}」已有内容相近的帖子，请勿重复发布。可编辑原帖后再发新帖。`
          : '您已有内容相近的帖子，请勿重复发布。可编辑原帖后再发新帖。',
      );
    }

    const recruit = normalizeRecruitFields({
      recruitStatus: dto.recruitStatus ?? post.recruitStatus,
      slotsTotal: dto.slotsTotal ?? post.slotsTotal,
      slotsFilled: dto.slotsFilled ?? post.slotsFilled,
      body: bodyToSave,
    });
    const recruitUnityTags =
      dto.recruitUnityTags !== undefined
        ? normalizeRecruitUnityTags(dto.recruitUnityTags)
        : normalizeRecruitUnityTags(post.recruitUnityTags);

    const BODY_PREVIEW_MAX = 280;
    const bodyPreview =
      bodyToSave.length > BODY_PREVIEW_MAX
        ? bodyToSave.slice(0, BODY_PREVIEW_MAX)
        : '';

    await assertUserUgcTexts(this.wechatContentSecurity, [
      bodyToSave,
      ...(dto.tags ?? []),
      location,
      departureCity,
      post.eventTitle,
    ]);

    const updated = await this.repository.updateById(postId, {
      body: bodyToSave,
      bodyPreview,
      location,
      departureCity,
      tags: dto.tags ?? post.tags ?? [],
      recruitUnityTags,
      recruitStatus: recruit.recruitStatus,
      ...(recruit.slotsTotal != null ? { slotsTotal: recruit.slotsTotal } : {}),
      ...(recruit.slotsFilled != null
        ? { slotsFilled: recruit.slotsFilled }
        : {}),
    });
    if (!updated) {
      throw new NotFoundException('帖子不存在');
    }

    this.userProfileSync.applyBuddyPostHints(actor, {
      body: bodyToSave,
      location,
      departureCity,
      tags: dto.tags,
    });

    if (activityLegacyId != null) {
      await this.bffCacheInvalidation.invalidateHomeForUser(ownerUserId);
      await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
        ownerUserId,
        activityLegacyId,
      );
      if (updated.status !== 'hidden' && updated.listedInFeed !== false) {
        void this.activityLookup.refreshCache().catch(() => undefined);
      }
    }

    return PostMapper.toEventDetailItem(updated);
  }
}
