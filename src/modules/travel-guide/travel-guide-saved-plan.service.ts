import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanDocument,
} from '../../database/schemas/travel-guide-saved-plan.schema';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import type { TravelGuidePlan } from './domain/travel-guide.types';
import { BffReadCacheInvalidationService } from '../../infra/cache/bff-read-cache.service';

export type TravelGuideSavedPlanView = {
  guideId: string;
  activityLegacyId: number;
  form: Record<string, unknown>;
  plan: TravelGuidePlan;
  createdAt: string;
};

@Injectable()
export class TravelGuideSavedPlanService {
  private readonly ttlSec: number;

  constructor(
    @InjectModel(TravelGuideSavedPlan.name)
    private readonly model: Model<TravelGuideSavedPlanDocument>,
    config: ConfigService,
    private readonly bffCacheInvalidation: BffReadCacheInvalidationService,
  ) {
    this.ttlSec =
      config.get<number>('travelGuide.savedPlanTtlSec') ?? 2_592_000;
  }

  async upsert(
    guideId: string,
    ownerUserId: string,
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    plan: TravelGuidePlan,
  ): Promise<void> {
    const id = guideId.trim();
    if (!id) return;

    const expiresAt = new Date(Date.now() + this.ttlSec * 1000);
    const form = buildSavedPlanForm(dto, accommodationNights);

    await this.model.updateOne(
      { guideId: id },
      {
        $set: {
          guideId: id,
          ownerUserId,
          activityLegacyId,
          form,
          plan,
          expiresAt,
        },
      },
      { upsert: true },
    );

    await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
      ownerUserId,
      activityLegacyId,
    );
  }

  async findLatestByOwnerAndActivity(
    ownerUserId: string,
    activityLegacyId: number,
  ): Promise<{ guideId: string } | null> {
    const doc = await this.model
      .findOne({ ownerUserId, activityLegacyId })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (!doc?.guideId?.trim()) return null;
    return { guideId: doc.guideId.trim() };
  }

  async findByGuideId(
    guideId: string,
  ): Promise<TravelGuideSavedPlanView | null> {
    const id = guideId.trim();
    if (!id) return null;

    const doc = await this.model.findOne({ guideId: id }).lean().exec();
    if (!doc) return null;

    return {
      guideId: doc.guideId,
      activityLegacyId: doc.activityLegacyId,
      form: doc.form,
      plan: doc.plan,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date().toISOString(),
    };
  }
}

function buildSavedPlanForm(
  dto: GenerateTravelGuideDto,
  accommodationNights: number,
): Record<string, unknown> {
  return {
    departure: dto.departure.trim(),
    ...(dto.departureCity?.trim()
      ? { departureCity: dto.departureCity.trim() }
      : {}),
    headcount: dto.headcount,
    budgetTier: dto.budgetTier,
    ...(dto.selfDrive != null ? { selfDrive: dto.selfDrive } : {}),
    accommodationNights,
  };
}
