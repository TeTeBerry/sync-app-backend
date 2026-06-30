import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type {
  DraftRecruitPostInput,
  DraftRecruitPostResult,
  GenerateTravelGuideInput,
  GenerateTravelGuideResult,
  GetEventInput,
  GetEventResult,
  GetLineupInput,
  GetLineupResult,
  SearchFestivalsInput,
  SearchFestivalsResult,
  SearchPublicRecruitsInput,
  SearchPublicRecruitsResult,
  SubscribeLineupUpdatesInput,
  SubscribeLineupUpdatesResult,
} from '@sync/agent-capabilities-contracts';
import { EventsKnowledgeSearchService } from '../activity/application/events-knowledge-search.service';
import { ActivityLookupService } from '../activity/activity-lookup.service';
import { LineupCatalogService } from '../itinerary/lineup-catalog.service';
import { PostSearchService } from '../partner/application/post-search.service';
import { PostService } from '../partner/post.service';
import type { AiComposePostsDto } from '../partner/dto/ai-compose-posts.dto';
import { UserGoalService } from '../goal/goal.service';
import { UserGoalArtifactKind, UserGoalKind } from '../goal/goal.model';
import { TravelGuideGenerationJobService } from '../travel-guide/travel-guide-generation-job.service';
import type { GenerateTravelGuideDto } from '../travel-guide/dto/generate-travel-guide.dto';
import { artistIdFromLineupName } from '../itinerary/utils/lineup-artist-id.util';

const ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const FILTER_CITY_KEYWORDS = [
  '上海',
  '北京',
  '广州',
  '深圳',
  '成都',
  '杭州',
  '南京',
  '武汉',
  '西安',
  '重庆',
  '苏州',
  '天津',
  '厦门',
  '青岛',
  '曼谷',
  '东京',
  '首尔',
];

function extractFilterLabels(query: string): string[] {
  const labels: string[] = [];
  const peopleMatch = query.match(/\d+\s*人/);
  if (peopleMatch) {
    labels.push(peopleMatch[0].replace(/\s/g, ''));
  }
  for (const city of FILTER_CITY_KEYWORDS) {
    if (query.includes(city)) {
      labels.push(city);
    }
  }
  const genreMatch = query.match(
    /techno|house|trance|bass|drum and bass|dnb|hardstyle|psytrance/i,
  );
  if (genreMatch) {
    labels.push(genreMatch[0]);
  }
  if (!labels.length && query.length > 0 && query.length <= 16) {
    labels.push(query);
  }
  return [...new Set(labels)].slice(0, 5);
}

function parseDraftComposeFields(
  draft: Record<string, unknown>,
): Pick<
  AiComposePostsDto,
  | 'dateStart'
  | 'dateEnd'
  | 'location'
  | 'headcount'
  | 'composeHints'
  | 'regenerate'
> {
  const dateStart =
    typeof draft.dateStart === 'string' ? draft.dateStart.trim() : '';
  const dateEnd = typeof draft.dateEnd === 'string' ? draft.dateEnd.trim() : '';
  const location =
    typeof draft.location === 'string' ? draft.location.trim() : '';
  const headcount =
    typeof draft.headcount === 'string' ? draft.headcount.trim() : '';
  if (!dateStart || !dateEnd || !location || !headcount) {
    throw new BadRequestException('请填写日期、出发地与人数');
  }
  const composeHints =
    draft.composeHints &&
    typeof draft.composeHints === 'object' &&
    !Array.isArray(draft.composeHints)
      ? (draft.composeHints as AiComposePostsDto['composeHints'])
      : undefined;
  return {
    dateStart,
    dateEnd,
    location,
    headcount,
    composeHints,
    regenerate: draft.regenerate === true,
  };
}

