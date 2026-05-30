import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserFreeQuota,
  UserFreeQuotaDocument,
} from '../../database/schemas/user-free-quota.schema';
import type { QuotaSlot } from './domain/event-entitlement.util';
import {
  FREE_MONTHLY_AI_MATCH_LIMIT,
  FREE_MONTHLY_CONTACT_UNLOCK_LIMIT,
} from './domain/free-tier.config';
import {
  buildFreeMonthlyQuotaSlots,
  formatQuotaPeriod,
  normalizeFreeMonthlyUsage,
  type FreeMonthlyUsage,
} from './domain/free-quota.util';

export interface FreeMonthlyQuotaDto {
  period: string;
  aiMatch: QuotaSlot;
  contactUnlock: QuotaSlot;
}

@Injectable()
export class ProfileFreeQuotaService {
  constructor(
    @InjectModel(UserFreeQuota.name)
    private readonly freeQuotaModel: Model<UserFreeQuotaDocument>,
  ) {}

  async incrementAiMatchUsed(userId: string): Promise<FreeMonthlyUsage> {
    const usage = await this.getFreeMonthlyForUser(userId);
    const updated: FreeMonthlyUsage = {
      ...usage,
      aiMatchUsed: usage.aiMatchUsed + 1,
    };
    await this.freeQuotaModel
      .findOneAndUpdate(
        { userId },
        {
          userId,
          period: updated.period,
          aiMatchUsed: updated.aiMatchUsed,
          contactUnlockUsed: updated.contactUnlockUsed,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
    return updated;
  }

  async incrementContactUnlockUsed(userId: string): Promise<FreeMonthlyUsage> {
    const usage = await this.getFreeMonthlyForUser(userId);
    const updated: FreeMonthlyUsage = {
      ...usage,
      contactUnlockUsed: usage.contactUnlockUsed + 1,
    };
    await this.freeQuotaModel
      .findOneAndUpdate(
        { userId },
        {
          userId,
          period: updated.period,
          aiMatchUsed: updated.aiMatchUsed,
          contactUnlockUsed: updated.contactUnlockUsed,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
    return updated;
  }

  async getFreeMonthlyForUser(userId: string): Promise<FreeMonthlyUsage> {
    const now = new Date();
    const period = formatQuotaPeriod(now);
    const record = await this.freeQuotaModel.findOne({ userId }).lean().exec();
    const usage = normalizeFreeMonthlyUsage(record ?? undefined, now);

    if (!record || record.period !== period) {
      await this.freeQuotaModel
        .findOneAndUpdate(
          { userId },
          {
            userId,
            period: usage.period,
            aiMatchUsed: usage.aiMatchUsed,
            contactUnlockUsed: usage.contactUnlockUsed,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .exec();
    }

    return usage;
  }

  toDto(usage: FreeMonthlyUsage): FreeMonthlyQuotaDto {
    const slots = buildFreeMonthlyQuotaSlots(usage);
    return {
      period: usage.period,
      aiMatch: slots.aiMatch,
      contactUnlock: slots.contactUnlock,
    };
  }

  static readonly limits = {
    aiMatch: FREE_MONTHLY_AI_MATCH_LIMIT,
    contactUnlock: FREE_MONTHLY_CONTACT_UNLOCK_LIMIT,
  };
}
