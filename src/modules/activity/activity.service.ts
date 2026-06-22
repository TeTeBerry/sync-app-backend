import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Activity,
  ActivityDocument,
} from '../../database/schemas/activity.schema';
import { ChromaService } from '../../infra/chroma/chroma.service';
import {
  extractLocationFromEventName,
  resolveFestivalBrand,
} from '../../ai/rag/festival-brand.util';
import { NoticeAgent } from '../../ai/agents/notice.agent';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  type IActivityRegistrationRepository,
} from './registration/interfaces/activity-registration.repository.interface';
import { UpdateActivityDto } from './dto/update-activity.dto';
import {
  ActivityRegistration,
  ActivityRegistrationDocument,
} from '../../database/schemas/activity-registration.schema';
import { ACTIVITY_SEED } from './activity.seed';
import { ActivityLookupService } from './activity-lookup.service';

export interface CreateActivityInput {
  name: string;
  code?: string;
  alias?: string[];
  date?: string;
  location?: string;
  image?: string;
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

const ACTIVITY_MAP_COORD_PATCHES = ACTIVITY_SEED.filter(
  (item) => item.latitude != null && item.longitude != null,
).map((item) => ({
  legacyId: item.legacyId,
  latitude: item.latitude,
  longitude: item.longitude,
  region: item.region,
}));

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
    @InjectModel(ActivityRegistration.name)
    private registrationModel: Model<ActivityRegistrationDocument>,
    private readonly activityLookup: ActivityLookupService,
    @Optional() private readonly chromaService?: ChromaService,
    @Optional() private readonly noticeAgent?: NoticeAgent,
    @Optional()
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository?: IActivityRegistrationRepository,
  ) {}

  async onModuleInit() {
    await this.initData();
    await this.removeDeprecatedActivities();
  }

  async initData() {
    for (const item of ACTIVITY_SEED) {
      await this.model.findOneAndUpdate({ code: item.code }, item, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    }

    await this.model.updateMany(
      { activityType: { $exists: false } },
      { $set: { activityType: 'festival' } },
    );

    for (const patch of ACTIVITY_MAP_COORD_PATCHES) {
      await this.model.updateOne(
        { legacyId: patch.legacyId },
        {
          $set: {
            latitude: patch.latitude,
            longitude: patch.longitude,
            region: patch.region,
          },
        },
      );
    }

    await this.syncAttendeeCounts();
    await this.refreshLookupCache();
  }

  /** Persist registration totals on each activity's `attendees` field. */
  async syncAttendeeCounts(legacyIds?: number[]): Promise<void> {
    const match: Record<string, unknown> = { status: 'registered' };
    if (legacyIds?.length) {
      match.activityLegacyId = { $in: legacyIds };
    }

    const grouped = await this.registrationModel.aggregate<{
      _id: number;
      count: number;
    }>([
      { $match: match },
      { $group: { _id: '$activityLegacyId', count: { $sum: 1 } } },
    ]);

    const countByLegacyId = new Map(
      grouped.map((row) => [row._id, row.count] as const),
    );

    const filter = legacyIds?.length ? { legacyId: { $in: legacyIds } } : {};

    const activities = await this.model.find(filter).select('legacyId').lean();

    await Promise.all(
      activities.map((activity) =>
        this.model.updateOne(
          { legacyId: activity.legacyId },
          { $set: { attendees: countByLegacyId.get(activity.legacyId) ?? 0 } },
        ),
      ),
    );

    await this.refreshLookupCache();
  }

  /** Drop retired festivals still present from older seeds (legacy codes only). */
  async removeDeprecatedActivities() {
    await this.model.deleteMany({
      $or: [
        { code: 'sync-live-sh' },
        { code: 'ultra' },
        { code: 'edc' },
        { code: 'vac-zhuhai' },
      ],
    });
    await this.refreshLookupCache();
  }

  health() {
    return { ok: true, scope: 'activity' };
  }

  findAll() {
    return this.activityLookup.findAll();
  }

  findByLegacyId(legacyId: number) {
    return this.activityLookup.findByLegacyId(legacyId);
  }

  findByCode(code: string) {
    return this.activityLookup.findByCode(code);
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

  async resolveActivityByKeyword(keyword: string) {
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
      const thailand = await this.model
        .findOne({ code: 'edc-thailand' })
        .lean();
      if (thailand) return thailand;
    }

    if (/edc/.test(kw) && /韩国|korea|仁川|incheon|首尔|seoul/.test(kw)) {
      const korea = await this.model.findOne({ code: 'edc-korea' }).lean();
      if (korea) return korea;
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
    const all = await this.findAll();

    for (const activity of all) {
      const code = activity.code?.toLowerCase() ?? '';
      if (!code) continue;

      if (code === 'edc' && /泰国|thailand|泰國/.test(kw)) continue;
      if (code === 'edc-thailand' && /中国|china|阳澄湖/.test(kw)) continue;
      if (code === 'edc-thailand' && /韩国|korea|仁川|incheon/.test(kw))
        continue;
      if (code === 'edc-korea' && /泰国|thailand|泰國|普吉/.test(kw)) continue;
      if (code === 'edc' && /vac|vision|colour|珠海|hilton|希尔顿/.test(kw)) {
        continue;
      }
      if ((code === 'edc' || code === 'edc-thailand') && !/edc/.test(kw)) {
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
        const haystack = [activity.name, ...(activity.alias ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (
          festival.brand.aliases.some((alias) =>
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

    await this.refreshLookupCache();
    return activity;
  }

  async resolveOrCreateActivity(input: ResolveOrCreateActivityInput) {
    const ref =
      input.activityRef?.trim() ||
      input.activityKeyword?.trim() ||
      input.activityId?.trim();
    if (!ref) return null;

    const activity =
      (await this.resolveActivityByKeyword(ref)) ??
      (input.activityId ? await this.findByCode(input.activityId) : null);

    if (activity?.code) return activity;

    const keyword = input.activityKeyword?.trim() || ref;
    const festival = resolveFestivalBrand(keyword);
    const location =
      input.location ?? extractLocationFromEventName(keyword) ?? undefined;

    const isSpecificEvent =
      keyword.length > (festival?.brand.name.length ?? 0) + 8 ||
      /\d{4}|站|edition|festival/i.test(keyword);

    const preferredCode = isSpecificEvent
      ? slugifyActivityCode(keyword)
      : (input.activityId ??
        festival?.brand.code ??
        slugifyActivityCode(keyword));

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

  async updateActivity(
    legacyId: number,
    dto: UpdateActivityDto,
    options?: { refreshCache?: boolean },
  ) {
    const activity = await this.model.findOne({ legacyId }).lean();
    if (!activity) {
      throw new NotFoundException(`Activity ${legacyId} not found`);
    }

    const patch: Partial<Activity> = {};
    if (dto.name?.trim()) patch.name = dto.name.trim();
    if (dto.date !== undefined) patch.date = dto.date.trim() || undefined;
    if (dto.location !== undefined) {
      patch.location = dto.location.trim() || undefined;
    }
    if (dto.image !== undefined) {
      patch.image = dto.image.trim() || undefined;
    }
    if (dto.hot !== undefined) {
      patch.hot = dto.hot;
    }
    if (dto.activityType !== undefined) {
      patch.activityType = dto.activityType;
    }
    if (dto.infoSource !== undefined) {
      patch.infoSource = dto.infoSource.trim() || undefined;
    }
    if (dto.infoUpdatedAt !== undefined) {
      patch.infoUpdatedAt = dto.infoUpdatedAt;
    }

    if (Object.keys(patch).length === 0) {
      return activity;
    }

    const updated = await this.model
      .findOneAndUpdate({ legacyId }, { $set: patch }, { new: true })
      .lean();

    if (!updated) {
      throw new NotFoundException(`Activity ${legacyId} not found`);
    }

    const changeParts: string[] = [];
    if (patch.date !== undefined && patch.date !== activity.date) {
      changeParts.push(
        patch.date ? `日期已更新为 ${patch.date}` : '日期信息已变更',
      );
    }
    if (patch.location !== undefined && patch.location !== activity.location) {
      changeParts.push(
        patch.location ? `地点已更新为 ${patch.location}` : '地点信息已变更',
      );
    }
    if (patch.name && patch.name !== activity.name) {
      changeParts.push(`名称已更新为 ${patch.name}`);
    }

    if (changeParts.length > 0) {
      void this.notifyActivityUpdate(updated, changeParts.join('，'));
    }

    await this.chromaService
      ?.upsertActivityKnowledge({
        code: updated.code,
        name: updated.name,
        alias: updated.alias,
        date: updated.date,
        location: updated.location,
      })
      .catch(() => undefined);

    if (options?.refreshCache !== false) {
      await this.refreshLookupCache();
    }
    return updated;
  }

  async refreshActivityLookupCache(): Promise<void> {
    const beforeRecords = await this.activityLookup.findAll();
    const previousLineup = new Map(
      beforeRecords.map((record) => [record.legacyId, record.lineupPublished]),
    );

    await this.refreshLookupCache();

    const afterRecords = await this.activityLookup.findAll();
    for (const record of afterRecords) {
      if (
        previousLineup.get(record.legacyId) === false &&
        record.lineupPublished === true
      ) {
        void this.notifyActivityUpdate(record, '阵容已官宣');
      }
    }
  }

  private async refreshLookupCache(): Promise<void> {
    await this.activityLookup.refreshCache();
  }

  private async notifyActivityUpdate(
    activity: Pick<Activity, 'legacyId' | 'name' | 'date' | 'location'>,
    changeSummary: string,
  ): Promise<void> {
    if (!this.noticeAgent || !this.registrationRepository) {
      return;
    }

    const [userIds, wechatUserIds] = await Promise.all([
      this.registrationRepository.findRegisteredUserIds(activity.legacyId),
      this.registrationRepository.findWechatActivityUpdateOptInUserIds(
        activity.legacyId,
      ),
    ]);
    if (!userIds.length) return;

    void this.noticeAgent.notifyActivityUpdate(
      userIds,
      activity.legacyId,
      activity.name,
      changeSummary,
      activity.date,
      activity.location,
      wechatUserIds,
    );
  }
}
