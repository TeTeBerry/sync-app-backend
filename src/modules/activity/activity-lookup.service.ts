import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Activity,
  ActivityDocument,
} from '../../database/schemas/activity.schema';
import type {
  ActivityLookupRecord,
  IActivityLookupPort,
} from './ports/activity-lookup.port';

@Injectable()
export class ActivityLookupService implements IActivityLookupPort {
  constructor(
    @InjectModel(Activity.name) private readonly model: Model<ActivityDocument>,
  ) {}

  findAll() {
    return this.model.find().sort({ legacyId: 1 }).lean() as Promise<
      ActivityLookupRecord[]
    >;
  }

  findByLegacyId(legacyId: number) {
    return this.model
      .findOne({ legacyId })
      .lean() as Promise<ActivityLookupRecord | null>;
  }
}
