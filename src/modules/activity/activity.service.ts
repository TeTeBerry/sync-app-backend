import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Activity,
  ActivityDocument,
} from '../../database/schemas/activity.schema';
import { ACTIVITY_SEED } from './activity.seed';

@Injectable()
export class ActivityService implements OnModuleInit {
  constructor(
    @InjectModel(Activity.name) private model: Model<ActivityDocument>,
  ) {}

  async onModuleInit() {
    await this.initData();
  }

  async initData() {
    for (const item of ACTIVITY_SEED) {
      await this.model.findOneAndUpdate({ code: item.code }, item, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    }
  }

  health() {
    return { ok: true, scope: 'activity' };
  }

  findAll() {
    return this.model.find().sort({ legacyId: 1 }).lean();
  }

  findByLegacyId(legacyId: number) {
    return this.model.findOne({ legacyId }).lean();
  }

  resolveActivityRef(activityRef?: string | number) {
    if (activityRef == null || activityRef === '') {
      return undefined;
    }

    const asNumber = Number(activityRef);
    if (!Number.isNaN(asNumber) && String(asNumber) === String(activityRef)) {
      return { activityLegacyId: asNumber };
    }

    return { activityId: String(activityRef).toLowerCase() };
  }

  async matchActivity(keyword: string) {
    const kw = keyword.toLowerCase().trim();
    if (!kw) return null;

    const asNumber = Number(kw);
    if (!Number.isNaN(asNumber)) {
      const byLegacy = await this.model.findOne({ legacyId: asNumber }).lean();
      if (byLegacy) return byLegacy;
    }

    return this.model
      .findOne({
        $or: [
          { code: kw },
          { name: { $regex: kw, $options: 'i' } },
          { alias: { $in: [new RegExp(kw, 'i')] } },
        ],
      })
      .lean();
  }
}