function parseTravelGuideFormData(
  formData: Record<string, unknown>,
): GenerateTravelGuideDto {
  const departure =
    typeof formData.departure === 'string' ? formData.departure.trim() : '';
  if (!departure) {
    throw new BadRequestException('请填写出发地');
  }
  const headcountRaw = formData.headcount;
  const headcount =
    typeof headcountRaw === 'number'
      ? headcountRaw
      : Number.parseInt(String(headcountRaw ?? ''), 10);
  if (!Number.isFinite(headcount) || headcount < 1) {
    throw new BadRequestException('请填写有效人数');
  }
  return {
    guideId:
      typeof formData.guideId === 'string' ? formData.guideId : undefined,
    departure,
    departureCity:
      typeof formData.departureCity === 'string'
        ? formData.departureCity
        : undefined,
    headcount,
    budgetTier:
      formData.budgetTier === 'economy' ||
      formData.budgetTier === 'standard' ||
      formData.budgetTier === 'comfort'
        ? formData.budgetTier
        : undefined,
    selfDrive: formData.selfDrive === true,
    accommodationNights:
      typeof formData.accommodationNights === 'number'
        ? formData.accommodationNights
        : undefined,
    forceRegenerate: formData.forceRegenerate === true,
  };
}

@Injectable()
export class AgentCapabilitiesService {
  constructor(
    private readonly eventsKnowledgeSearch: EventsKnowledgeSearchService,
    private readonly activityLookup: ActivityLookupService,
    private readonly lineupCatalog: LineupCatalogService,
    private readonly postSearch: PostSearchService,
    private readonly postService: PostService,
    private readonly goalService: UserGoalService,
    private readonly travelGuideJob: TravelGuideGenerationJobService,
  ) {}

  async searchFestivals(
    input: SearchFestivalsInput,
  ): Promise<SearchFestivalsResult> {
    const query = input.query?.trim() ?? '';
    const homeCity = input.homeCity?.trim();
    const searchInput = [query, homeCity ? `从${homeCity}出发` : '']
      .filter(Boolean)
      .join(' ');

    // When no search input, return all activities in the catalog.
    if (!searchInput) {
      const all = await this.activityLookup.findAllBasics();
      const events = all.map((activity) => ({
        legacyId: activity.legacyId,
        name: activity.name,
        date: activity.date,
        location: activity.location,
        heroImageUrl: activity.image,
      }));
      return { totalMatched: events.length, events };
    }

    const result = await this.eventsKnowledgeSearch.search(searchInput);
    const legacyIds = result.matchedActivities
      .map((activity) => activity.legacyId)
      .filter((id): id is number => typeof id === 'number');
    const resolvedMap = await this.activityLookup.findByLegacyIds(legacyIds);
    const events = result.matchedActivities.map((activity) => {
      const resolved =
        activity.legacyId != null
          ? (resolvedMap.get(activity.legacyId) ?? activity)
          : activity;
      return {
        legacyId: activity.legacyId,
        name: activity.name,
        date: activity.date,
        location: activity.location,
        heroImageUrl: resolved.image,
      };
    });
    return { totalMatched: events.length, events };
  }

  async getEvent(input: GetEventInput): Promise<GetEventResult> {
    const activity = await this.activityLookup.findByLegacyId(
      input.activityLegacyId,
    );
    if (!activity) {
      throw new NotFoundException('活动不存在');
    }
    return {
      legacyId: activity.legacyId,
      name: activity.name,
      date: activity.date,
      location: activity.location,
      lineupPublished: activity.lineupPublished ?? false,
      description: undefined,
      heroImageUrl: activity.image,
      latitude: activity.latitude,
      longitude: activity.longitude,
    };
  }

  private async resolveArtistThumbnailMap(): Promise<Map<string, string>> {
    const ranked = await this.lineupCatalog.listCatalogLineupArtistsRanked();
    const map = new Map<string, string>();
    for (const artist of ranked) {
      const key = artist.name?.trim().toLowerCase();
      const thumb = artist.thumbnail?.trim();
      if (key && thumb && !map.has(key)) {
        map.set(key, thumb);
      }
    }
    return map;
  }

  async getLineup(input: GetLineupInput): Promise<GetLineupResult> {
    const [artists, thumbnailMap] = await Promise.all([
      this.lineupCatalog.listLineupArtistsForActivities([
        input.activityLegacyId,
      ]),
      this.resolveArtistThumbnailMap(),
    ]);
    const activity = await this.activityLookup.findByLegacyId(
      input.activityLegacyId,
    );
    return {
      activityLegacyId: input.activityLegacyId,
      activityName: activity?.name,
      activityDate: activity?.date,
      activityLocation: activity?.location,
      artists: artists.map((artist) => ({
        name: artist.artistName,
        imageUrl: thumbnailMap.get(artist.artistName.trim().toLowerCase()),
        artistId: artistIdFromLineupName(artist.artistName),
      })),
    };
  }

