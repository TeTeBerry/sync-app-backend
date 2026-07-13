import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  UserLineupClashState,
  UserLineupClashStateDocument,
} from '../../database/schemas/user-lineup-clash-state.schema';
import {
  UserItinerary,
  UserItineraryDocument,
} from '../../database/schemas/user-itinerary.schema';
import type {
  ClashResolutionOption,
  ClashResolutionOptionType,
  LineupConflict,
} from './domain/lineup-conflict.util';
import { LineupConflictService } from './lineup-conflict.service';

export type ResolveConflictInput = {
  eventId: number;
  conflictId: string;
  optionType: ClashResolutionOptionType;
  option?: ClashResolutionOption;
  artistAId: string;
  artistBId: string;
  expectedScheduleVersion?: string;
  expectedRouteVersion?: string;
  anonymousId?: string;
  selectedArtistIds?: string[];
};

@Injectable()
export class ClashResolutionService {
  constructor(
    private readonly conflicts: LineupConflictService,
    @InjectModel(UserLineupClashState.name)
    private readonly clashStateModel: Model<UserLineupClashStateDocument>,
    @InjectModel(UserItinerary.name)
    private readonly itineraryModel: Model<UserItineraryDocument>,
  ) {}

  async getState(
    eventId: number,
    actor: RequestActor,
    anonymousId?: string,
  ): Promise<UserLineupClashState | null> {
    const userId = actor.resolvedUserId?.trim() || undefined;
    if (userId) {
      return this.clashStateModel
        .findOne({ userId, activityLegacyId: eventId })
        .lean();
    }
    if (anonymousId) {
      return this.clashStateModel
        .findOne({ anonymousId, activityLegacyId: eventId })
        .lean();
    }
    return null;
  }

