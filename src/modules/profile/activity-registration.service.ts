import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { resolveActorUserId } from '../../ai/utils/actor-user.util';
import { isDemoOwnerClient } from '../../common/utils/demo-owner.util';
import { resolveOwnerFilter } from '../../common/utils/owner-filter.util';
import { ActivityService } from '../activity/activity.service';
import { UserService } from '../user/user.service';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  IActivityRegistrationRepository,
} from './interfaces/activity-registration.repository.interface';

function resolveActorAuthorName(
  userId?: string,
  authorName?: string,
  fallbackName?: string,
): string | undefined {
  const name = authorName?.trim() || fallbackName?.trim();
  if (name) return name;
  if (isDemoOwnerClient(userId, authorName)) {
    return 'Zara Chen';
  }
  return undefined;
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
    @Inject(forwardRef(() => ActivityService))
    private readonly activityService: ActivityService,
    private readonly userService: UserService,
  ) {}

  async register(
    legacyId: number,
    userId?: string,
    authorName?: string,
  ): Promise<ActivityRegistrationResultDto> {
    const activity = await this.activityService.findByLegacyId(legacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${legacyId} not found`);
    }

    const filter = resolveOwnerFilter(userId, authorName);
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

    const profile = await this.userService.resolveProfile(userId, authorName);
    const actorUserId = resolveActorUserId(userId, authorName);
    const actorName = resolveActorAuthorName(
      userId,
      authorName,
      profile?.name,
    );

    try {
      await this.registrationRepository.create({
        userId: actorUserId,
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

    return {
      ok: true,
      activityLegacyId: legacyId,
      status: 'registered',
    };
  }

  async listRegisteredUserIds(activityLegacyId: number): Promise<string[]> {
    return this.registrationRepository.findRegisteredUserIds(activityLegacyId);
  }

  async listRegisteredLegacyIds(
    userId?: string,
    authorName?: string,
  ): Promise<Set<number>> {
    const filter = resolveOwnerFilter(userId, authorName);
    const registrations = await this.registrationRepository.findByOwner(filter);
    return new Set(registrations.map(registration => registration.activityLegacyId));
  }

  async unregister(
    legacyId: number,
    userId?: string,
    authorName?: string,
  ): Promise<ActivityUnregisterResultDto> {
    const activity = await this.activityService.findByLegacyId(legacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${legacyId} not found`);
    }

    const filter = resolveOwnerFilter(userId, authorName);
    const removed = await this.registrationRepository.deleteByOwnerAndActivity(
      filter,
      legacyId,
    );

    return {
      ok: true,
      activityLegacyId: legacyId,
      wasRegistered: removed,
    };
  }
}
