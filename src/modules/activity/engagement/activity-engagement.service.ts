import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import {
  UserActivityEngagement,
  UserActivityEngagementDocument,
} from '../../../database/schemas/user-activity-engagement.schema';
import type { ActivityEngagementAction } from './dto/record-activity-engagement.dto';

export type ActivityEngagementRecord = {
  userId: string;
  activityLegacyId: number;
  lineupViewedAt?: string;
};

@Injectable()
export class ActivityEngagementService {
  constructor(
    @InjectModel(UserActivityEngagement.name)
    private readonly model: Model<UserActivityEngagementDocument>,
  ) {}

  async getEngagement(
    userId: string,
    activityLegacyId: number,
  ): Promise<ActivityEngagementRecord | null> {
    const uid = userId?.trim();
    if (!uid || !Number.isFinite(activityLegacyId) || activityLegacyId <= 0) {
      return null;
    }

    const doc = await this.model
      .findOne({ userId: uid, activityLegacyId })
      .lean()
      .exec();
    if (!doc) return null;

    return {
      userId: doc.userId,
      activityLegacyId: doc.activityLegacyId,
      lineupViewedAt: doc.lineupViewedAt,
    };
  }

  async record(
    actor: RequestActor,
    activityLegacyId: number,
    action: ActivityEngagementAction,
  ): Promise<{ ok: true }> {
    const userId = actor.resolvedUserId?.trim();
    if (
      !userId ||
      !Number.isFinite(activityLegacyId) ||
      activityLegacyId <= 0
    ) {
      return { ok: true };
    }

    if (action !== 'lineup_viewed') {
      return { ok: true };
    }

    const now = new Date().toISOString();

    await this.model.updateOne(
      { userId, activityLegacyId },
      {
        $set: {
          userId,
          activityLegacyId,
          lineupViewedAt: now,
        },
      },
      { upsert: true },
    );

    return { ok: true };
  }

  async markLineupViewed(
    actor: RequestActor,
    activityLegacyId: number,
  ): Promise<void> {
    await this.record(actor, activityLegacyId, 'lineup_viewed');
  }
}
