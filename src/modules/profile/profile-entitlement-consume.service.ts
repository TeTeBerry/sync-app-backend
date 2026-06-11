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
import { resolveContactUnlockConsumeBucket } from './domain/entitlement-consume.util';
import {
  isPackageEntitlementActive,
  resolveRecordValidUntil,
  type EventEntitlementUsage,
} from './domain/event-entitlement.util';
import { resolveProfilePackageOwnerFromActor } from './domain/mock-profile-user.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
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

  async consumeContactUnlock(
    actor: RequestActor,
    activityLegacyId?: number,
  ): Promise<ConsumeProfileEntitlementResultDto> {
    const bucket = await this.consumeContactUnlockQuota(
      actor,
      activityLegacyId,
    );
    const entitlement = await this.resolveEntitlementAfterConsume(
      actor,
      activityLegacyId,
    );
    return { ok: true, bucket, entitlement };
  }

  private async consumeContactUnlockQuota(
    actor: RequestActor,
    activityLegacyId: number | undefined,
  ): Promise<EntitlementConsumeBucket> {
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      throw new BadRequestException('activityLegacyId is required');
    }

    const ownerId = resolveProfilePackageOwnerFromActor(actor);
    const freeUsage =
      await this.profileFreeQuotaService.getFreeMonthlyForUser(ownerId);

    const paid = await this.loadPaidEntitlement(ownerId, activityLegacyId);

    const bucket = resolveContactUnlockConsumeBucket(
      freeUsage,
      paid?.limits ?? null,
      paid?.usage ?? null,
    );

    if (!bucket) {
      throw new ForbiddenException('Contact unlock quota exhausted');
    }

    if (bucket === 'free') {
      await this.profileFreeQuotaService.incrementContactUnlockUsed(ownerId);
      return 'free';
    }

    if (!paid) {
      throw new ForbiddenException('Contact unlock quota exhausted');
    }

    const limits = paid.limits;
    if (limits.contactUnlockCount != null) {
      await this.entitlementModel
        .findOneAndUpdate(
          { userId: ownerId, activityLegacyId },
          { $inc: { 'usage.contactUnlockUsed': 1 } },
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
    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
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
        contactUnlockUsed: record.usage?.contactUnlockUsed ?? 0,
        postPinUsed: record.usage?.postPinUsed ?? 0,
      },
    };
  }

  private async resolveEntitlementAfterConsume(
    actor: RequestActor,
    activityLegacyId: number | undefined,
  ): Promise<EventPackageEntitlementDto> {
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      throw new BadRequestException('activityLegacyId is required');
    }

    const entitlement =
      await this.profilePackageService.getEntitlementForActivity(
        actor,
        activityLegacyId,
      );
    if (!entitlement) {
      throw new BadRequestException('Entitlement not found for activity');
    }
    return entitlement;
  }
}
