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

  findByCode(code: string) {
    return this.model.findOne({ code: code.toLowerCase().trim() }).lean();
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

    const byExact = await this.model
      .findOne({
        $or: [
          { code: kw },
          { name: { $regex: kw, $options: 'i' } },
          { alias: { $in: [new RegExp(kw, 'i')] } },
        ],
      })
      .lean();
    if (byExact) return byExact;

    if (/edc/.test(kw) && /泰国|thailand|泰國|曼谷|pattaya|芭提雅/.test(kw)) {
      const thailand = await this.model.findOne({ code: 'edc-thailand' }).lean();
      if (thailand) return thailand;
    }

    if (/edc/.test(kw) && /中国|china|阳澄湖|苏州/.test(kw)) {
      const china = await this.model.findOne({ code: 'edc' }).lean();
      if (china) return china;
    }

    const compact = kw.replace(/[\s.\-_/]/g, '');
    const all = await this.model.find().lean();

    for (const activity of all) {
      const code = activity.code?.toLowerCase() ?? '';
      if (!code) continue;

      if (code === 'edc' && /泰国|thailand|泰國/.test(kw)) continue;
      if (code === 'edc-thailand' && /中国|china|阳澄湖/.test(kw)) continue;

      if (compact.includes(code.replace(/-/g, '')) || kw.includes(code)) {
        return activity;
      }

      for (const alias of activity.alias ?? []) {
        const aliasNorm = alias.toLowerCase().replace(/[\s.\-_/]/g, '');
        if (
          aliasNorm &&
          (compact.includes(aliasNorm) ||
            aliasNorm.includes(compact) ||
            kw.includes(alias.toLowerCase()))
        ) {
          return activity;
        }
      }
    }

    return null;
  }
}
