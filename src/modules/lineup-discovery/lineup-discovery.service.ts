import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  TASTE_SIGNAL_TYPES,
  type TasteSignalType,
} from '@src/database/schemas/taste-signal.schema';
import {
  UserItinerary,
  UserItineraryDocument,
} from '@src/database/schemas/user-itinerary.schema';
import { ArtistLikeService } from '../itinerary/artist-like.service';
import { ItineraryScheduleService } from '../itinerary/itinerary-schedule.service';
import { LineupConflictService } from '../itinerary/lineup-conflict.service';
import { ClashResolutionService } from '../itinerary/clash-resolution.service';
import type {
  EvaluateArtistDto,
  RecordTasteSignalDto,
  ResolveConflictDto,
} from './dto/lineup-discovery.dto';
import { LegacyPersonalityMigrationService } from './legacy-personality-migration.service';
import { TasteSignalsRepository } from './taste-signals.repository';
import {
  buildAffinityFromSignals,
  rankLineupDiscovery,
  type LineupDjInput,
} from './utils/discovery-ranking.util';
import { buildFestivalDna } from './utils/festival-dna.util';
import { buildConstellationGraph } from './utils/constellation.util';
import { canonicalizeGenre } from './utils/genre-normalization.util';
import { ANONYMOUS_SIGNAL_TTL_DAYS } from './utils/taste-weights';
import type { TomorrowlandBelgiumWeekend } from '../itinerary/domain/tomorrowland-belgium-weekend.util';

const ANONYMOUS_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const STRONG_SIGNAL_TYPES = new Set<TasteSignalType>([
  'artist_saved',
  'artist_favorited',
  'artist_added_to_lineup',
  'journey_artist_added',
  'recommendation_saved',
]);

type DnaCacheEntry = {
  version: string;
  payload: ReturnType<typeof buildFestivalDna>;
  expiresAt: number;
};

@Injectable()
export class LineupDiscoveryService {
  private readonly logger = new Logger(LineupDiscoveryService.name);
  private readonly dnaCache = new Map<string, DnaCacheEntry>();
  private readonly discoveryCache = new Map<
    string,
    { expiresAt: number; payload: unknown }
  >();

  constructor(
    private readonly tasteSignals: TasteSignalsRepository,
    private readonly scheduleService: ItineraryScheduleService,
    private readonly artistLikes: ArtistLikeService,
    private readonly legacyPersonality: LegacyPersonalityMigrationService,
    private readonly lineupConflicts: LineupConflictService,
    private readonly clashResolution: ClashResolutionService,
    @InjectModel(UserItinerary.name)
    private readonly itineraryModel: Model<UserItineraryDocument>,
  ) {}

  async recordSignal(
    dto: RecordTasteSignalDto,
    actor: RequestActor,
    rawBody?: Record<string, unknown>,
  ) {
    if (rawBody && 'weight' in rawBody && rawBody.weight !== undefined) {
      throw new BadRequestException('Client weight overrides are not allowed');
    }
    if (!TASTE_SIGNAL_TYPES.includes(dto.signalType)) {
      throw new BadRequestException('Unsupported taste signal type');
    }

    const userId = actor.resolvedUserId?.trim() || undefined;
    const anonymousId = dto.anonymousId?.trim() || undefined;

    if (!userId && !anonymousId) {
      throw new BadRequestException(
        'Either authentication or anonymousId is required',
      );
    }
    if (anonymousId && !ANONYMOUS_ID_PATTERN.test(anonymousId)) {
      throw new BadRequestException('Invalid anonymousId');
    }
    const dup = await this.tasteSignals.findRecentDuplicate({
      userId,
      anonymousId: userId ? undefined : anonymousId,
      signalType: dto.signalType,
      artistId: dto.artistId,
      eventId: dto.eventId,
      withinMs: STRONG_SIGNAL_TYPES.has(dto.signalType) ? 5_000 : 60_000,
    });
    if (dup) {
      return { recorded: false, deduplicated: true, id: String(dup._id ?? '') };
    }

    const doc = await this.tasteSignals.insert({
      userId,
      anonymousId: userId ? undefined : anonymousId,
      eventId: dto.eventId,
      artistId: dto.artistId,
      signalType: dto.signalType,
      mood: dto.mood,
      metadata: sanitizeMetadata(dto.metadata),
      source: 'behavior',
    });

    this.invalidateUserDiscoveryCaches(userId, anonymousId, dto.eventId);

    return {
      recorded: true,
      deduplicated: false,
      id: String(doc._id),
      ttlDays: userId ? null : ANONYMOUS_SIGNAL_TTL_DAYS,
    };
  }

