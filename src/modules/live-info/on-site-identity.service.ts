import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventLiveWristband,
  EventLiveWristbandDocument,
} from '../../database/schemas/event-live-wristband.schema';
import { shanghaiEventDate } from './domain/live-info-date.util';

@Injectable()
export class OnSiteIdentityService {
  constructor(
    @InjectModel(EventLiveWristband.name)
    private readonly wristbandModel: Model<EventLiveWristbandDocument>,
  ) {}

  async isUserOnSiteCertified(
    userId: string,
    activityLegacyId: number,
    eventDate = shanghaiEventDate(),
  ): Promise<boolean> {
    const uid = userId?.trim();
    if (!uid || !Number.isFinite(activityLegacyId)) return false;

    const wristband = await this.wristbandModel
      .findOne({
        userId: uid,
        activityLegacyId,
        eventDate,
        status: 'approved',
        validUntil: { $gt: new Date() },
      })
      .select('_id')
      .lean();

    return Boolean(wristband);
  }

  async getOnSiteCertifiedUserIds(
    activityLegacyId: number,
    userIds: string[],
    eventDate = shanghaiEventDate(),
  ): Promise<Set<string>> {
    const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length || !Number.isFinite(activityLegacyId)) {
      return new Set();
    }

    const rows = await this.wristbandModel
      .find({
        userId: { $in: unique },
        activityLegacyId,
        eventDate,
        status: 'approved',
        validUntil: { $gt: new Date() },
      })
      .select('userId')
      .lean();

    return new Set(rows.map((row) => row.userId));
  }
}