  async resolve(
    actor: RequestActor,
    input: ResolveConflictInput,
  ): Promise<{
    scheduleVersion: string;
    routeVersion: string;
    applied: {
      optionType: ClashResolutionOptionType;
      deferredArtistIds: string[];
      journeyArtistIds: string[];
    };
    revalidation: Awaited<
      ReturnType<LineupConflictService['getConflictsForLineup']>
    >;
    journeyUpdated: boolean;
  }> {
    const userId = actor.resolvedUserId?.trim() || undefined;
    if (!userId && !input.anonymousId) {
      throw new BadRequestException(
        'Authentication or anonymousId is required to resolve conflicts',
      );
    }

    const loaded = await this.conflicts.loadClashPerformances(input.eventId);
    if (
      input.expectedScheduleVersion &&
      input.expectedScheduleVersion !== loaded.scheduleVersion
    ) {
      throw new ConflictException({
        message: 'Schedule version is stale — re-evaluate conflicts',
        scheduleVersion: loaded.scheduleVersion,
        expected: input.expectedScheduleVersion,
      });
    }

    const existing = (await this.getState(
      input.eventId,
      actor,
      input.anonymousId,
    )) ?? {
      deferredArtistIds: [] as string[],
      journeyArtistIds: [] as string[],
      resolutions: [] as UserLineupClashState['resolutions'],
      routeVersion: '0',
    };

    if (
      input.expectedRouteVersion &&
      existing.routeVersion &&
      input.expectedRouteVersion !== existing.routeVersion
    ) {
      throw new ConflictException({
        message: 'Route version is stale — reload My Lineup',
        routeVersion: existing.routeVersion,
        expected: input.expectedRouteVersion,
      });
    }

    const deferred = new Set(existing.deferredArtistIds ?? []);
    const journey = new Set(existing.journeyArtistIds ?? []);

    if (input.optionType === 'keep-artist-a') {
      journey.add(input.artistAId);
      journey.delete(input.artistBId);
      deferred.add(input.artistBId);
      deferred.delete(input.artistAId);
    } else if (input.optionType === 'keep-artist-b') {
      journey.add(input.artistBId);
      journey.delete(input.artistAId);
      deferred.add(input.artistAId);
      deferred.delete(input.artistBId);
    } else if (input.optionType === 'split-both') {
      journey.add(input.artistAId);
      journey.add(input.artistBId);
      deferred.delete(input.artistAId);
      deferred.delete(input.artistBId);
    } else {
      deferred.add(input.artistAId);
      if (input.artistAId !== input.artistBId) deferred.add(input.artistBId);
      journey.delete(input.artistAId);
      journey.delete(input.artistBId);
    }

    const resolutions = [
      ...(existing.resolutions ?? []).filter(
        (item) => item.conflictId !== input.conflictId,
      ),
      {
        conflictId: input.conflictId,
        optionType: input.optionType,
        keptArtistId:
          input.optionType === 'keep-artist-a'
            ? input.artistAId
            : input.optionType === 'keep-artist-b'
              ? input.artistBId
              : undefined,
        deferredArtistId:
          input.optionType === 'keep-artist-a'
            ? input.artistBId
            : input.optionType === 'keep-artist-b'
              ? input.artistAId
              : undefined,
        watchWindows: input.option?.itineraryImpact,
        scheduleVersion: loaded.scheduleVersion,
        resolvedAt: new Date().toISOString(),
        needsReview: false,
      },
    ];

    const routeVersion = String(Number(existing.routeVersion ?? '0') + 1);
    const filter = userId
      ? { userId, activityLegacyId: input.eventId }
      : { anonymousId: input.anonymousId, activityLegacyId: input.eventId };

    await this.clashStateModel.findOneAndUpdate(
      filter,
      {
        $set: {
          userId,
          anonymousId: userId ? undefined : input.anonymousId,
          activityLegacyId: input.eventId,
          scheduleVersion: loaded.scheduleVersion,
          deferredArtistIds: [...deferred],
          journeyArtistIds: [...journey],
          resolutions,
          routeVersion,
        },
      },
      { upsert: true, new: true },
    );

    let journeyUpdated = false;
    if (userId) {
      const itinerary = await this.itineraryModel
        .findOne({ userId, activityLegacyId: input.eventId })
        .lean();
      if (itinerary) {
        // Keep My Lineup (selectedDjIds) intact; journey route follows clash journey set.
        // If journey artists diverge from selected, still preserve selected as the full set.
        const nextSelected = [
          ...new Set([
            ...(itinerary.selectedDjIds ?? []),
            input.artistAId,
            input.artistBId,
          ]),
        ];
        await this.itineraryModel.updateOne(
          { userId, activityLegacyId: input.eventId },
          {
            $set: {
              selectedDjIds: nextSelected,
              lastEditedByUserId: userId,
            },
          },
        );
        journeyUpdated = true;
      } else {
        // Seed a lightweight itinerary so Journey consumers see the decision.
        await this.itineraryModel.create({
          userId,
          activityLegacyId: input.eventId,
          selectedDjIds: [...journey],
          eventMeta: `activity:${input.eventId}`,
          days: [],
          lastEditedByUserId: userId,
        });
        journeyUpdated = true;
      }
    }

    const selectedArtistIds =
      input.selectedArtistIds ??
      (userId
        ? ((
            await this.itineraryModel
              .findOne({ userId, activityLegacyId: input.eventId })
              .lean()
          )?.selectedDjIds ?? [...journey, ...deferred])
        : [...journey, ...deferred]);

    // Full-day revalidation after every confirmed change
    const revalidation = await this.conflicts.getConflictsForLineup({
      eventId: input.eventId,
      selectedArtistIds,
      deferredArtistIds: [...deferred],
      journeyArtistIds: [...journey],
      priorScheduleVersion: loaded.scheduleVersion,
    });

    return {
      scheduleVersion: loaded.scheduleVersion,
      routeVersion,
      applied: {
        optionType: input.optionType,
        deferredArtistIds: [...deferred],
        journeyArtistIds: [...journey],
      },
      revalidation,
      journeyUpdated,
    };
  }

  /**
   * Mark prior resolutions as needing review when timetable fingerprint changes.
   */
  async invalidateForScheduleChange(
    eventId: number,
    newScheduleVersion: string,
  ): Promise<{ updated: number }> {
    const result = await this.clashStateModel.updateMany(
      {
        activityLegacyId: eventId,
        scheduleVersion: { $ne: newScheduleVersion },
      },
      {
        $set: {
          scheduleVersion: newScheduleVersion,
          'resolutions.$[].needsReview': true,
        },
      },
    );
    return { updated: result.modifiedCount ?? 0 };
  }
}
