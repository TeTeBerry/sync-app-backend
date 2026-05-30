import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventPackageEntitlement,
  EventPackageEntitlementDocument,
} from '../../database/schemas/event-package-entitlement.schema';
import { ActivityService } from '../activity/activity.service';
import {
  computeMapExpiresAt,
  computePackageValidUntil,
  createEmptyUsage,
  isPackageEntitlementActive,
  resolveRecordValidUntil,
  type EventEntitlementQuotas,
  type EventEntitlementUsage,
} from './domain/event-entitlement.util';
import {
  FREE_TIER_ID,
  FREE_TIER_NAME,
} from './domain/free-tier.config';
import {
  isMockProfileUser,
  MOCK_PROFILE_SEED_ACTIVITY_LEGACY_ID,
  MOCK_PROFILE_SEED_USER_ID,
  resolveProfilePackageOwnerId,
} from './domain/mock-profile-user.util';
import { mergeFreeAndPaidQuotas } from './domain/merged-entitlement.util';
import {
  getPackageTierDefinition,
  listPackageTierDefinitions,
  type PackageTierDefinition,
  type PackageTierLimits,
} from './domain/package-tier.config';
import type { PackageTierId } from './domain/package-tier-id.type';
import { isPackageTierId } from './domain/package-tier-id.type';
import type { FreeMonthlyUsage } from './domain/free-quota.util';
import {
  ProfileFreeQuotaService,
  type FreeMonthlyQuotaDto,
} from './profile-free-quota.service';

export interface PackageCatalogDto {
  sheet: {
    title: string;
    subtitle: string;
    defaultTierId: PackageTierId;
  };
  tiers: PackageTierDefinition[];
}

export type ProfileEntitlementTierId = PackageTierId | typeof FREE_TIER_ID;

export interface EventPackageEntitlementDto {
  activityLegacyId: number;
  tierId: ProfileEntitlementTierId;
  tierName: string;
  /** ISO timestamp when paid tier was purchased; omitted for free-only view. */
  purchasedAt?: string;
  /** ISO start of 30-day package window (usually equals purchasedAt). */
  validFrom?: string;
  /** ISO end of 30-day package window (purchasedAt + 30 days UTC). */
  validUntil?: string;
  quotas: EventEntitlementQuotas;
  /** Global monthly free bucket (always included). */
  freeMonthly: FreeMonthlyQuotaDto;
  /** Paid per-event tier when present. */
  paidTierId?: PackageTierId | null;
}

export interface PurchaseProfilePackageResultDto {
  ok: true;
  stubPayment: true;
  entitlement: EventPackageEntitlementDto;
}

@Injectable()
export class ProfilePackageService implements OnModuleInit {
  constructor(
    @InjectModel(EventPackageEntitlement.name)
    private readonly entitlementModel: Model<EventPackageEntitlementDocument>,
    private readonly activityService: ActivityService,
    private readonly profileFreeQuotaService: ProfileFreeQuotaService,
  ) {}

  async onModuleInit() {
    await this.seedMockUserProEntitlement();
  }

  getPackageCatalog(): PackageCatalogDto {
    return {
      sheet: {
        title: '单场套餐',
        subtitle: '按场购买，灵活使用，无订阅压力',
        defaultTierId: 'pro_plus',
      },
      tiers: listPackageTierDefinitions(),
    };
  }

  async listEntitlements(
    userId?: string,
    authorName?: string,
    activityLegacyId?: number,
  ): Promise<EventPackageEntitlementDto[]> {
    const ownerId = resolveProfilePackageOwnerId(userId, authorName);
    const freeUsage = await this.profileFreeQuotaService.getFreeMonthlyForUser(
      ownerId,
    );

    const filter: Record<string, unknown> = { userId: ownerId };
    if (activityLegacyId != null && !Number.isNaN(activityLegacyId)) {
      filter.activityLegacyId = activityLegacyId;
    }

    const records = await this.entitlementModel
      .find(filter)
      .sort({ purchasedAt: -1 })
      .lean()
      .exec();

    if (records.length === 0) {
      const legacyId =
        activityLegacyId != null && !Number.isNaN(activityLegacyId)
          ? activityLegacyId
          : MOCK_PROFILE_SEED_ACTIVITY_LEGACY_ID;
      return [this.buildFreeOnlyDto(legacyId, freeUsage)];
    }

    return records.map(record =>
      this.toEntitlementDto(record, freeUsage),
    );
  }

  async getEntitlementForActivity(
    userId: string | undefined,
    authorName: string | undefined,
    activityLegacyId: number,
  ): Promise<EventPackageEntitlementDto | null> {
    const ownerId = resolveProfilePackageOwnerId(userId, authorName);
    const freeUsage = await this.profileFreeQuotaService.getFreeMonthlyForUser(
      ownerId,
    );

    const record = await this.entitlementModel
      .findOne({ userId: ownerId, activityLegacyId })
      .lean()
      .exec();

    if (!record) {
      return this.buildFreeOnlyDto(activityLegacyId, freeUsage);
    }

    return this.toEntitlementDto(record, freeUsage);
  }

