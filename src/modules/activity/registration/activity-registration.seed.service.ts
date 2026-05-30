import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ActivityRegistration,
  ActivityRegistrationDocument,
} from '../../../database/schemas/activity-registration.schema';
import { ACTIVITY_REGISTRATION_SEED } from './activity-registration.seed';

@Injectable()
export class ActivityRegistrationSeedService implements OnModuleInit {
  constructor(
    @InjectModel(ActivityRegistration.name)
    private readonly registrationModel: Model<ActivityRegistrationDocument>,
  ) {}

  async onModuleInit() {
    await this.registrationModel.deleteMany({
      activityLegacyId: { $in: [3, 7] },
    });
    for (const item of ACTIVITY_REGISTRATION_SEED) {
      await this.registrationModel.findOneAndUpdate(
        { userId: item.userId, activityLegacyId: item.activityLegacyId },
        item,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }
}