  async mergeAnonymous(actor: RequestActor, anonymousId: string) {
    const userId = actor.resolvedUserId?.trim();
    if (!userId) {
      throw new BadRequestException('Authentication required to merge signals');
    }
    if (!ANONYMOUS_ID_PATTERN.test(anonymousId)) {
      throw new BadRequestException('Invalid anonymousId');
    }
    const result = await this.tasteSignals.mergeAnonymousToUser(
      anonymousId,
      userId,
    );
    this.invalidateUserDiscoveryCaches(userId, anonymousId);
    return { merged: true, ...result };
  }

  async getDiscovery(
    eventId: number,
    actor: RequestActor,
    query: {
      mood?: string;
      anonymousId?: string;
      limit?: number;
      savedArtistIds?: string[];
      weekend?: TomorrowlandBelgiumWeekend;
    },
  ) {
    const roster = await this.loadRoster(eventId, query.weekend);
    const affinity = await this.buildAffinity(eventId, actor, query, roster);
    const ranked = rankLineupDiscovery({
      roster,
      affinity,
      mood: query.mood,
      limit: query.limit ?? 4,
    });

    const savedIds = [
      ...new Set([
        ...(query.savedArtistIds ?? []),
        ...Object.keys(affinity.artistScores).filter(
          (id) => (affinity.artistScores[id] ?? 0) > 0,
        ),
      ]),
    ];
    const clashState = await this.clashResolution.getState(
      eventId,
      actor,
      query.anonymousId,
    );
    const loaded = await this.lineupConflicts.loadClashPerformances(eventId, {
      weekend: query.weekend,
    });
    const withSchedule = <T extends { artistId: string }>(artist: T) => {
      const scheduleCompatibility =
        this.lineupConflicts.scheduleCompatibilityFor(
          artist.artistId,
          savedIds,
          loaded.performances,
          loaded.schedulePublished,
          clashState?.deferredArtistIds,
          clashState?.journeyArtistIds,
          eventId,
        );
      return { ...artist, scheduleCompatibility };
    };

    const pickedForYou = ranked.pickedForYou
      .map(toPublicArtist)
      .map(withSchedule);
    const newDiscoveries = ranked.newDiscoveries
      .map(toPublicArtist)
      .map(withSchedule);
    const wildcard = ranked.wildcard
      ? withSchedule(toPublicArtist(ranked.wildcard))
      : undefined;

    // Soft schedule-aware ordering: keep conflicting artists visible, but prefer fits.
    const scheduleRank = (status: string) =>
      status === 'fits-route'
        ? 0
        : status === 'tight-transfer'
          ? 1
          : status === 'partial-clash'
            ? 2
            : status === 'schedule-pending'
              ? 3
              : 4;
    pickedForYou.sort(
      (a, b) =>
        scheduleRank(a.scheduleCompatibility.status) -
          scheduleRank(b.scheduleCompatibility.status) ||
        (b.score ?? 0) - (a.score ?? 0),
    );

    return {
      ...ranked,
      scheduleVersion: loaded.scheduleVersion,
      pickedForYou,
      newDiscoveries,
      wildcard,
      compatibleAlternative: this.lineupConflicts.pickCompatibleAlternative({
        candidates: roster.map((dj) => dj.id),
        excludeArtistId: pickedForYou[0]?.artistId ?? '',
        selectedArtistIds: savedIds,
        performances: loaded.performances,
        schedulePublished: loaded.schedulePublished,
        eventId,
      }),
    };
  }