  /**
   * Stub purchase: grants or replaces per-event entitlement without WeChat Pay.
   */
  async purchasePackage(
    tierId: string,
    activityLegacyId: number,
    userId?: string,
    authorName?: string,
  ): Promise<PurchaseProfilePackageResultDto> {
    if (!isPackageTierId(tierId)) {
      throw new BadRequestException(`Invalid tierId: ${tierId}`);
    }

    const activity = await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity not found: ${activityLegacyId}`);
    }

    const tier = getPackageTierDefinition(tierId);
    const ownerId = resolveProfilePackageOwnerId(userId, authorName);
    const freeUsage = await this.profileFreeQuotaService.getFreeMonthlyForUser(
      ownerId,
    );
    const purchasedAt = new Date();
    const validFrom = purchasedAt;
    const validUntil = computePackageValidUntil(purchasedAt);
    const mapExpiresAt = computeMapExpiresAt(
      purchasedAt,
      tier.limits.mapDays,
      validUntil,
    );
    const author = authorName?.trim();

    const record = await this.entitlementModel
      .findOneAndUpdate(
        { userId: ownerId, activityLegacyId },
        {
          userId: ownerId,
          authorName: author,
          activityLegacyId,
          tierId,
          purchasedAt,
          validFrom,
          validUntil,
          mapExpiresAt,
          usage: createEmptyUsage(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean()
      .exec();

    return {
      ok: true,
      stubPayment: true,
      entitlement: this.toEntitlementDto(record, freeUsage),
    };
  }

  private buildFreeOnlyDto(
    activityLegacyId: number,
    freeUsage: FreeMonthlyUsage,
  ): EventPackageEntitlementDto {
    const freeMonthly = this.profileFreeQuotaService.toDto(freeUsage);
    const quotas = mergeFreeAndPaidQuotas(freeUsage, null, null, null);
    return {
      activityLegacyId,
      tierId: FREE_TIER_ID,
      tierName: FREE_TIER_NAME,
      quotas,
      freeMonthly,
      paidTierId: null,
    };
  }

  private toEntitlementDto(
    record: Pick<
      EventPackageEntitlement,
      | 'activityLegacyId'
      | 'tierId'
      | 'purchasedAt'
      | 'validFrom'
      | 'validUntil'
      | 'mapExpiresAt'
      | 'usage'
    >,
    freeUsage: FreeMonthlyUsage,
  ): EventPackageEntitlementDto {
    const usage = this.normalizeUsage(record.usage);
    const tier = getPackageTierDefinition(record.tierId);
    const purchasedAt = new Date(record.purchasedAt);
    const validFrom = record.validFrom
      ? new Date(record.validFrom)
      : purchasedAt;
    const validUntil = resolveRecordValidUntil(record);
    const now = new Date();
    const packageActive = isPackageEntitlementActive(validUntil, now);
    const quotas = mergeFreeAndPaidQuotas(
      freeUsage,
      packageActive ? tier.limits : null,
      packageActive ? usage : null,
      packageActive ? new Date(record.mapExpiresAt) : null,
      now,
    );
    const freeMonthly = this.profileFreeQuotaService.toDto(freeUsage);

    return {
      activityLegacyId: record.activityLegacyId,
      tierId: record.tierId,
      tierName: tier.name,
      purchasedAt: purchasedAt.toISOString(),
      validFrom: validFrom.toISOString(),
      validUntil: validUntil.toISOString(),
      quotas,
      freeMonthly,
      paidTierId: record.tierId,
    };
  }

  private normalizeUsage(
    usage?: EventEntitlementUsage | null,
  ): EventEntitlementUsage {
    return {
      aiMatchUsed: usage?.aiMatchUsed ?? 0,
      contactUnlockUsed: usage?.contactUnlockUsed ?? 0,
      postPinUsed: usage?.postPinUsed ?? 0,
    };
  }

  private async seedMockUserProEntitlement(): Promise<void> {
    const tier = getPackageTierDefinition('pro');
    const purchasedAt = new Date();
    const validFrom = purchasedAt;
    const validUntil = computePackageValidUntil(purchasedAt);
    const mapExpiresAt = computeMapExpiresAt(
      purchasedAt,
      tier.limits.mapDays,
      validUntil,
    );
    const seedKey = {
      userId: MOCK_PROFILE_SEED_USER_ID,
      activityLegacyId: MOCK_PROFILE_SEED_ACTIVITY_LEGACY_ID,
    };

    await this.entitlementModel.deleteMany({
      ...seedKey,
      tierId: { $ne: 'pro' },
    });

    // Drop legacy Tomorrowland (activity 1) demo Pro after seed moved to 风暴电音节.
    await this.entitlementModel.deleteMany({
      userId: MOCK_PROFILE_SEED_USER_ID,
      activityLegacyId: 1,
      tierId: 'pro',
    });

    await this.entitlementModel
      .findOneAndUpdate(
        seedKey,
        {
          ...seedKey,
          authorName: 'Zara Chen',
          tierId: 'pro',
          purchasedAt,
          validFrom,
          validUntil,
          mapExpiresAt,
          usage: createEmptyUsage(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  /** Whether the request should resolve to the seeded demo entitlement. */
  isMockProfileRequest(userId?: string, authorName?: string): boolean {
    return isMockProfileUser(userId, authorName);
  }
}
