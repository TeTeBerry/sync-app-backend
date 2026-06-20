import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  isTicketPublishProhibited,
  TICKET_PUBLISH_FORBIDDEN_MESSAGE,
} from '../../../ai/buddy/ticket-publish-policy.util';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../../activity/ports/activity-lookup.port';
import type { PostStatus } from '../../../database/schemas/post.schema';
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
import { PostMapper } from '../post.mapper';
import {
  IPostRepository,
  POST_REPOSITORY,
  PostRecord,
} from '../interfaces/post.repository.interface';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { resolveDepartureCity } from '../utils/departure-city.util';
import {
  assertUserUgcTexts,
  collectPostWriteUgcTexts,
} from '../../../common/media/user-ugc-text.util';
import { assertPostHasNoContactInfo } from '../utils/post-contact.util';
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
      status,
      listedInFeed,
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
}