  async getFestivalDna(eventId: number, weekend?: TomorrowlandBelgiumWeekend) {
    const roster = await this.loadRoster(eventId, weekend);
    const version = `${roster.length}:${roster
      .map((dj) => dj.id)
      .slice(0, 40)
      .join(',')}`;
    const cacheId = `${eventId}:${weekend ?? 'all'}`;
    const cached = this.dnaCache.get(cacheId);
    if (cached && cached.version === version && cached.expiresAt > Date.now()) {
      return cached.payload;
    }
    const payload = buildFestivalDna(roster);
    this.dnaCache.set(cacheId, {
      version,
      payload,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return payload;
  }

  async getConstellation(
    eventId: number,
    actor: RequestActor,
    query: {
      mood?: string;
      anonymousId?: string;
      focusArtistId?: string;
      limit?: number;
      savedArtistIds?: string[];
      weekend?: TomorrowlandBelgiumWeekend;
    },
  ) {
    const roster = await this.loadRoster(eventId, query.weekend);
    const affinity = await this.buildAffinity(eventId, actor, query, roster);
    const discovery = rankLineupDiscovery({
      roster,
      affinity,
      mood: query.mood,
      limit: query.limit ?? 4,
    });
    const savedIds = Object.keys(affinity.artistScores).filter(
      (id) => (affinity.artistScores[id] ?? 0) > 0,
    );
    const graph = buildConstellationGraph({
      roster,
      discovery,
      savedIds,
      focusArtistId: query.focusArtistId,
      mood: query.mood,
      limit: query.limit ?? 5,
    });

    const clashState = await this.clashResolution.getState(
      eventId,
      actor,
      query.anonymousId,
    );
    const loaded = await this.lineupConflicts.loadClashPerformances(eventId, {
      weekend: query.weekend,
    });
    const nodes = graph.nodes.map((node) => {
      const scheduleCompatibility =
        this.lineupConflicts.scheduleCompatibilityFor(
          node.artistId,
          savedIds.length ? savedIds : (query.savedArtistIds ?? []),
          loaded.performances,
          loaded.schedulePublished,
          clashState?.deferredArtistIds,
          clashState?.journeyArtistIds,
          eventId,
        );
      return {
        ...node,
        scheduleState: scheduleCompatibility.status,
        journeyImpact: {
          status: scheduleCompatibility.status,
          conflictArtistIds: scheduleCompatibility.conflictArtistIds,
          summary: scheduleCompatibility.summary,
        },
      };
    });

    return {
      ...graph,
      nodes,
      scheduleVersion: loaded.scheduleVersion,
    };
  }

  async getMyLineupConflicts(
    eventId: number,
    actor: RequestActor,
    query: {
      anonymousId?: string;
      savedArtistIds?: string[];
      deferredArtistIds?: string[];
      journeyArtistIds?: string[];
      scheduleVersion?: string;
      weekend?: TomorrowlandBelgiumWeekend;
    },
  ) {
    const clashState = await this.clashResolution.getState(
      eventId,
      actor,
      query.anonymousId,
    );
    const selected = query.savedArtistIds?.length
      ? query.savedArtistIds
      : actor.resolvedUserId
        ? ((
            await this.itineraryModel
              .findOne({
                userId: actor.resolvedUserId,
                activityLegacyId: eventId,
              })
              .lean()
          )?.selectedDjIds ?? [])
        : [];

    return this.lineupConflicts.getConflictsForLineup({
      eventId,
      selectedArtistIds: selected,
      deferredArtistIds:
        query.deferredArtistIds ?? clashState?.deferredArtistIds,
      journeyArtistIds: query.journeyArtistIds ?? clashState?.journeyArtistIds,
      priorScheduleVersion:
        query.scheduleVersion ?? clashState?.scheduleVersion,
      priorResolutionConflictIds: clashState?.resolutions
        ?.filter((item) => item.needsReview)
        .map((item) => item.conflictId),
      weekend: query.weekend,
    });
  }

  evaluateArtist(eventId: number, actor: RequestActor, dto: EvaluateArtistDto) {
    void actor;
    return this.lineupConflicts.evaluateArtist({
      eventId,
      artistId: dto.artistId,
      selectedArtistIds: dto.savedArtistIds ?? [],
      deferredArtistIds: dto.deferredArtistIds,
      journeyArtistIds: dto.journeyArtistIds,
      weekend: dto.weekend,
    });
  }

  resolveConflict(
    actor: RequestActor,
    eventId: number,
    dto: ResolveConflictDto,
  ) {
    return this.clashResolution.resolve(actor, {
      eventId,
      conflictId: dto.conflictId,
      optionType: dto.optionType,
      artistAId: dto.artistAId,
      artistBId: dto.artistBId,
      anonymousId: dto.anonymousId,
      expectedScheduleVersion: dto.expectedScheduleVersion,
      expectedRouteVersion: dto.expectedRouteVersion,
      selectedArtistIds: dto.savedArtistIds,
      option: dto.option
        ? {
            id: dto.conflictId,
            type: dto.optionType,
            labelKey: dto.optionType,
            itineraryImpact: dto.option.itineraryImpact ?? [],
            warnings: [],
          }
        : undefined,
    });
  }

  private async loadRoster(
    eventId: number,
    weekend?: TomorrowlandBelgiumWeekend,
  ): Promise<LineupDjInput[]> {
    const schedule = await this.scheduleService.getSchedule(eventId, {
      weekend,
    });
    const seen = new Set<string>();
    return schedule.djs
      .filter((dj) => {
        if (!dj.id || seen.has(dj.id)) return false;
        seen.add(dj.id);
        return true;
      })
      .map((dj) => ({
        id: dj.id,
        name: dj.name,
        genre: dj.genre,
        genreLabel: dj.genreLabel,
        popularity: dj.popularity,
        genreColor: dj.genreColor,
      }));
  }

  private async buildAffinity(
    eventId: number,
    actor: RequestActor,
    query: {
      anonymousId?: string;
      savedArtistIds?: string[];
    },
    roster: LineupDjInput[],
  ) {
    const userId = actor.resolvedUserId?.trim() || undefined;
    const anonymousId =
      !userId &&
      query.anonymousId &&
      ANONYMOUS_ID_PATTERN.test(query.anonymousId)
        ? query.anonymousId
        : undefined;

    if (userId) {
      await this.legacyPersonality.migrateIfNeeded(userId);
      if (query.anonymousId && ANONYMOUS_ID_PATTERN.test(query.anonymousId)) {
        try {
          await this.tasteSignals.mergeAnonymousToUser(
            query.anonymousId,
            userId,
          );
        } catch (error) {
          this.logger.warn(`Anonymous merge skipped: ${String(error)}`);
        }
      }
    }

    const genreByArtist = new Map(
      roster.map((dj) => [dj.id, canonicalizeGenre(dj.genreLabel || dj.genre)]),
    );

    const fromSignals = await this.tasteSignals.aggregateArtistGenreWeights({
      userId,
      anonymousId,
      genreByArtist,
    });

    const artistWeights = { ...fromSignals.artistWeights };
    const genreWeights = { ...fromSignals.genreWeights };

    // Explicit favorites + My Journey / itinerary selections
    if (userId) {
      const favorites = await this.artistLikes.getFavoriteArtistIds(userId);
      for (const id of favorites) {
        artistWeights[id] = (artistWeights[id] ?? 0) + 1;
        const genre = genreByArtist.get(id);
        if (genre) genreWeights[genre] = (genreWeights[genre] ?? 0) + 0.9;
      }

      const itinerary = await this.itineraryModel
        .findOne({ userId, activityLegacyId: eventId })
        .lean();
      for (const id of itinerary?.selectedDjIds ?? []) {
        artistWeights[id] = (artistWeights[id] ?? 0) + 0.95;
        const genre = genreByArtist.get(id);
        if (genre) genreWeights[genre] = (genreWeights[genre] ?? 0) + 0.85;
      }

      // Legacy genres already live in taste_signals after migration.
    }

    // Client My Lineup (anonymous session / localStorage bridge)
    const clientSaved = query.savedArtistIds ?? [];
    for (const id of clientSaved) {
      artistWeights[id] = Math.max(artistWeights[id] ?? 0, 1);
      const genre = genreByArtist.get(id);
      if (genre) genreWeights[genre] = Math.max(genreWeights[genre] ?? 0, 0.9);
    }

    return buildAffinityFromSignals({
      artistWeights,
      genreWeights,
      authenticated: Boolean(userId),
      hasClientSignals: clientSaved.length > 0 || Boolean(anonymousId),
    });
  }

  private invalidateUserDiscoveryCaches(
    userId?: string,
    anonymousId?: string,
    eventId?: string,
  ) {
    const prefix = `${userId ?? ''}:${anonymousId ?? ''}`;
    for (const key of this.discoveryCache.keys()) {
      if (key.startsWith(prefix) || (eventId && key.includes(`:${eventId}:`))) {
        this.discoveryCache.delete(key);
      }
    }
  }
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'weight' || key === 'userId' || key === 'token') continue;
    if (typeof value === 'string' && value.length > 200) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function toPublicArtist(artist: {
  artistId: string;
  name: string;
  primaryGenre?: string;
  genreColor?: string;
  score: number;
  label: string;
  reasons: string[];
  relatedToArtistIds: string[];
}) {
  return {
    artistId: artist.artistId,
    name: artist.name,
    primaryGenre: artist.primaryGenre,
    genreColor: artist.genreColor,
    // Round to avoid false precision in frontend
    score: Math.round(artist.score * 100) / 100,
    label: artist.label,
    reasons: artist.reasons,
    relatedToArtistIds: artist.relatedToArtistIds,
  };
}
