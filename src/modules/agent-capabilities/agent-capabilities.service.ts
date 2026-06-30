import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type {
  AgentCapabilityActivitySnapshot,
  AgentCapabilityUiDirective,
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
import type { ActivityLookupRecord } from '../activity/ports/activity-lookup.port';
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

const renderCard = (
  component: AgentCapabilityUiDirective['component'],
  reason?: string,
): AgentCapabilityUiDirective => ({
  type: 'render-card',
  component,
  required: true,
  ...(reason ? { reason } : {}),
});

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
  const baseComposeHints =
    draft.composeHints &&
    typeof draft.composeHints === 'object' &&
    !Array.isArray(draft.composeHints)
      ? (draft.composeHints as AiComposePostsDto['composeHints'])
      : undefined;
  const note = typeof draft.note === 'string' ? draft.note.trim() : '';
  const composeHints = note
    ? {
        ...(baseComposeHints ?? {}),
        prefillSummary: baseComposeHints?.prefillSummary?.trim() || note,
        favorGenres: [
          ...new Set([
            ...(baseComposeHints?.favorGenres ?? []),
            ...extractGenreHints(note),
          ]),
        ],
      }
    : baseComposeHints;
  return {
    dateStart,
    dateEnd,
    location,
    headcount,
    composeHints,
    regenerate: draft.regenerate === true,
  };
}

function extractGenreHints(text: string): string[] {
  const matches = text.match(
    /hardstyle|hard techno|techno|house|trance|bass|drum and bass|dnb|psytrance/gi,
  );
  return [
    ...new Set((matches ?? []).map((item) => item.trim()).filter(Boolean)),
  ];
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
    note:
      typeof formData.note === 'string' && formData.note.trim()
        ? formData.note.trim()
        : typeof formData.prefillSummary === 'string' &&
            formData.prefillSummary.trim()
          ? formData.prefillSummary.trim()
          : undefined,
    forceRegenerate: formData.forceRegenerate === true,
  };
}

type ActivitySnapshotSource = {
  legacyId: number;
  name: string;
  date?: string;
  location?: string;
  image?: string;
  lineupPublished?: boolean;
  latitude?: number;
  longitude?: number;
};

