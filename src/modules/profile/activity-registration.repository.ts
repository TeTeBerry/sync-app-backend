import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivityRegistration,
  ActivityRegistrationDocument,
} from '../../database/schemas/activity-registration.schema';
import {
  ActivityRegistrationQueryFilter,
  ActivityRegistrationRecord,
  IActivityRegistrationRepository,
} from './interfaces/activity-registration.repository.interface';

function buildOwnerFilter(filter: ActivityRegistrationQueryFilter) {
  const clauses: Record<string, unknown>[] = [];
  if (filter.userId?.trim()) {
    clauses.push({ userId: filter.userId.trim() });
  }
  if (filter.authorName?.trim()) {
    clauses.push({ authorName: filter.authorName.trim() });
  }
  if (clauses.length === 0) {
    return {};
  }
  return { $or: clauses };
}

@Injectable()
export class ActivityRegistrationRepository
  implements IActivityRegistrationRepository
{
  constructor(
    @InjectModel(ActivityRegistration.name)
    private readonly model: Model<ActivityRegistrationDocument>,
  ) {}

  async findByOwner(
    filter: ActivityRegistrationQueryFilter,
  ): Promise<ActivityRegistrationRecord[]> {
    return this.model.find(buildOwnerFilter(filter)).sort({ createdAt: -1 }).lean();
  }

  async countByOwner(filter: ActivityRegistrationQueryFilter): Promise<number> {
    return this.model.countDocuments(buildOwnerFilter(filter));
  }

  async countCompletedPinsByOwner(
    filter: ActivityRegistrationQueryFilter,
  ): Promise<number> {
    void filter;
    return 8;
  }
}