  async searchPublicRecruits(
    input: SearchPublicRecruitsInput,
    actor: RequestActor,
  ): Promise<SearchPublicRecruitsResult> {
    const activityLegacyId = input.activityLegacyId;
    if (
      !activityLegacyId ||
      !Number.isFinite(activityLegacyId) ||
      activityLegacyId <= 0
    ) {
      throw new BadRequestException('活动信息无效');
    }
    const query = input.query?.trim() ?? '';
    if (!query) {
      throw new BadRequestException('请输入检索需求');
    }

    const result = await this.postSearch.searchByNaturalLanguage(
      query,
      activityLegacyId,
      actor,
      { applyPreferenceRank: false },
    );

    const posts = result.items.map((item) => ({
      id: item.id,
      activityLegacyId,
      nickname: item.name,
      avatarUrl: item.avatar,
      summary: item.bodyPreview ?? item.body,
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));

    return {
      totalMatched: result.totalMatched,
      posts,
      filterLabels: extractFilterLabels(query),
      query,
    };
  }

  async draftRecruitPost(
    input: DraftRecruitPostInput,
    actor: RequestActor,
  ): Promise<DraftRecruitPostResult> {
    const userId = actor.resolvedUserId?.trim();
    if (!userId) {
      throw new BadRequestException('请先登录');
    }

    const composeFields = parseDraftComposeFields(input.draft);
    const result = await this.postService.composeBuddyPostCandidates(
      {
        activityLegacyId: input.activityLegacyId,
        ...composeFields,
      },
      actor,
    );

    const artifactId = randomUUID();
    const now = Date.now();
    await this.goalService.saveArtifact({
      artifactId,
      goalId: 'agent-capability',
      userId,
      activityLegacyId: input.activityLegacyId,
      kind: UserGoalArtifactKind.RECRUIT_DRAFT,
      payload: {
        candidates: result.candidates,
        disclaimer: result.disclaimer,
      },
      expiresAt: new Date(now + ARTIFACT_TTL_MS).toISOString(),
    });

    return {
      artifactId,
      preview: {
        candidates: result.candidates,
        disclaimer: result.disclaimer,
        activityLegacyId: input.activityLegacyId,
      },
      formData: {
        dateStart: composeFields.dateStart,
        dateEnd: composeFields.dateEnd,
        location: composeFields.location,
        headcount: composeFields.headcount,
      },
    };
  }

  async subscribeLineupUpdates(
    input: SubscribeLineupUpdatesInput,
    actor: RequestActor,
  ): Promise<SubscribeLineupUpdatesResult> {
    const [activity, goal] = await Promise.all([
      this.activityLookup.findByLegacyId(input.activityLegacyId),
      this.goalService.create(actor, {
        activityLegacyId: input.activityLegacyId,
        kind: UserGoalKind.WATCH_LINEUP,
        params: { notifyWechat: input.notifyWechat ?? true },
      }),
    ]);
    return {
      activityLegacyId: input.activityLegacyId,
      activityName: activity?.name,
      goalId: String(goal._id),
      subscribedAt: goal.updatedAt ?? new Date().toISOString(),
    };
  }

  async generateTravelGuide(
    input: GenerateTravelGuideInput,
    actor: RequestActor,
  ): Promise<GenerateTravelGuideResult> {
    const dto = parseTravelGuideFormData(input.formData);
    const [activity, { jobId }] = await Promise.all([
      this.activityLookup.findByLegacyId(input.activityLegacyId),
      this.travelGuideJob.createJob(input.activityLegacyId, dto, actor),
    ]);
    const job = await this.travelGuideJob.getJob(jobId, actor);
    return {
      activityLegacyId: input.activityLegacyId,
      activityName: activity?.name,
      jobId,
      status: job?.status ?? 'pending',
    };
  }
}
