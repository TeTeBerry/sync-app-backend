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

function resolveActorAuthorName(
  actor: RequestActor,
  fallbackName?: string,
): string | undefined {
  return actor.displayName?.trim() || fallbackName?.trim() || undefined;
}

export interface ActivityRegistrationResultDto {
  ok: true;
  activityLegacyId: number;
  status: 'registered';
  alreadyRegistered?: boolean;
}

export interface ActivityUnregisterResultDto {
  ok: true;
  activityLegacyId: number;
  wasRegistered?: boolean;
}

@Injectable()
export class ActivityRegistrationService {
  constructor(
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository: IActivityRegistrationRepository,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly activityService: ActivityService,
    private readonly userService: UserService,
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
        return {
          ok: true,
          activityLegacyId: legacyId,
          status: 'registered',
          alreadyRegistered: true,
        };
      }
      throw error;
    }

    await this.activityService.syncAttendeeCounts([legacyId]);

    return {
      ok: true,
      activityLegacyId: legacyId,
      status: 'registered',
    };
  }

  async listRegisteredUserIds(activityLegacyId: number): Promise<string[]> {
    return this.registrationRepository.findRegisteredUserIds(activityLegacyId);
  }

  async listRegisteredLegacyIds(actor: RequestActor): Promise<Set<number>> {
    const filter = ownerFilterFromActor(actor);
    const registrations = await this.registrationRepository.findByOwner(filter);
    return new Set(
      registrations.map((registration) => registration.activityLegacyId),
    );
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

    return {
      ok: true,
      activityLegacyId: legacyId,
      wasRegistered: removed,
    };
  }
}
