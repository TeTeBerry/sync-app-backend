import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  EventLiveUpdate,
  EventLiveUpdateDocument,
} from '../../database/schemas/event-live-update.schema';
import {
  EventLiveWristband,
  EventLiveWristbandDocument,
} from '../../database/schemas/event-live-wristband.schema';
import { isDemoSeedEnabled } from '../../common/utils/seed-policy.util';
import { ActivityService } from '../activity/activity.service';
import { UserService } from '../user/user.service';
import { PublishLiveInfoDto } from './dto/publish-live-info.dto';
import { SubmitLiveInfoWristbandDto } from './dto/submit-wristband.dto';
import { aggregateLiveInfoSummary } from './domain/live-info-aggregate.util';
import { sortLiveInfoUpdatesByScore } from './domain/live-info-feed-sort.util';
import {
  LIVE_INFO_PUBLISH_COOLDOWN_MS,
  LIVE_INFO_UPDATE_TTL_MS,
  shanghaiEndOfEventDate,
  shanghaiEventDate,
} from './domain/live-info-date.util';
import {
  LIVE_INFO_DUPLICATE_FINGERPRINT_MS,
  LIVE_INFO_MAX_PUBLISHES_PER_HOUR,
} from './domain/live-info-publish-limits.util';
import { liveInfoUpdateFingerprint } from './utils/live-info-update-fingerprint.util';
import { toLiveInfoFeedItemDto, toLiveInfoViewerDto } from './live-info.mapper';
import {
  filterLiveInfoUpdates,
  parseCertifiedOnlyQuery,
  type LiveInfoSnapshotQuery,
} from './domain/live-info-snapshot-filter.util';
import {
  isZoneTagAllowed,
  normalizeZoneTag,
  resolveLiveInfoZones,
} from './domain/live-info-zones.util';
import { LIVE_INFO_SEED_UPDATES } from './live-info.seed';
import { OnSiteIdentityService } from './on-site-identity.service';
import {
  wristbandImageFileKey,
  wristbandImageUrlRegex,
} from './utils/wristband-image-key.util';
import {
  isCloudWristbandImageRef,
  readUploadImageAsDataUrl,
} from './utils/wristband-upload-url.util';
import {
  WristbandVerifyService,
  type WristbandVerifyDecision,
} from './wristband-verify.service';
import { assertUserImageRefSync } from '../../common/media/user-image-ref.util';
import { assertUserUgcImages } from '../../common/media/user-ugc-image.util';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { MediaSecurityCheckService } from '../media-security/media-security-check.service';

const WRISTBAND_DUPLICATE_MESSAGE =
  '该手环照片已使用过，请拍摄本人手腕佩戴的活动腕带';

@Injectable()
export class LiveInfoService implements OnModuleInit {
  private readonly logger = new Logger(LiveInfoService.name);

