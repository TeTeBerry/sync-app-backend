import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { ownerFilterFromActor } from '../../../common/auth/actor-query.util';
import { UserService } from '../../user/user.service';
import { ActivityService } from '../activity.service';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../ports/activity-lookup.port';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  IActivityRegistrationRepository,
} from './interfaces/activity-registration.repository.interface';
import { BffReadCacheInvalidationService } from '../../../infra/cache/bff-read-cache.service';
import type {
  ActivityRegistrationResult,
  ActivityUnregisterResult,
  ActivityWechatUpdateOptInResult,
} from '@sync/activity-contracts';

function resolveActorAuthorName(
  actor: RequestActor,
  fallbackName?: string,
): string | undefined {
  return actor.displayName?.trim() || fallbackName?.trim() || undefined;
}

export type ActivityRegistrationResultDto = ActivityRegistrationResult;

export type ActivityUnregisterResultDto = ActivityUnregisterResult;

export type ActivityWechatUpdateOptInResultDto =
  ActivityWechatUpdateOptInResult;

@Injectable()
export class ActivityRegistrationService {
  constructor(
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository: IActivityRegistrationRepository,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly activityService: ActivityService,
    private readonly userService: UserService,
    private readonly bffCacheInvalidation: BffReadCacheInvalidationService,
  ) {}

  async register(
    legacyId: number,
    actor: RequestActor,
  ): Promise<ActivityRegistrationResultDto> {
    const activity = await this.activityLookup.findByLegacyId(legacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${legacyId} not found`);
    }

    const filter = ownerFilterFromActor(actor);
    const existing = await this.registrationRepository.findByOwnerAndActivity(
      filter,
      legacyId,
    );
    if (existing) {
      return {
        ok: true,
        activityLegacyId: legacyId,
        status: 'registered',
        alreadyRegistered: true,
        attendees: activity.attendees ?? 0,
      };
    }

    const profile = await this.userService.resolveProfile(actor);
    const actorName = resolveActorAuthorName(actor, profile?.name);

    try {
      await this.registrationRepository.create({
        userId: actor.resolvedUserId,
        authorName: actorName,
        activityLegacyId: legacyId,
        status: 'registered',
      });
    } catch (error) {
      const code = (error as { code?: number })?.code;
      if (code === 11000) {
        const refreshed = await this.activityLookup.findByLegacyId(legacyId);
        return {
          ok: true,
          activityLegacyId: legacyId,
          status: 'registered',
          alreadyRegistered: true,
          attendees: refreshed?.attendees ?? activity.attendees ?? 0,
        };
      }
      throw error;
    }

    await this.activityService.syncAttendeeCounts([legacyId]);
    const refreshed = await this.activityLookup.findByLegacyId(legacyId);

    await this.bffCacheInvalidation.invalidateHomeForUser(actor.resolvedUserId);
    await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
      actor.resolvedUserId,
      legacyId,
    );

    return {
      ok: true,
      activityLegacyId: legacyId,
      status: 'registered',
      attendees: refreshed?.attendees ?? (activity.attendees ?? 0) + 1,
    };
  }

  async listRegisteredUserIds(activityLegacyId: number): Promise<string[]> {
    return this.registrationRepository.findRegisteredUserIds(activityLegacyId);
  }

  async optInWechatActivityUpdates(
    legacyId: number,
    actor: RequestActor,
  ): Promise<ActivityWechatUpdateOptInResultDto> {
    const activity = await this.activityLookup.findByLegacyId(legacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${legacyId} not found`);
    }

    const filter = ownerFilterFromActor(actor);
    const existing = await this.registrationRepository.findByOwnerAndActivity(
      filter,
      legacyId,
    );
    if (!existing) {
      throw new NotFoundException(
        `Activity ${legacyId} registration not found for current user`,
      );
    }

    await this.registrationRepository.setWechatActivityUpdateOptIn(
      filter,
      legacyId,
    );

    return {
      ok: true,
      activityLegacyId: legacyId,
      wechatActivityUpdateOptIn: true,
    };
  }

  async listRegisteredLegacyIds(actor: RequestActor): Promise<Set<number>> {
    const filter = ownerFilterFromActor(actor);
    const registrations = await this.registrationRepository.findByOwner(filter);
    return new Set(
      registrations.map((registration) => registration.activityLegacyId),
    );
  }

  async listAllRegistered(): Promise<
    Array<{ userId: string; activityLegacyId: number }>
  > {
    return this.registrationRepository.findAllRegistered();
  }

  async unregister(
    legacyId: number,
    actor: RequestActor,
  ): Promise<ActivityUnregisterResultDto> {
    const activity = await this.activityLookup.findByLegacyId(legacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${legacyId} not found`);
    }

    const filter = ownerFilterFromActor(actor);
    const removed = await this.registrationRepository.deleteByOwnerAndActivity(
      filter,
      legacyId,
    );

    if (removed) {
      await this.activityService.syncAttendeeCounts([legacyId]);
    }

    const refreshed = await this.activityLookup.findByLegacyId(legacyId);

    if (removed) {
      await this.bffCacheInvalidation.invalidateHomeForUser(
        actor.resolvedUserId,
      );
      await this.bffCacheInvalidation.invalidateFestivalPlanForUser(
        actor.resolvedUserId,
        legacyId,
      );
    }

    return {
      ok: true,
      activityLegacyId: legacyId,
      wasRegistered: removed,
      attendees: refreshed?.attendees ?? activity.attendees ?? 0,
    };
  }
}
