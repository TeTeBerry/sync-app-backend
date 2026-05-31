import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ArtistPerformance,
  ArtistPerformanceDocument,
} from '../../database/schemas/artist-performance.schema';
import {
  FestivalSession,
  FestivalSessionDocument,
} from '../../database/schemas/festival-session.schema';
import { ActivityService } from '../activity/activity.service';
import {
  ARTIST_PERFORMANCE_SEED,
  FESTIVAL_SESSION_SEED,
  ITINERARY_DEMO_ACTIVITY_LEGACY_ID,
} from './itinerary.seed';
import { ItineraryCacheService } from './itinerary-cache.service';
import { ItineraryChromaService } from './itinerary-chroma.service';
import {
  detectPerformanceConflicts,
  type ItineraryConflict,
  type PerformanceSlot,
} from './domain/itinerary-conflict.util';

export interface ItineraryDjDto {
  id: string;
  name: string;
  genre: string;
  genreLabel: string;
  stage: string;
  popularity: number;
  avatarSeed: string;
  genreColor: string;
}

export interface ItineraryScheduleDto {
  activityLegacyId: number;
  eventMeta: string;
  sessions: Array<{
    dateKey: string;
    label: string;
    bannerDateLabel: string;
  }>;
  djs: ItineraryDjDto[];
  performances: Array<{
    artistId: string;
    artistName: string;
    dateKey: string;
    dateLabel: string;
    genre: string;
    genreLabel: string;
    stage: string;
    stageLabel: string;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
    popularity: number;
    avatarSeed: string;
    genreColor: string;
  }>;
  conflicts: ItineraryConflict[];
}

@Injectable()
export class ItineraryScheduleService implements OnModuleInit {
  constructor(
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformanceDocument>,
    @InjectModel(FestivalSession.name)
    private readonly sessionModel: Model<FestivalSessionDocument>,
    private readonly activityService: ActivityService,
    private readonly cache: ItineraryCacheService,
    private readonly chroma: ItineraryChromaService,
  ) {}

  async onModuleInit() {
    await this.seedDemoData();
  }

  async seedDemoData() {
    for (const session of FESTIVAL_SESSION_SEED) {
      await this.sessionModel.findOneAndUpdate(
        {
          activityLegacyId: session.activityLegacyId,
          dateKey: session.dateKey,
        },
        session,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    for (const perf of ARTIST_PERFORMANCE_SEED) {
      await this.performanceModel.findOneAndUpdate(
        {
          activityLegacyId: perf.activityLegacyId,
          dateKey: perf.dateKey,
          artistId: perf.artistId,
        },
        perf,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    await this.performanceModel.deleteMany({
      activityLegacyId: ITINERARY_DEMO_ACTIVITY_LEGACY_ID,
      $nor: ARTIST_PERFORMANCE_SEED.map(p => ({
        dateKey: p.dateKey,
        artistId: p.artistId,
      })),
    });

    const all = await this.performanceModel
      .find({ activityLegacyId: ITINERARY_DEMO_ACTIVITY_LEGACY_ID })
      .lean()
      .exec();
    await this.chroma.indexPerformances(all as ArtistPerformance[]);
  }

  async getSchedule(
    activityLegacyId: number,
    options?: {
      dateKey?: string;
      selectedDjIds?: string[];
    },
  ): Promise<ItineraryScheduleDto> {
    const cached = await this.cache.getScheduleCache<ItineraryScheduleDto>(
      activityLegacyId,
      options?.dateKey,
    );
    if (cached && !options?.selectedDjIds?.length) {
      return cached;
    }

    const activity = await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    const sessionFilter: Record<string, unknown> = { activityLegacyId };
    const perfFilter: Record<string, unknown> = { activityLegacyId };
    if (options?.dateKey) {
      sessionFilter.dateKey = options.dateKey;
      perfFilter.dateKey = options.dateKey;
    }

    const [sessions, performances] = await Promise.all([
      this.sessionModel.find(sessionFilter).sort({ sortOrder: 1 }).lean().exec(),
      this.performanceModel.find(perfFilter).lean().exec(),
    ]);

    const eventMeta = activity.name;
    const djs = this.aggregateDjs(performances as ArtistPerformance[]);
    const slots = this.toPerformanceSlots(performances as ArtistPerformance[]);
    const conflicts = options?.selectedDjIds?.length
      ? detectPerformanceConflicts(slots, options.selectedDjIds)
      : [];

    const dto: ItineraryScheduleDto = {
      activityLegacyId,
      eventMeta,
      sessions: sessions.map(s => ({
        dateKey: s.dateKey,
        label: s.label,
        bannerDateLabel: s.bannerDateLabel,
      })),
      djs,
      performances: (performances as ArtistPerformance[]).map(p => ({
        artistId: p.artistId,
        artistName: p.artistName,
        dateKey: p.dateKey,
        dateLabel: p.dateLabel,
        genre: p.genre,
        genreLabel: p.genreLabel,
        stage: p.stage,
        stageLabel: p.stageLabel,
        startTime: p.startTime,
        endTime: p.endTime,
        startMinutes: p.startMinutes,
        endMinutes: p.endMinutes,
        popularity: p.popularity,
        avatarSeed: p.avatarSeed,
        genreColor: p.genreColor,
      })),
      conflicts,
    };

    if (!options?.selectedDjIds?.length) {
      await this.cache.setScheduleCache(activityLegacyId, dto, options?.dateKey);
    }

    return dto;
  }

  async loadPerformances(
    activityLegacyId: number,
    dateKey?: string,
  ): Promise<{
    sessions: FestivalSession[];
    performances: ArtistPerformance[];
  }> {
    const perfFilter: Record<string, unknown> = { activityLegacyId };
    if (dateKey) perfFilter.dateKey = dateKey;

    const [sessions, performances] = await Promise.all([
      this.sessionModel
        .find({ activityLegacyId })
        .sort({ sortOrder: 1 })
        .lean()
        .exec(),
      this.performanceModel.find(perfFilter).lean().exec(),
    ]);

    return {
      sessions: sessions as FestivalSession[],
      performances: performances as ArtistPerformance[],
    };
  }

  detectConflicts(
    performances: ArtistPerformance[],
    selectedDjIds: string[],
  ): ItineraryConflict[] {
    return detectPerformanceConflicts(
      this.toPerformanceSlots(performances),
      selectedDjIds,
    );
  }

  private aggregateDjs(performances: ArtistPerformance[]): ItineraryDjDto[] {
    const map = new Map<string, ItineraryDjDto>();
    for (const p of performances) {
      const existing = map.get(p.artistId);
      if (!existing || p.popularity > existing.popularity) {
        map.set(p.artistId, {
          id: p.artistId,
          name: p.artistName,
          genre: p.genre,
          genreLabel: p.genreLabel,
          stage: p.stage,
          popularity: p.popularity,
          avatarSeed: p.avatarSeed,
          genreColor: p.genreColor,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.popularity - a.popularity);
  }

  private toPerformanceSlots(
    performances: ArtistPerformance[],
  ): PerformanceSlot[] {
    return performances.map(p => ({
      artistId: p.artistId,
      artistName: p.artistName,
      dateKey: p.dateKey,
      startMinutes: p.startMinutes,
      endMinutes: p.endMinutes,
      startTime: p.startTime,
      endTime: p.endTime,
      stageLabel: p.stageLabel,
    }));
  }
}
