import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Pindan,
  PindanDocument,
  PindanType,
} from '../../database/schemas/pindan.schema';
import { ActivityService } from '../activity/activity.service';
import { PINDAN_SEED } from './pindan.seed';

export interface CreatePindanInput {
  title: string;
  subtitle?: string;
  type: PindanType;
  activityId?: string;
  activityLegacyId?: number;
  leaderUserId?: string;
  image?: string;
  price?: number;
  originalPrice?: number;
  date?: string;
  location?: string;
  total?: number;
  tags?: string[];
  remark?: string;
}

@Injectable()
export class PindanService implements OnModuleInit {
  constructor(
    @InjectModel(Pindan.name)
    private readonly pindanModel: Model<PindanDocument>,
    private readonly activityService: ActivityService,
  ) {}

  async onModuleInit() {
    await this.initData();
  }

  async initData() {
    for (const item of PINDAN_SEED) {
      await this.pindanModel.findOneAndUpdate(
        { legacyId: item.legacyId },
        {
          ...item,
          leaderUserId: 'demo-user',
          memberUserIds: [],
          status: 'open',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  health() {
    return { ok: true, scope: 'pindan' };
  }

  async search(filters: {
    activityId?: string;
    activityLegacyId?: number;
    type?: PindanType;
    keyword?: string;
  }) {
    const query: Record<string, unknown> = { status: 'open' };

    if (filters.activityId) {
      query.activityId = filters.activityId.toLowerCase();
    }
    if (filters.activityLegacyId != null) {
      query.activityLegacyId = filters.activityLegacyId;
    }
    if (filters.type) {
      query.type = filters.type;
    }
    if (filters.keyword) {
      query.title = { $regex: filters.keyword, $options: 'i' };
    }

    return this.pindanModel.find(query).sort({ legacyId: 1 }).limit(50).lean();
  }

  async searchFromQuery(params: {
    activityId?: string;
    type?: PindanType;
    keyword?: string;
  }) {
    const resolved = this.activityService.resolveActivityRef(params.activityId);
    return this.search({
      keyword: params.keyword,
      type: params.type,
      activityId: resolved?.activityId,
      activityLegacyId: resolved?.activityLegacyId,
    });
  }

  async create(input: CreatePindanInput) {
    const legacyId = await this.nextLegacyId();
    let activityId = input.activityId;
    let activityLegacyId = input.activityLegacyId;

    if (activityLegacyId != null) {
      const activity = await this.activityService.findByLegacyId(
        activityLegacyId,
      );
      activityId = activity?.code ?? activityId;
    }

    const doc = await this.pindanModel.create({
      legacyId,
      title: input.title,
      subtitle: input.subtitle ?? input.remark,
      type: input.type,
      activityId,
      activityLegacyId,
      leaderUserId: input.leaderUserId ?? 'anonymous',
      memberUserIds: [],
      status: 'open',
      image: input.image,
      price: input.price ?? 0,
      originalPrice: input.originalPrice ?? 0,
      date: input.date,
      location: input.location,
      joined: 1,
      total: input.total ?? 4,
      tags: input.tags ?? [],
      rating: 4.8,
      includes: [],
    });

    return doc.toObject();
  }

  async countOpen() {
    return this.pindanModel.countDocuments({ status: 'open' });
  }

  async sumJoinedPeople() {
    const rows = await this.pindanModel
      .find({ status: 'open' })
      .select('joined')
      .lean();
    return rows.reduce((sum, row) => sum + (row.joined ?? 0), 0);
  }

  private async nextLegacyId() {
    const latest = await this.pindanModel
      .findOne({ legacyId: { $exists: true } })
      .sort({ legacyId: -1 })
      .lean();
    return (latest?.legacyId ?? 100) + 1;
  }
}