function toActivitySnapshot(
  activity?: ActivitySnapshotSource | null,
): AgentCapabilityActivitySnapshot | undefined {
  if (!activity) return undefined;
  return {
    legacyId: activity.legacyId,
    name: activity.name,
    canonicalActivityName: activity.name,
    date: activity.date,
    location: activity.location,
    heroImageUrl: activity.image,
    latitude: activity.latitude,
    longitude: activity.longitude,
    lineupPublished: activity.lineupPublished,
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
    const searchInputParts = [
      query,
      homeCity ? `从${homeCity}出发` : '',
    ].filter(Boolean);
    const searchInput = searchInputParts.join(' ');

    // When only homeCity is provided (query is empty), search by city or return all.
    if (!searchInput) {
      const all = await this.activityLookup.findAllBasics();
      const legacyIds = all
        .map((activity) => activity.legacyId)
        .filter((id): id is number => typeof id === 'number');
      const resolvedMap = await this.activityLookup.findByLegacyIds(legacyIds);
      const events = all.map((activity) => {
        const resolved = resolvedMap.get(activity.legacyId);
        return {
          legacyId: activity.legacyId,
          name: activity.name,
          date: activity.date,
          location: activity.location,
          heroImageUrl: resolved?.image ?? activity.image,
        };
      });
      return {
        totalMatched: events.length,
        events,
        searchSnapshot: {
          totalMatched: events.length,
          events,
        },
      };
    }

    // When query is empty but homeCity exists, pass city-only search.
    // When query is non-empty, pass combined search.
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
        name: resolved.name,
        date: resolved.date,
        location: resolved.location,
        heroImageUrl: resolved.image,
      };
    });
    return {
      totalMatched: events.length,
      events,
      canonicalActivityName: events.length === 1 ? events[0]?.name : undefined,
      searchSnapshot: {
        totalMatched: events.length,
        events,
      },
    };
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
      canonicalActivityName: activity.name,
      date: activity.date,
      location: activity.location,
      lineupPublished: activity.lineupPublished ?? false,
      description: undefined,
      heroImageUrl: activity.image,
      latitude: activity.latitude,
      longitude: activity.longitude,
      activity: toActivitySnapshot(activity),
      uiDirectives: [
        renderCard(
          'search-results-card',
          'getEvent result must render search-results-card',
        ),
      ],
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
      canonicalActivityName: activity?.name,
      activityDate: activity?.date,
      activityLocation: activity?.location,
      activity: toActivitySnapshot(activity),
      artists: artists.map((artist) => ({
        name: artist.artistName,
        imageUrl: thumbnailMap.get(artist.artistName.trim().toLowerCase()),
        artistId: artistIdFromLineupName(artist.artistName),
      })),
      uiDirectives: [
        renderCard(
          'artist-lineup-strip',
          'getLineup result must render artist-lineup-strip',
        ),
      ],
    };
  }

  async searchPublicRecruits(
    input: SearchPublicRecruitsInput,
    actor: RequestActor,
  ): Promise<SearchPublicRecruitsResult> {
    const query = input.query?.trim() ?? '';
    if (!query) {
      throw new BadRequestException('请输入检索需求');
    }

    let activityLegacyId = input.activityLegacyId;
    let resolvedActivity: ActivityLookupRecord | null = null;

    // When activityLegacyId is not provided, resolve it from the query
    // by searching the festival catalog.  This lets the LLM call a single
    // API instead of searchFestivals → extract ID → searchPublicRecruits.
    if (
      !activityLegacyId ||
      !Number.isFinite(activityLegacyId) ||
      activityLegacyId <= 0
    ) {
      const searchResult = await this.eventsKnowledgeSearch.search(query);
      const best = searchResult.matchedActivities.find(
        (a) => typeof a.legacyId === 'number' && a.legacyId > 0,
      );
      if (!best?.legacyId) {
        throw new BadRequestException(
          `未在 catalog 中找到与「${query}」匹配的活动，请先通过 searchFestivals 检索活动`,
        );
      }
      activityLegacyId = best.legacyId;
      resolvedActivity =
        await this.activityLookup.findByLegacyId(activityLegacyId);
      console.info(
        `[agent-capabilities] searchPublicRecruits auto-resolved activity: ${resolvedActivity?.name} (legacyId=${activityLegacyId})`,
      );
    }

    const activity =
      resolvedActivity ??
      (await this.activityLookup.findByLegacyId(activityLegacyId));
    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // Soft check: detect when the resolved activity name doesn't match
    // brand keywords in the query (e.g. user asked "EDC" but we're searching
    // "Tomorrowland").  We warn via a response field instead of throwing so
    // the LLM sees the mismatch inline and self-corrects without retry loops.
    let activityMismatch: string | undefined;
    if (query) {
      const FESTIVAL_QUERY_NOISE =
        /出发|找队|组队|招募|搭子|同行|拼房|差\s*\d+\s*人|\d+\s*人|\d+\s*个|\d+\s*名|喜欢|电音节|音乐节|festival/gi;
      const AREA_TERMS = new Set([
        '泰国',
        'thailand',
        '日本',
        'japan',
        '韩国',
        'korea',
        '比利时',
        'belgium',
        '克罗地亚',
        'croatia',
        '印尼',
        'indonesia',
        '美国',
        'usa',
        '上海',
        '深圳',
        '珠海',
        '苏州',
        '北京',
        '广州',
        '成都',
        '杭州',
        '南京',
        '武汉',
        '重庆',
        '欧洲',
        'europe',
        '亚洲',
        'asia',
      ]);
      const brandTokens = query
        .replace(FESTIVAL_QUERY_NOISE, ' ')
        .split(/[\s,，、/|]+/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 3 && !AREA_TERMS.has(t));
      if (brandTokens.length > 0) {
        const activityHaystack = [
          activity.name,
          activity.code,
          ...(activity.alias ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matched = brandTokens.some((token) =>
          activityHaystack.includes(token),
        );
        if (!matched) {
          activityMismatch = `「${activity.name}」与查询条件「${brandTokens.join(' ')}」不匹配`;
          console.info(
            `[agent-capabilities] searchPublicRecruits mismatch: ${activityMismatch}`,
          );
        }
      }
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
      activityLegacyId,
      activityName: activity.name,
      canonicalActivityName: activity.name,
      activity: toActivitySnapshot(activity),
      totalMatched: result.totalMatched,
      posts,
      filterLabels: extractFilterLabels(query),
      query,
      ...(activityMismatch ? { activityMismatch } : {}),
      uiDirectives: [
        renderCard(
          'recruit-list-card',
          'searchPublicRecruits result must render recruit-list-card',
        ),
      ],
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

    const [composeFields, activity] = await Promise.all([
      Promise.resolve(parseDraftComposeFields(input.draft)),
      this.activityLookup.findByLegacyId(input.activityLegacyId),
    ]);
    const result = await this.postService.composeBuddyPostCandidates(
      {
        activityLegacyId: input.activityLegacyId,
        ...composeFields,
      },
      actor,
    );
    const note =
      typeof input.draft.note === 'string' ? input.draft.note.trim() : '';

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
      activityLegacyId: input.activityLegacyId,
      activityName: activity?.name,
      canonicalActivityName: activity?.name,
      activity: toActivitySnapshot(activity),
      preview: {
        candidates: result.candidates,
        disclaimer: result.disclaimer,
        activityLegacyId: input.activityLegacyId,
        activityName: activity?.name,
      },
      formData: {
        dateStart: composeFields.dateStart,
        dateEnd: composeFields.dateEnd,
        location: composeFields.location,
        headcount: composeFields.headcount,
        ...(note ? { note } : {}),
        ...(composeFields.composeHints
          ? { composeHints: composeFields.composeHints }
          : {}),
      },
      ...(note ? { note } : {}),
      uiDirectives: [
        renderCard(
          'draft-candidates-card',
          'draftRecruitPost result must render draft-candidates-card',
        ),
      ],
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
      canonicalActivityName: activity?.name,
      activity: toActivitySnapshot(activity),
      goalId: String(goal._id),
      subscribedAt: goal.updatedAt ?? new Date().toISOString(),
      uiDirectives: [
        renderCard(
          'prep-status-card',
          'subscribeLineupUpdates result must render prep-status-card',
        ),
      ],
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
      canonicalActivityName: activity?.name,
      activity: toActivitySnapshot(activity),
      jobId,
      status: job?.status ?? 'pending',
      departure: dto.departure,
      headcount: dto.headcount,
      ...(dto.note ? { note: dto.note } : {}),
      uiDirectives: [
        renderCard(
          'prep-status-card',
          'generateTravelGuide result must render prep-status-card',
        ),
      ],
    };
  }
}