  constructor(
    @InjectModel(EventLiveWristband.name)
    private readonly wristbandModel: Model<EventLiveWristbandDocument>,
    @InjectModel(EventLiveUpdate.name)
    private readonly updateModel: Model<EventLiveUpdateDocument>,
    private readonly activityService: ActivityService,
    private readonly userService: UserService,
    private readonly wristbandVerifyService: WristbandVerifyService,
    private readonly onSiteIdentity: OnSiteIdentityService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly mediaChecks: MediaSecurityCheckService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isDemoSeedEnabled()) return;
    await this.seedDemoUpdates().catch((err) => {
      this.logger.warn(`live-info seed skipped: ${String(err)}`);
    });
  }

  private async ensureActivity(legacyId: number) {
    const activity = await this.activityService.findByLegacyId(legacyId);
    if (!activity) {
      throw new NotFoundException('活动不存在');
    }
    return activity;
  }

  private resolveUser(actor: RequestActor): string {
    const uid = actor.resolvedUserId;
    if (!uid) {
      throw new BadRequestException('缺少 userId');
    }
    return uid;
  }

  /** Viewer for feed `liked` state; undefined when client identity is empty. */
  private resolveViewerId(actor: RequestActor): string | undefined {
    if (!actor.clientUserId?.trim() && !actor.displayName?.trim()) {
      return undefined;
    }
    return actor.resolvedUserId;
  }

  /** Same upload file already certified (or pending) for this activity today by another user. */
  private async findDuplicateWristband(input: {
    activityLegacyId: number;
    eventDate: string;
    imageUrl: string;
    excludeUserId: string;
  }): Promise<EventLiveWristbandDocument | null> {
    const fileKey = wristbandImageFileKey(input.imageUrl);
    const imageUrlPattern = wristbandImageUrlRegex(fileKey);
    const doc = await this.wristbandModel
      .findOne({
        activityLegacyId: input.activityLegacyId,
        eventDate: input.eventDate,
        userId: { $ne: input.excludeUserId },
        status: { $in: ['approved', 'pending'] },
        imageUrl: imageUrlPattern,
      })
      .lean();
    return doc as EventLiveWristbandDocument | null;
  }

  private async rejectWristband(input: {
    uid: string;
    activityLegacyId: number;
    eventDate: string;
    imageUrl: string;
    validUntil: Date;
    author: string;
    rejectReason: string;
    code?: 'duplicate_image';
  }) {
    const doc = await this.wristbandModel.findOneAndUpdate(
      {
        userId: input.uid,
        activityLegacyId: input.activityLegacyId,
        eventDate: input.eventDate,
      },
      {
        $set: {
          imageUrl: input.imageUrl,
          status: 'rejected',
          validUntil: input.validUntil,
          authorName: input.author,
          rejectReason: input.rejectReason,
        },
        $setOnInsert: {
          userId: input.uid,
          activityLegacyId: input.activityLegacyId,
          eventDate: input.eventDate,
        },
      },
      { upsert: true, new: true },
    );

    return {
      ok: false as const,
      ...(input.code ? { code: input.code } : {}),
      message: input.rejectReason,
      viewer: toLiveInfoViewerDto(doc, input.eventDate),
    };
  }

  async getSnapshot(
    activityLegacyId: number,
    actor: RequestActor,
    query: LiveInfoSnapshotQuery = {},
  ) {
    const activity = await this.ensureActivity(activityLegacyId);
    const zones = resolveLiveInfoZones(activity);
    const eventDate = shanghaiEventDate();
    const viewerId = this.resolveViewerId(actor);

    const wristband = viewerId
      ? await this.wristbandModel
          .findOne({
            userId: viewerId,
            activityLegacyId,
            eventDate,
          })
          .lean()
      : null;

    const now = new Date();
    const rawUpdates = await this.updateModel
      .find({
        activityLegacyId,
        expiresAt: { $gt: now },
      })
      .limit(80)
      .lean();

    const authorIds = [
      ...new Set(
        rawUpdates.map((u) => u.userId?.trim()).filter(Boolean) as string[],
      ),
    ];
    const onSiteUserIds = await this.onSiteIdentity.getOnSiteCertifiedUserIds(
      activityLegacyId,
      authorIds,
    );

    const filtered = filterLiveInfoUpdates(
      rawUpdates.map((u) => ({
        ...u,
        zoneTag: normalizeZoneTag(u.zoneTag),
      })),
      query,
      onSiteUserIds,
    );

    const activeUpdates = sortLiveInfoUpdatesByScore(filtered);

    const { summary, certCount } = aggregateLiveInfoSummary(
      activeUpdates.map((u) => ({ ratings: u.ratings })),
    );

    const feed = activeUpdates.map((doc) =>
      toLiveInfoFeedItemDto(doc as EventLiveUpdateDocument, viewerId, {
        zones,
        authorOnSiteVerified: onSiteUserIds.has(doc.userId?.trim() ?? ''),
      }),
    );

    const viewer = toLiveInfoViewerDto(
      wristband as EventLiveWristbandDocument | null,
      eventDate,
    );

    return {
      activityLegacyId,
      eventDate,
      zones,
      viewer,
      summary,
      certCount,
      feed,
    };
  }

  async submitWristband(
    activityLegacyId: number,
    body: SubmitLiveInfoWristbandDto,
    actor: RequestActor,
  ) {
    const activity = await this.ensureActivity(activityLegacyId);
    const uid = this.resolveUser(actor);
    const imageUrl = body.imageUrl?.trim();
    if (!imageUrl) {
      throw new BadRequestException('请上传手环照片');
    }
    assertUserImageRefSync(imageUrl);
    await assertUserUgcImages(
      this.wechatContentSecurity,
      this.mediaChecks,
      [imageUrl],
      uid,
    );

    const eventDate = shanghaiEventDate();
    const validUntil = shanghaiEndOfEventDate(eventDate);
    const profile = await this.userService.resolveProfile(actor);
    const author = profile?.name ?? actor.displayName?.trim() ?? '用户';

    const duplicate = await this.findDuplicateWristband({
      activityLegacyId,
      eventDate,
      imageUrl,
      excludeUserId: uid,
    });
    if (duplicate) {
      this.logger.warn(
        `wristband duplicate user=${uid} activity=${activityLegacyId} file=${wristbandImageFileKey(imageUrl)} owner=${duplicate.userId}`,
      );
      return this.rejectWristband({
        uid,
        activityLegacyId,
        eventDate,
        imageUrl,
        validUntil,
        author,
        rejectReason: WRISTBAND_DUPLICATE_MESSAGE,
        code: 'duplicate_image',
      });
    }

    let decision: WristbandVerifyDecision;
    if (isCloudWristbandImageRef(imageUrl)) {
      this.logger.log(
        `wristband cloud fileID — skip server-side fetch/AI verify user=${uid}`,
      );
      decision = {
        approved: true,
        confidence: 1,
        reason: 'cloud fileID',
        rejectCode: null,
      };
    } else {
      let imageDataUrl: string;
      try {
        imageDataUrl = await readUploadImageAsDataUrl(imageUrl);
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`read wristband image failed: ${String(err)}`);
        throw new BadRequestException('无法读取上传的图片，请重新上传');
      }

      decision = await this.wristbandVerifyService.verifyImage({
        imageDataUrl,
        activityName: activity.name,
        activityAliases: activity.alias,
      });
    }

    if (!decision.approved) {
      return this.rejectWristband({
        uid,
        activityLegacyId,
        eventDate,
        imageUrl,
        validUntil,
        author,
        rejectReason: decision.reason,
      });
    }

    const doc = await this.wristbandModel.findOneAndUpdate(
      { userId: uid, activityLegacyId, eventDate },
      {
        $set: {
          imageUrl,
          status: 'approved',
          validUntil,
          authorName: author,
        },
        $unset: { rejectReason: 1 },
        $setOnInsert: {
          userId: uid,
          activityLegacyId,
          eventDate,
        },
      },
      { upsert: true, new: true },
    );

    this.logger.log(
      `wristband approved user=${uid} activity=${activityLegacyId} confidence=${decision.confidence.toFixed(2)}`,
    );

    return {
      ok: true as const,
      viewer: toLiveInfoViewerDto(doc, eventDate),
    };
  }

  async clearWristband(activityLegacyId: number, actor: RequestActor) {
    const uid = this.resolveUser(actor);
    const eventDate = shanghaiEventDate();
    await this.wristbandModel.deleteOne({
      userId: uid,
      activityLegacyId,
      eventDate,
    });
    return {
      ok: true as const,
      viewer: toLiveInfoViewerDto(null, eventDate),
    };
  }

  private async requireCertified(
    activityLegacyId: number,
    userId: string,
    eventDate: string,
  ): Promise<EventLiveWristbandDocument> {
    const wristband = await this.wristbandModel.findOne({
      userId,
      activityLegacyId,
      eventDate,
      status: 'approved',
    });
    if (!wristband || wristband.validUntil < new Date()) {
      throw new ForbiddenException('请先完成当日手环认证');
    }
    return wristband;
  }

  async publishUpdate(
    activityLegacyId: number,
    body: PublishLiveInfoDto,
    actor: RequestActor,
  ) {
    const activity = await this.ensureActivity(activityLegacyId);
    const zones = resolveLiveInfoZones(activity);
    const zoneTag = normalizeZoneTag(body.zoneTag);
    if (!isZoneTagAllowed(zoneTag, zones)) {
      throw new BadRequestException('无效的现场区域');
    }

    const uid = this.resolveUser(actor);
    const eventDate = shanghaiEventDate();
    await this.requireCertified(activityLegacyId, uid, eventDate);
    await this.wechatContentSecurity.assertTextSafe(body.remark?.trim() ?? '');

    const now = Date.now();
    const cooldownSince = new Date(now - LIVE_INFO_PUBLISH_COOLDOWN_MS);
    const recent = await this.updateModel.findOne({
      activityLegacyId,
      userId: uid,
      createdAt: { $gt: cooldownSince },
    });
    if (recent) {
      throw new BadRequestException('发布过于频繁，请 5 分钟后再试');
    }

    const hourSince = new Date(now - 60 * 60 * 1000);
    const hourlyCount = await this.updateModel.countDocuments({
      activityLegacyId,
      userId: uid,
      createdAt: { $gt: hourSince },
    });
    if (hourlyCount >= LIVE_INFO_MAX_PUBLISHES_PER_HOUR) {
      throw new BadRequestException('今日发布次数过多，请稍后再试');
    }

    const fingerprint = liveInfoUpdateFingerprint(body);
    const duplicateSince = new Date(now - LIVE_INFO_DUPLICATE_FINGERPRINT_MS);
    const duplicate = await this.updateModel.findOne({
      activityLegacyId,
      userId: uid,
      contentFingerprint: fingerprint,
      createdAt: { $gt: duplicateSince },
    });
    if (duplicate) {
      throw new BadRequestException(
        '内容与近期现场资讯重复，请修改评分或备注后再发',
      );
    }

    const profile = await this.userService.resolveProfile(actor);
    const expiresAt = new Date(Date.now() + LIVE_INFO_UPDATE_TTL_MS);

    const doc = await this.updateModel.create({
      activityLegacyId,
      userId: uid,
      authorName: profile?.name ?? actor.displayName?.trim() ?? '用户',
      avatar: profile?.avatar,
      zoneTag,
      ratings: body.ratings,
      remark: body.remark?.trim(),
      contentFingerprint: fingerprint,
      expiresAt,
      likedByUserIds: [],
    });

    const onSite = await this.onSiteIdentity.isUserOnSiteCertified(
      uid,
      activityLegacyId,
    );

    return {
      ok: true as const,
      update: toLiveInfoFeedItemDto(doc, uid, {
        zones,
        authorOnSiteVerified: onSite,
      }),
    };
  }

  async toggleLike(
    activityLegacyId: number,
    updateId: string,
    actor: RequestActor,
  ) {
    await this.ensureActivity(activityLegacyId);
    const uid = this.resolveUser(actor);

    const doc = await this.updateModel.findById(updateId);
    if (!doc || doc.activityLegacyId !== activityLegacyId) {
      throw new NotFoundException('动态不存在');
    }
    if (doc.expiresAt < new Date()) {
      throw new BadRequestException('该动态已过期');
    }

    const likedBy = doc.likedByUserIds ?? [];
    const liked = likedBy.includes(uid);
    if (liked) {
      doc.likedByUserIds = likedBy.filter((id) => id !== uid);
    } else {
      doc.likedByUserIds = [...likedBy, uid];
    }
    await doc.save();

    const fresh = await this.updateModel.findById(updateId).lean();
    if (!fresh) {
      throw new NotFoundException('动态不存在');
    }

    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    const zones = resolveLiveInfoZones(activity);
    const onSite = await this.onSiteIdentity.isUserOnSiteCertified(
      uid,
      activityLegacyId,
    );

    return {
      ok: true as const,
      update: toLiveInfoFeedItemDto(fresh as EventLiveUpdateDocument, uid, {
        zones,
        authorOnSiteVerified: onSite,
      }),
    };
  }

  private async seedDemoUpdates(): Promise<void> {
    for (const seed of LIVE_INFO_SEED_UPDATES) {
      const exists = await this.updateModel.exists({
        activityLegacyId: seed.activityLegacyId,
        userId: seed.userId,
        remark: seed.remark,
      });
      if (exists) continue;

      const expiresAt = new Date(Date.now() + LIVE_INFO_UPDATE_TTL_MS);
      const minutesAgo = seed.minutesAgo ?? 0;
      const createdAt = new Date(Date.now() - minutesAgo * 60_000);
      await this.updateModel.create({
        activityLegacyId: seed.activityLegacyId,
        userId: seed.userId,
        authorName: seed.authorName,
        avatar: seed.avatar,
        zoneTag: seed.zoneTag ?? 'venue',
        ratings: seed.ratings,
        remark: seed.remark,
        expiresAt,
        likedByUserIds: seed.likedByUserIds ?? [],
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
}
