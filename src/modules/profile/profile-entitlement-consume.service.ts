import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventPackageEntitlement,
  EventPackageEntitlementDocument,
} from '../../database/schemas/event-package-entitlement.schema';
import { ActivityService } from '../activity/activity.service';
import type { EntitlementConsumeBucket } from './domain/entitlement-consume.util';
import {
  resolveAiMatchConsumeBucket,
  resolveContactUnlockConsumeBucket,
} from './domain/entitlement-consume.util';
import {
  isPackageEntitlementActive,
  resolveRecordValidUntil,
  type EventEntitlementUsage,
} from './domain/event-entitlement.util';
import { resolveProfilePackageOwnerId } from './domain/mock-profile-user.util';
import { getPackageTierDefinition } from './domain/package-tier.config';
import {
  ProfilePackageService,
  type EventPackageEntitlementDto,
} from './profile-package.service';
import { ProfileFreeQuotaService } from './profile-free-quota.service';

export interface ConsumeProfileEntitlementResultDto {
  ok: true;
  bucket: EntitlementConsumeBucket;
  entitlement: EventPackageEntitlementDto;
}

@Injectable()
export class ProfileEntitlementConsumeService {
  constructor(
    @InjectModel(EventPackageEntitlement.name)
    private readonly entitlementModel: Model<EventPackageEntitlementDocument>,
    private readonly activityService: ActivityService,
    private readonly profileFreeQuotaService: ProfileFreeQuotaService,
    private readonly profilePackageService: ProfilePackageService,
  ) {}

  /** Resolve which bucket would be used without consuming (for AI match pre-check). */
  async peekAiMatchBucket(
    userId?: string,
    authorName?: string,
    activityLegacyId?: number,
  ): Promise<EntitlementConsumeBucket | null> {
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      throw new BadRequestException('activityLegacyId is required');
    }

    const ownerId = resolveProfilePackageOwnerId(userId, authorName);
    const freeUsage =
      await this.profileFreeQuotaService.getFreeMonthlyForUser(ownerId);
    const paid = await this.loadPaidEntitlement(ownerId, activityLegacyId);

    return resolveAiMatchConsumeBucket(
      freeUsage,
      paid?.limits ?? null,
      paid?.usage ?? null,
    );
  }

  async consumeAiMatch(
    userId?: string,
    authorName?: string,
    activityLegacyId?: number,
  ): Promise<ConsumeProfileEntitlementResultDto> {
    const bucket = await this.consumeQuota(
      userId,
      authorName,
      activityLegacyId,
      'aiMatch',
    );
    const entitlement = await this.resolveEntitlementAfterConsume(
      userId,
      authorName,
      activityLegacyId,
    );
    return { ok: true, bucket, entitlement };
  }

  async consumeContactUnlock(
    userId?: string,
    authorName?: string,
    activityLegacyId?: number,
  ): Promise<ConsumeProfileEntitlementResultDto> {
    const bucket = await this.consumeQuota(
      userId,
      authorName,
      activityLegacyId,
      'contactUnlock',
    );
    const entitlement = await this.resolveEntitlementAfterConsume(
      userId,
      authorName,
      activityLegacyId,
    );
    return { ok: true, bucket, entitlement };
  }

  private async consumeQuota(
    userId: string | undefined,
    authorName: string | undefined,
    activityLegacyId: number | undefined,
    kind: 'aiMatch' | 'contactUnlock',
  ): Promise<EntitlementConsumeBucket> {
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      throw new BadRequestException('activityLegacyId is required');
    }

    const ownerId = resolveProfilePackageOwnerId(userId, authorName);
    const freeUsage =
      await this.profileFreeQuotaService.getFreeMonthlyForUser(ownerId);

    const paid = await this.loadPaidEntitlement(ownerId, activityLegacyId);

    const bucket =
      kind === 'aiMatch'
        ? resolveAiMatchConsumeBucket(
            freeUsage,
            paid?.limits ?? null,
            paid?.usage ?? null,
          )
        : resolveContactUnlockConsumeBucket(
            freeUsage,
            paid?.limits ?? null,
            paid?.usage ?? null,
          );

    if (!bucket) {
      throw new ForbiddenException(
        kind === 'aiMatch'
          ? 'AI match quota exhausted'
          : 'Contact unlock quota exhausted',
      );
    }

    if (bucket === 'free') {
      if (kind === 'aiMatch') {
        await this.profileFreeQuotaService.incrementAiMatchUsed(ownerId);
      } else {
        await this.profileFreeQuotaService.incrementContactUnlockUsed(ownerId);
      }
      return 'free';
    }

    if (!paid) {
      throw new ForbiddenException(
        kind === 'aiMatch'
          ? 'AI match quota exhausted'
          : 'Contact unlock quota exhausted',
      );
    }

    const limits = paid.limits;
    const field =
      kind === 'aiMatch' ? 'usage.aiMatchUsed' : 'usage.contactUnlockUsed';
    const limit =
      kind === 'aiMatch' ? limits.aiMatchCount : limits.contactUnlockCount;

    if (limit != null) {
      await this.entitlementModel
        .findOneAndUpdate(
          { userId: ownerId, activityLegacyId },
          { $inc: { [field]: 1 } },
        )
        .exec();
    }

    return 'paid';
  }

  private async loadPaidEntitlement(
    ownerId: string,
    activityLegacyId: number,
  ): Promise<{
    limits: ReturnType<typeof getPackageTierDefinition>['limits'];
    usage: EventEntitlementUsage;
  } | null> {
    const activity = await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity not found: ${activityLegacyId}`);
    }

    const record = await this.entitlementModel
      .findOne({ userId: ownerId, activityLegacyId })
      .lean()
      .exec();

    if (!record) {
      return null;
    }

    const validUntil = resolveRecordValidUntil(record);
    if (!isPackageEntitlementActive(validUntil)) {
      return null;
    }

    const tier = getPackageTierDefinition(record.tierId);
    return {
      limits: tier.limits,
      usage: {
        aiMatchUsed: record.usage?.aiMatchUsed ?? 0,
        contactUnlockUsed: record.usage?.contactUnlockUsed ?? 0,
        postPinUsed: record.usage?.postPinUsed ?? 0,
      },
    };
  }

  private async resolveEntitlementAfterConsume(
    userId: string | undefined,
    authorName: string | undefined,
    activityLegacyId: number | undefined,
  ): Promise<EventPackageEntitlementDto> {
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      throw new BadRequestException('activityLegacyId is required');
    }

    const entitlement = await this.profilePackageService.getEntitlementForActivity(
      userId,
      authorName,
      activityLegacyId,
    );
    if (!entitlement) {
      throw new BadRequestException('Entitlement not found for activity');
    }
    return entitlement;
  }
}
