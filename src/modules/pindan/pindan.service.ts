import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
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

export interface UpdatePindanInput {
  title?: string;
  subtitle?: string;
  remark?: string;
  price?: number;
  originalPrice?: number;
  date?: string;
  location?: string;
  total?: number;
  leaderUserId?: string;
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
      const { joined, ...staticFields } = item;
      await this.pindanModel.findOneAndUpdate(
        { legacyId: item.legacyId },
        {
          $set: {
            ...staticFields,
            leaderUserId: 'demo-user',
            status: 'open',
          },
          $setOnInsert: {
            joined,
            memberUserIds: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  findByLegacyId(legacyId: number) {
    return this.pindanModel.findOne({ legacyId }).lean();
  }

  findByLeaderUserId(userId: string) {
    return this.pindanModel
      .find({ leaderUserId: userId, status: 'open', legacyId: { $exists: true } })
      .sort({ createdAt: -1, legacyId: -1 })
      .lean();
  }

  async addMember(legacyId: number, userId: string) {
    await this.pindanModel.findOneAndUpdate(
      { legacyId, status: 'open' },
      {
        $addToSet: { memberUserIds: userId },
        $inc: { joined: 1 },
      },
    );
  }

  async removeMember(legacyId: number, userId: string) {
    const pindan = await this.pindanModel.findOne({ legacyId }).lean();
    if (!pindan) return;

    const nextJoined = Math.max(1, (pindan.joined ?? 1) - 1);
    await this.pindanModel.findOneAndUpdate(
      { legacyId },
      {
        $pull: { memberUserIds: userId },
        $set: { joined: nextJoined },
      },
    );
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
    const query: Record<string, unknown> = {
      status: 'open',
      legacyId: { $exists: true },
    };

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

    return this.pindanModel
      .find(query)
      .sort({ createdAt: -1, legacyId: -1 })
      .limit(50)
      .lean();
  }

  async findRecentOpen(limit = 4) {
    return this.pindanModel
      .find({ status: 'open', legacyId: { $exists: true } })
      .sort({ createdAt: -1, legacyId: -1 })
      .limit(limit)
      .lean();
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

  /** 按活动 code/名称/标题 搜索拼单，避免仅 activityId 精确匹配漏结果 */
  async searchForActivity(activityRef: string) {
    const ref = activityRef.trim();
    if (!ref) return this.search({});

    const resolved = this.activityService.resolveActivityRef(ref);
    const activity =
      (resolved?.activityId
        ? await this.activityService.findByCode(resolved.activityId)
        : null) ?? (await this.activityService.matchActivity(ref));

    const code = activity?.code ?? resolved?.activityId?.toLowerCase();
    const legacyId = activity?.legacyId ?? resolved?.activityLegacyId;
    const keywords = new Set<string>();

    if (code) keywords.add(code);
    if (ref.length >= 2) keywords.add(ref.toLowerCase());
    for (const alias of activity?.alias ?? []) {
      if (alias?.trim()) keywords.add(alias.trim());
    }
    if (activity?.name?.trim()) keywords.add(activity.name.trim());

    const orConditions: Record<string, unknown>[] = [];
    if (code) {
      orConditions.push({ activityId: code });
    }
    if (legacyId != null) {
      orConditions.push({ activityLegacyId: legacyId });
    }
    for (const kw of keywords) {
      if (kw.length < 2) continue;
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      orConditions.push({ title: { $regex: escaped, $options: 'i' } });
      orConditions.push({ subtitle: { $regex: escaped, $options: 'i' } });
    }

    if (!orConditions.length) {
      return this.search({ keyword: ref });
    }

    return this.pindanModel
      .find({ status: 'open', legacyId: { $exists: true }, $or: orConditions })
      .sort({ createdAt: -1, legacyId: -1 })
      .limit(50)
      .lean();
  }

  async create(input: CreatePindanInput) {
    const legacyId = await this.nextLegacyId();
    let activityId = input.activityId;
    const activityLegacyId = input.activityLegacyId;

    if (activityLegacyId != null) {
      const activity = await this.activityService.findByLegacyId(
        activityLegacyId,
      );
      activityId = activity?.code ?? activityId;
    }

    const doc = await this.pindanModel.create({
      legacyId,
      title: input.title,
      subtitle: input.subtitle,
      remark: input.remark,
      type: input.type,
      activityId,
      activityLegacyId,
      leaderUserId: input.leaderUserId ?? 'anonymous',
      memberUserIds: input.leaderUserId ? [input.leaderUserId] : [],
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

  async update(
    legacyId: number,
    input: UpdatePindanInput,
    leaderUserId?: string,
  ) {
    const pindan = await this.findByLegacyId(legacyId);
    if (!pindan) {
      throw new NotFoundException('拼单不存在');
    }
    if (leaderUserId && pindan.leaderUserId && pindan.leaderUserId !== leaderUserId) {
      throw new BadRequestException('仅发起人可修改拼单');
    }

    const patch: Record<string, unknown> = {};
    if (input.title?.trim()) patch.title = input.title.trim();
    if (input.subtitle !== undefined) patch.subtitle = input.subtitle;
    if (input.remark !== undefined) patch.remark = input.remark;
    if (input.price != null) patch.price = input.price;
    if (input.originalPrice != null) patch.originalPrice = input.originalPrice;
    if (input.date !== undefined) patch.date = input.date;
    if (input.location !== undefined) patch.location = input.location;
    if (input.total != null && input.total >= 2) patch.total = input.total;

    const updated = await this.pindanModel
      .findOneAndUpdate({ legacyId }, { $set: patch }, { new: true })
      .lean();
    return updated;
  }

  async remove(legacyId: number, leaderUserId?: string) {
    const pindan = await this.findByLegacyId(legacyId);
    if (!pindan) {
      throw new NotFoundException('拼单不存在');
    }
    if (
      leaderUserId &&
      pindan.leaderUserId &&
      pindan.leaderUserId !== leaderUserId
    ) {
      throw new BadRequestException('仅发起人可删除拼单');
    }

    await this.pindanModel.findOneAndUpdate(
      { legacyId },
      { $set: { status: 'cancelled' } },
    );
    return { ok: true as const };
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
