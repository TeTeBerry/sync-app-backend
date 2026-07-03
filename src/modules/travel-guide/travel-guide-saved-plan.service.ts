import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanDocument,
} from '../../database/schemas/travel-guide-saved-plan.schema';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import type {
  AiGuidePlanFormValues,
  TravelGuideBudgetTier,
  TravelGuidePlan,
  TravelGuidePlanReadResult,
} from '@sync/travel-guide-contracts';
import { resolveTravelGuideBudgetTier } from './domain/parse-activity-days.util';
import { BffReadCacheInvalidationService } from '../../infra/cache/bff-read-cache.service';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { UserGoalService } from '../goal/goal.service';
import { TripPlanCollaborationService } from '../trip-plan/trip-plan-collaboration.service';

export type TravelGuideSavedPlanView = TravelGuidePlanReadResult;

@Injectable()
export class TravelGuideSavedPlanService {
  private readonly ttlSec: number;

  constructor(
    @InjectModel(TravelGuideSavedPlan.name)
    private readonly model: Model<TravelGuideSavedPlanDocument>,
    config: ConfigService,
    private readonly bffCacheInvalidation: BffReadCacheInvalidationService,
    private readonly goalService: UserGoalService,
    private readonly tripPlanCollaboration: TripPlanCollaborationService,
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
    actor?: RequestActor,
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

    if (actor) {
      await this.goalService.subscribeOnEngagement(actor, activityLegacyId);
      await this.tripPlanCollaboration.linkGuideForActivity(
        actor,
        activityLegacyId,
        id,
      );
    }
  }

  async findLatestByOwnerAndActivity(
    ownerUserId: string,
    activityLegacyId: number,
  ): Promise<{ guideId: string; form: AiGuidePlanFormValues } | null> {
    const doc = await this.model
      .findOne({ ownerUserId, activityLegacyId })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    if (!doc?.guideId?.trim()) return null;
    return {
      guideId: doc.guideId.trim(),
      form: doc.form,
    };
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

  async findOwnedByGuideId(
    guideId: string,
    ownerUserId: string,
  ): Promise<(TravelGuideSavedPlanView & { ownerUserId: string }) | null> {
    const id = guideId.trim();
    if (!id) return null;

    const doc = await this.model.findOne({ guideId: id }).lean().exec();
    if (!doc || doc.ownerUserId !== ownerUserId) return null;

    return {
      guideId: doc.guideId,
      activityLegacyId: doc.activityLegacyId,
      ownerUserId: doc.ownerUserId,
      form: doc.form,
      plan: doc.plan,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date().toISOString(),
    };
  }

  async findAccessibleByGuideId(
    guideId: string,
    actor: RequestActor,
  ): Promise<(TravelGuideSavedPlanView & { ownerUserId: string }) | null> {
    const id = guideId.trim();
    if (!id) return null;

    const doc = await this.model.findOne({ guideId: id }).lean().exec();
    if (!doc) return null;

    const userId = actor.resolvedUserId?.trim();
    if (doc.ownerUserId === userId) {
      return {
        guideId: doc.guideId,
        activityLegacyId: doc.activityLegacyId,
        ownerUserId: doc.ownerUserId,
        form: doc.form,
        plan: doc.plan,
        createdAt:
          doc.createdAt instanceof Date
            ? doc.createdAt.toISOString()
            : new Date().toISOString(),
      };
    }

    await this.tripPlanCollaboration.assertGuideAccess(id, actor);
    return {
      guideId: doc.guideId,
      activityLegacyId: doc.activityLegacyId,
      ownerUserId: doc.ownerUserId,
      form: doc.form,
      plan: doc.plan,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date().toISOString(),
    };
  }

  async updateForm(
    guideId: string,
    actor: RequestActor,
    patch: Partial<AiGuidePlanFormValues>,
  ): Promise<TravelGuideSavedPlanView | null> {
    const saved = await this.findAccessibleByGuideId(guideId, actor);
    if (!saved) return null;

    const form: AiGuidePlanFormValues = { ...saved.form };

    if (patch.departure !== undefined) {
      form.departure = patch.departure.trim();
    }
    if (patch.departureCity !== undefined) {
      const city = patch.departureCity.trim();
      if (city) form.departureCity = city;
      else delete form.departureCity;
    }
    if (patch.headcount !== undefined) form.headcount = patch.headcount;
    if (patch.budgetTier !== undefined) form.budgetTier = patch.budgetTier;
    if (patch.selfDrive !== undefined) form.selfDrive = patch.selfDrive;
    if (patch.accommodationNights !== undefined) {
      form.accommodationNights = patch.accommodationNights;
    }
    if (patch.note !== undefined) {
      const note = patch.note.trim();
      if (note) form.note = note;
      else delete form.note;
    }

    await this.model.updateOne({ guideId: guideId.trim() }, { $set: { form } });

    await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
      saved.ownerUserId,
      saved.activityLegacyId,
    );

    return {
      guideId: saved.guideId,
      activityLegacyId: saved.activityLegacyId,
      form,
      plan: saved.plan,
      createdAt: saved.createdAt,
    };
  }

  async updatePlan(guideId: string, plan: TravelGuidePlan): Promise<void> {
    const id = guideId.trim();
    if (!id) return;
    await this.model.updateOne({ guideId: id }, { $set: { plan } });
  }

  async updateBudgetTier(
    guideId: string,
    ownerUserId: string,
    budgetTier: TravelGuideBudgetTier,
    plan: TravelGuidePlan,
  ): Promise<TravelGuideSavedPlanView | null> {
    const id = guideId.trim();
    if (!id) return null;

    const doc = await this.model.findOne({ guideId: id }).lean().exec();
    if (!doc || doc.ownerUserId !== ownerUserId) return null;

    const form = {
      ...doc.form,
      budgetTier,
    };

    await this.model.updateOne({ guideId: id }, { $set: { form, plan } });

    await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
      ownerUserId,
      doc.activityLegacyId,
    );

    return {
      guideId: doc.guideId,
      activityLegacyId: doc.activityLegacyId,
      form,
      plan,
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
): AiGuidePlanFormValues {
  return {
    departure: dto.departure.trim(),
    ...(dto.departureCity?.trim()
      ? { departureCity: dto.departureCity.trim() }
      : {}),
    headcount: dto.headcount,
    budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    ...(dto.selfDrive != null ? { selfDrive: dto.selfDrive } : {}),
    accommodationNights,
    ...(dto.note?.trim() ? { note: dto.note.trim() } : {}),
  };
}
