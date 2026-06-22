import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivityRegistration,
  ActivityRegistrationDocument,
} from '../../../database/schemas/activity-registration.schema';
import { buildOwnerMongoFilter } from '../../../common/utils/demo-owner.util';
import {
  ActivityRegistrationQueryFilter,
  ActivityRegistrationRecord,
  CreateActivityRegistrationInput,
  IActivityRegistrationRepository,
} from './interfaces/activity-registration.repository.interface';

function buildOwnerFilter(filter: ActivityRegistrationQueryFilter) {
  return buildOwnerMongoFilter(filter.userId, filter.authorName);
}

@Injectable()
export class ActivityRegistrationRepository implements IActivityRegistrationRepository {
  constructor(
    @InjectModel(ActivityRegistration.name)
    private readonly model: Model<ActivityRegistrationDocument>,
  ) {}

  async findByOwner(
    filter: ActivityRegistrationQueryFilter,
  ): Promise<ActivityRegistrationRecord[]> {
    return this.model
      .find(buildOwnerFilter(filter))
      .sort({ createdAt: -1 })
      .lean();
  }

  async countByOwner(filter: ActivityRegistrationQueryFilter): Promise<number> {
    return this.model.countDocuments(buildOwnerFilter(filter));
  }

  async findByOwnerAndActivity(
    filter: ActivityRegistrationQueryFilter,
    activityLegacyId: number,
  ): Promise<ActivityRegistrationRecord | null> {
    return this.model
      .findOne({ ...buildOwnerFilter(filter), activityLegacyId })
      .lean();
  }

  async create(
    input: CreateActivityRegistrationInput,
  ): Promise<ActivityRegistrationRecord> {
    const created = await this.model.create(input);
    return created.toObject() as ActivityRegistrationRecord;
  }

  async findRegisteredUserIds(activityLegacyId: number): Promise<string[]> {
    const rows = await this.model
      .find({ activityLegacyId, status: 'registered' })
      .select('userId')
      .lean();
    return [...new Set(rows.map((row) => row.userId).filter(Boolean))];
  }

  async findWechatActivityUpdateOptInUserIds(
    activityLegacyId: number,
  ): Promise<string[]> {
    const rows = await this.model
      .find({
        activityLegacyId,
        status: 'registered',
        wechatActivityUpdateOptIn: true,
      })
      .select('userId')
      .lean();
    return [...new Set(rows.map((row) => row.userId).filter(Boolean))];
  }

  async setWechatActivityUpdateOptIn(
    filter: ActivityRegistrationQueryFilter,
    activityLegacyId: number,
  ): Promise<boolean> {
    const result = await this.model.updateOne(
      { ...buildOwnerFilter(filter), activityLegacyId, status: 'registered' },
      { $set: { wechatActivityUpdateOptIn: true } },
    );
    return (result.matchedCount ?? 0) > 0;
  }

  async deleteByOwnerAndActivity(
    filter: ActivityRegistrationQueryFilter,
    activityLegacyId: number,
  ): Promise<boolean> {
    const result = await this.model.deleteOne({
      ...buildOwnerFilter(filter),
      activityLegacyId,
    });
    return (result.deletedCount ?? 0) > 0;
  }
}
