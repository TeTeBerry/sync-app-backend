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
import { ActivityService } from '../../activity/activity.service';
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
  inferPostContentTypes,
  MAX_POST_IMAGES,
} from '../utils/post-content-type.util';
import { OnSiteIdentityService } from '../../live-info/on-site-identity.service';
import { normalizeUserImageUrls } from '../../../common/media/user-image-ref.util';
import { assertUserUgcImages } from '../../../common/media/user-ugc-image.util';
import {
  assertUserUgcTexts,
  collectPostWriteUgcTexts,
} from '../../../common/media/user-ugc-text.util';
import { WechatContentSecurityService } from '../../auth/wechat-content-security.service';
import { MediaSecurityCheckService } from '../../media-security/media-security-check.service';

@Injectable()
export class PostWriteService {
  private readonly logger = new Logger(PostWriteService.name);

  constructor(
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
    private readonly userService: UserService,
    private readonly userProfileSync: UserProfileSyncService,
    private readonly accountRisk: AccountRiskService,
    private readonly activityService: ActivityService,
    @Inject(POST_NOTIFICATION_PORT)
    private readonly postNotification: IPostNotificationPort,
    @Inject(POST_MODERATION_PORT)
    private readonly postModeration: IPostModerationPort,
    private readonly onSiteIdentity: OnSiteIdentityService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly mediaChecks: MediaSecurityCheckService,
  ) {}

  private async toCreatedEventDetailItem(
    post: PostRecord,
    liked = false,
    appliedByMe = false,
  ) {
    const activityLegacyId = post.activityLegacyId;
    const authorOnSiteVerified =
      activityLegacyId != null
        ? await this.onSiteIdentity.isUserOnSiteCertified(
            post.userId,
            activityLegacyId,
          )
        : false;
    return PostMapper.toEventDetailItem(
      post,
      liked,
      appliedByMe,
      authorOnSiteVerified,
    );
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
        ? await this.activityService.findByLegacyId(dto.activityLegacyId)
        : null;

    const eventTitle = dto.eventTitle?.trim() || activity?.name || '组队帖';

    let status: PostStatus = 'recruiting';
    let bodyToSave = dto.body.trim();
    let rejectionReason: string | undefined;

    if (
      isTicketPublishProhibited({
        body: bodyToSave,
        tags: dto.tags,
        contentTypes: dto.contentTypes,
      })
    ) {
      void this.accountRisk.recordTicketPolicyViolation(
        actor,
        TICKET_PUBLISH_FORBIDDEN_MESSAGE,
      );
      throw new BadRequestException(TICKET_PUBLISH_FORBIDDEN_MESSAGE);
    }

    const structuredBuddyForm =
      Boolean(dto.contentTypes?.length) && Boolean(dto.tags?.length);

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
    const location =
      dto.location?.trim() || profile?.location || activity?.location;
    const departureCity = resolveDepartureCity({
      departureCity: dto.departureCity,
      location,
      body: bodyToSave,
    });

    // 推断内容类型（支持交集）
    const contentTypes = dto.contentTypes?.length
      ? dto.contentTypes
      : inferPostContentTypes({ tags: dto.tags, body: bodyToSave });

    const isSharePost = contentTypes.includes('share');

    if (!isSharePost) {
      const similarRecruiting =
        await this.repository.findOwnerSimilarRecruitingPost(
          ownerUserId,
          bodyToSave,
          activityLegacyId,
        );
      if (similarRecruiting) {
        throw new ConflictException(
          activityLegacyId != null
            ? `您在「${eventTitle}」已有内容相近的招募帖，请勿重复发布。可编辑原帖或将其标记完成后再发新帖。`
            : '您已有内容相近的招募帖正在招募中，请勿重复发布。可编辑原帖或将其标记完成后再发新帖。',
        );
      }

      // 同一活动组队帖数量限制：最多 8 篇
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
    }

    const listedInFeed = dto.listedInFeed !== false;
    const normalizedImages = normalizeUserImageUrls(dto.images);
    if (normalizedImages.length > MAX_POST_IMAGES) {
      throw new BadRequestException(`最多上传 ${MAX_POST_IMAGES} 张图片`);
    }
    await assertUserUgcImages(
      this.wechatContentSecurity,
      this.mediaChecks,
      normalizedImages,
      ownerUserId,
    );
    const images = normalizedImages;

    const created = await this.repository.create({
      userId: ownerUserId,
      authorName: profile?.name ?? actor.displayName?.trim() ?? 'Zara Chen',
      authorHandle: profile?.handle,
      authorAvatar: profile?.avatar,
      activityLegacyId,
      eventTitle,
      location,
      departureCity,
      body: bodyToSave,
      tags: dto.tags ?? [],
      contentTypes,
      status,
      listedInFeed,
      likes: 0,
      comments: 0,
      images,
    });

    const postId = String(created._id);

    this.userProfileSync.applyBuddyPostHints(actor, {
      body: bodyToSave,
      location,
      departureCity,
      tags: dto.tags,
      contentTypes: dto.contentTypes,
    });

    if (status === 'hidden') {
      void this.postNotification.notifyPostHidden(
        ownerUserId,
        postId,
        created.activityLegacyId,
        rejectionReason,
      );
      return this.toCreatedEventDetailItem(created);
    }

    return this.toCreatedEventDetailItem(created);
  }
}
