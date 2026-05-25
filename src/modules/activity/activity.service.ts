import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Activity,
  ActivityDocument,
} from '../../database/schemas/activity.schema';
import { ChromaService } from '../../ai/rag/chroma.service';
import {
  extractLocationFromEventName,
  resolveFestivalBrand,
} from '../../ai/rag/festival-brand.util';
import { ACTIVITY_SEED } from './activity.seed';

export interface CreateActivityInput {
  name: string;
  code?: string;
  alias?: string[];
  date?: string;
  location?: string;
  image?: string;
}

export interface ActivityFromBuddyInput {
  activityId?: string;
  activityKeyword?: string;
  packageName?: string;
  hotelName?: string;
  eventDate?: string;
  location?: string;
  city?: string;
  resolvedCode?: string;
}

function slugifyActivityCode(raw: string): string {
  const compact = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return compact || `event-${Date.now()}`;
}

function formatActivityDate(eventDate?: string): string | undefined {
  if (!eventDate) return undefined;
  const match = eventDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return eventDate;
  return `${match[2]}/${match[3]}`;
}

export interface ResolveOrCreateActivityInput {
  activityRef?: string;
  activityId?: string;
  activityKeyword?: string;
  eventDate?: string;
  location?: string;
}

@Injectable()
export class ActivityService implements OnModuleInit {
  constructor(
    @InjectModel(Activity.name) private model: Model<ActivityDocument>,
    @Optional() private readonly chromaService?: ChromaService,
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

    if (/vac|vision|colour|color|soundscape|珠海.*vac|vac.*珠海/.test(kw)) {
      const vac = await this.model.findOne({ code: 'vac-zhuhai' }).lean();
      if (vac) return vac;
    }

    const compact = kw.replace(/[\s.\-_/]/g, '');
    const all = await this.model.find().lean();

    for (const activity of all) {
      const code = activity.code?.toLowerCase() ?? '';
      if (!code) continue;

      if (code === 'edc' && /泰国|thailand|泰國/.test(kw)) continue;
      if (code === 'edc-thailand' && /中国|china|阳澄湖/.test(kw)) continue;
      if (code === 'edc' && /vac|vision|colour|珠海|hilton|希尔顿/.test(kw)) {
        continue;
      }
      if (
        (code === 'edc' || code === 'edc-thailand') &&
        !/edc/.test(kw)
      ) {
        continue;
      }

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

    const festival = resolveFestivalBrand(keyword);
    if (festival) {
      const byBrandCode = await this.model
        .findOne({ code: festival.brand.code })
        .lean();
      if (byBrandCode) return byBrandCode;

      for (const activity of all) {
        const haystack = [
          activity.name,
          ...(activity.alias ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (
          festival.brand.aliases.some(alias =>
            haystack.includes(alias.toLowerCase()),
          )
        ) {
          return activity;
        }
      }
    }

    return null;
  }

  private async nextLegacyId() {
    const latest = await this.model.findOne().sort({ legacyId: -1 }).lean();
    return (latest?.legacyId ?? 0) + 1;
  }

  private async uniqueCode(preferred: string): Promise<string> {
    let code = preferred.toLowerCase().trim();
    if (!code) code = slugifyActivityCode('event');
    if (!(await this.findByCode(code))) return code;

    let suffix = 2;
    while (await this.findByCode(`${code}-${suffix}`)) {
      suffix += 1;
    }
    return `${code}-${suffix}`;
  }

  async createActivity(input: CreateActivityInput) {
    const code = await this.uniqueCode(
      input.code ?? slugifyActivityCode(input.name),
    );
    const legacyId = await this.nextLegacyId();
    const doc = await this.model.create({
      legacyId,
      name: input.name.trim(),
      code,
      alias: input.alias ?? [],
      date: input.date,
      location: input.location,
      image: input.image,
      hot: false,
      attendees: 0,
      pinCount: 0,
    });
    const activity = doc.toObject();

    await this.chromaService
      ?.upsertActivityKnowledge({
        code: activity.code,
        name: activity.name,
        alias: activity.alias,
        date: activity.date,
        location: activity.location,
      })
      .catch(() => undefined);

    return activity;
  }

  async resolveOrCreateActivity(input: ResolveOrCreateActivityInput) {
    const ref =
      input.activityRef?.trim() ||
      input.activityKeyword?.trim() ||
      input.activityId?.trim();
    if (!ref) return null;

    let activity =
      (await this.matchActivity(ref)) ??
      (input.activityId
        ? await this.findByCode(input.activityId)
        : null);

    if (activity?.code) return activity;

    const keyword = input.activityKeyword?.trim() || ref;
    const festival = resolveFestivalBrand(keyword);
    const location =
      input.location ??
      extractLocationFromEventName(keyword) ??
      undefined;

    const isSpecificEvent =
      keyword.length > (festival?.brand.name.length ?? 0) + 8 ||
      /\d{4}|站|edition|festival/i.test(keyword);

    const preferredCode = isSpecificEvent
      ? slugifyActivityCode(keyword)
      : input.activityId ?? festival?.brand.code ?? slugifyActivityCode(keyword);

    const alias = [
      keyword,
      festival?.matchedKeyword,
      festival?.brand.name,
      festival?.brand.code,
    ].filter((item): item is string => Boolean(item?.trim()));

    return this.createActivity({
      name: keyword,
      code: preferredCode,
      alias: [...new Set(alias)],
      date: formatActivityDate(input.eventDate),
      location,
    });
  }

  async createFromTicket(input: {
    activityId?: string;
    activityKeyword?: string;
    eventDate?: string;
  }) {
    return this.resolveOrCreateActivity({
      activityRef: input.activityKeyword ?? input.activityId,
      activityId: input.activityId,
      activityKeyword: input.activityKeyword,
      eventDate: input.eventDate,
    });
  }

  async createFromFindBuddy(input: ActivityFromBuddyInput) {
    const keyword =
      input.activityKeyword?.trim() ||
      input.packageName?.trim()?.slice(0, 48) ||
      '未命名活动';

    const existing =
      (input.activityKeyword
        ? await this.matchActivity(input.activityKeyword)
        : null) ??
      (input.activityId ? await this.findByCode(input.activityId) : null);
    if (existing?.code) return existing;

    const festival = resolveFestivalBrand(keyword);
    const alias = [
      input.activityKeyword,
      input.packageName,
      input.hotelName,
      festival?.matchedKeyword,
      festival?.brand.name,
    ].filter((item): item is string => Boolean(item?.trim()));

    const isSpecificEvent =
      keyword.length > (festival?.brand.name.length ?? 0) + 8 ||
      /\d{4}|站/.test(keyword);

    const preferredCode =
      input.resolvedCode ??
      (isSpecificEvent
        ? slugifyActivityCode(keyword)
        : input.activityId && !(await this.findByCode(input.activityId))
          ? input.activityId
          : festival?.brand.code);

    return this.createActivity({
      name: keyword,
      code: preferredCode,
      alias: [...new Set(alias)],
      date: formatActivityDate(input.eventDate),
      location:
        input.location ??
        input.city ??
        extractLocationFromEventName(keyword),
    });
  }

  async incrementPinCount(code: string) {
    await this.model.findOneAndUpdate(
      { code: code.toLowerCase().trim() },
      { $inc: { pinCount: 1 } },
    );
  }
}
