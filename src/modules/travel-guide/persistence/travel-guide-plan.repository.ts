import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanDocument,
} from '../../../database/schemas/travel-guide-saved-plan.schema';
import type {
  AiGuidePlanFormValues,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';

export interface TravelGuidePlanRecord {
  guideId: string;
  ownerUserId: string;
  activityLegacyId: number;
  form: AiGuidePlanFormValues;
  plan: TravelGuidePlan;
  expiresAt: Date;
  tripPlanId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Mongo persistence for saved travel-guide plans.
 * Business rules (ownership, goals, collab) stay in TravelGuideSavedPlanService.
 */
@Injectable()
export class TravelGuidePlanRepository {
  constructor(
    @InjectModel(TravelGuideSavedPlan.name)
    private readonly model: Model<TravelGuideSavedPlanDocument>,
  ) {}

  async upsertPlan(input: {
    guideId: string;
    ownerUserId: string;
    activityLegacyId: number;
    form: AiGuidePlanFormValues;
    plan: TravelGuidePlan;
    expiresAt: Date;
  }): Promise<void> {
    await this.model.updateOne(
      { guideId: input.guideId },
      {
        $set: {
          guideId: input.guideId,
          ownerUserId: input.ownerUserId,
          activityLegacyId: input.activityLegacyId,
          form: input.form,
          plan: input.plan,
          expiresAt: input.expiresAt,
        },
      },
      { upsert: true },
    );
  }

  async findByGuideId(guideId: string): Promise<TravelGuidePlanRecord | null> {
    const doc = await this.model.findOne({ guideId }).lean().exec();
    if (!doc?.guideId) return null;
    return mapPlanRecord(doc);
  }

  async updatePlan(guideId: string, plan: TravelGuidePlan): Promise<boolean> {
    const result = await this.model
      .updateOne({ guideId }, { $set: { plan } })
      .exec();
    return result.modifiedCount > 0 || result.matchedCount > 0;
  }

  /** Atomically transfer only an anonymous guide to the authenticated owner. */
  async claimPublicPlan(
    guideId: string,
    publicOwnerUserId: string,
    ownerUserId: string,
  ): Promise<TravelGuidePlanRecord | null> {
    const doc = await this.model
      .findOneAndUpdate(
        { guideId, ownerUserId: publicOwnerUserId },
        { $set: { ownerUserId } },
        { new: true },
      )
      .lean()
      .exec();
    return doc?.guideId ? mapPlanRecord(doc) : null;
  }

  async updateBudgetTier(
    guideId: string,
    ownerUserId: string,
    form: AiGuidePlanFormValues,
    plan: TravelGuidePlan,
  ): Promise<TravelGuidePlanRecord | null> {
    const doc = await this.model
      .findOneAndUpdate(
        { guideId, ownerUserId },
        { $set: { form, plan } },
        { new: true },
      )
      .lean()
      .exec();
    if (!doc?.guideId) return null;
    return mapPlanRecord(doc);
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

  async listByOwner(
    ownerUserId: string,
    limit = 20,
  ): Promise<TravelGuidePlanRecord[]> {
    const docs = await this.model
      .find({ ownerUserId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return docs.map((doc) => mapPlanRecord(doc));
  }
}

function mapPlanRecord(doc: {
  guideId: string;
  ownerUserId: string;
  activityLegacyId: number;
  form: AiGuidePlanFormValues;
  plan: TravelGuidePlan;
  expiresAt: Date;
  tripPlanId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}): TravelGuidePlanRecord {
  return {
    guideId: doc.guideId,
    ownerUserId: doc.ownerUserId,
    activityLegacyId: doc.activityLegacyId,
    form: doc.form,
    plan: doc.plan as TravelGuidePlan,
    expiresAt: doc.expiresAt,
    tripPlanId: doc.tripPlanId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
