import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventsKnowledgeSearchService } from '../activity/application/events-knowledge-search.service';
import { ActivityLookupService } from '../activity/activity-lookup.service';
import { LineupCatalogService } from '../itinerary/lineup-catalog.service';
import { UserGoalService } from '../goal/goal.service';
import { UserGoalKind } from '../goal/goal.model';
import { TravelGuideGenerationJobService } from '../travel-guide/travel-guide-generation-job.service';
import { artistIdFromLineupName } from '../itinerary/utils/lineup-artist-id.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type { ActivityLookupRecord } from '../activity/ports/activity-lookup.port';

export interface UiDirective {
  type: 'render-card';
  component: string;
  required: boolean;
  reason?: string;
}

const renderCard = (component: string, reason?: string): UiDirective => ({
  type: 'render-card',
  component,
  required: true,
  ...(reason ? { reason } : {}),
});

function parseTravelGuideFormData(formData: Record<string, unknown>): {
  guideId?: string;
  departure: string;
  departureCity?: string;
  headcount: number;
  budgetTier?: 'economy' | 'standard' | 'comfort';
  selfDrive: boolean;
  accommodationNights?: number;
  note?: string;
  forceRegenerate: boolean;
} {
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

export interface ActivitySnapshot {
  legacyId: number;
  name: string;
  canonicalActivityName: string;
  date?: string;
  location?: string;
  heroImageUrl?: string;
  latitude?: number;
  longitude?: number;
  lineupPublished?: boolean;
}

function toActivitySnapshot(
  activity?: ActivityLookupRecord | null,
): ActivitySnapshot | undefined {
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

export interface SearchFestivalsInput {
  query?: string;
  homeCity?: string;
}

export interface SearchFestivalsEvent {
  legacyId: number;
  name: string;
  date?: string;
  location?: string;
  heroImageUrl?: string;
}

export interface SearchFestivalsResult {
  totalMatched: number;
  events: SearchFestivalsEvent[];
  canonicalActivityName?: string;
  searchSnapshot: {
    totalMatched: number;
    events: SearchFestivalsEvent[];
  };
}

@Injectable()
export class AgentCapabilitiesService {
  constructor(
    private readonly eventsKnowledgeSearch: EventsKnowledgeSearchService,
    private readonly activityLookup: ActivityLookupService,
    private readonly lineupCatalog: LineupCatalogService,
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

    if (!searchInput) {
      const all = await this.activityLookup.findAllBasics();
      const legacyIds = all
        .map((activity) => activity.legacyId)
        .filter((id): id is number => typeof id === 'number');
      const resolvedMap = await this.activityLookup.findByLegacyIds(legacyIds);

      const events: SearchFestivalsEvent[] = all.map((activity) => {
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

    const result = await this.eventsKnowledgeSearch.search(searchInput);
    const legacyIds = result.matchedActivities
      .map((activity) => activity.legacyId)
      .filter((id): id is number => typeof id === 'number');
    const resolvedMap = await this.activityLookup.findByLegacyIds(legacyIds);

    const events: SearchFestivalsEvent[] = result.matchedActivities.map(
      (activity) => {
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
      },
    );

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

  async getEvent(input: { activityLegacyId: number }): Promise<{
    legacyId: number;
    name: string;
    canonicalActivityName: string;
    date?: string;
    location?: string;
    lineupPublished: boolean;
    description?: string;
    heroImageUrl?: string;
    latitude?: number;
    longitude?: number;
    activity?: ActivitySnapshot;
    uiDirectives: UiDirective[];
  }> {
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

  async getLineup(input: { activityLegacyId: number }): Promise<{
    activityLegacyId: number;
    activityName?: string;
    canonicalActivityName?: string;
    activityDate?: string;
    activityLocation?: string;
    activity?: ActivitySnapshot;
    artists: {
      name: string;
      imageUrl?: string;
      artistId: string;
    }[];
    uiDirectives: UiDirective[];
  }> {
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

  async subscribeLineupUpdates(
    input: { activityLegacyId: number; notifyWechat?: boolean },
    actor: RequestActor,
  ): Promise<{
    activityLegacyId: number;
    activityName?: string;
    canonicalActivityName?: string;
    activity?: ActivitySnapshot;
    goalId: string;
    subscribedAt: string;
    uiDirectives: UiDirective[];
  }> {
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
    input: {
      activityLegacyId: number;
      formData: Record<string, unknown>;
    },
    actor: RequestActor,
  ): Promise<{
    activityLegacyId: number;
    activityName?: string;
    canonicalActivityName?: string;
    activity?: ActivitySnapshot;
    jobId: string;
    status: string;
    departure: string;
    headcount: number;
    note?: string;
    uiDirectives: UiDirective[];
  }> {
    const dto = parseTravelGuideFormData(input.formData);

    const [activity, { jobId }] = await Promise.all([
      this.activityLookup.findByLegacyId(input.activityLegacyId),
      this.travelGuideJob.createJob(input.activityLegacyId, dto as any, actor),
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
