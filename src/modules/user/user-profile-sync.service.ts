import { Injectable, Logger } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type { UserMatchProfile } from './user-profile-hints.util';
import { UserService } from './user.service';
import {
  buildPersonalityProfileHints,
  buildSetVoteProfileHints,
  buildTravelGuideProfileHints,
  hasUserMatchProfileHints,
  mergeUserProfileHints,
  userMatchProfilesEqual,
  type UserMatchProfileHints,
} from './user-profile-hints.util';

/** Writes city / favorGenres / budgetLevel only from explicit user actions. */
@Injectable()
export class UserProfileSyncService {
  private readonly logger = new Logger(UserProfileSyncService.name);

  constructor(private readonly userService: UserService) {}

  async applyHints(
    actor: RequestActor,
    hints: UserMatchProfileHints,
    source: string,
  ): Promise<boolean> {
    if (!hasUserMatchProfileHints(hints)) return false;
    if (!actor.clientUserId?.trim()) return false;

    let existing: UserMatchProfile | undefined;
    try {
      const me = await this.userService.getMe(actor);
      existing = {
        city: me.city,
        favorGenres: me.favorGenres,
        budgetLevel: me.budgetLevel,
      };
    } catch {
      existing = undefined;
    }

    const merged = mergeUserProfileHints(existing, hints);
    if (userMatchProfilesEqual(existing, merged)) {
      return false;
    }

    try {
      await this.userService.patchMe(
        {
          city: merged.city,
          favorGenres: merged.favorGenres,
          budgetLevel: merged.budgetLevel,
        },
        actor,
      );
      this.logger.log({
        msg: 'user_profile_synced',
        source,
        clientUserId: actor.clientUserId,
        city: merged.city,
        favorGenres: merged.favorGenres,
        budgetLevel: merged.budgetLevel,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `user profile sync failed (${source}): ${(error as Error).message}`,
      );
      return false;
    }
  }

  applyTravelGuideHints(
    actor: RequestActor,
    params: Parameters<typeof buildTravelGuideProfileHints>[0],
  ): void {
    const hints = buildTravelGuideProfileHints(params);
    void this.applyHints(actor, hints, 'travel_guide');
  }

  applyPersonalityTestHints(
    actor: RequestActor,
    params: Parameters<typeof buildPersonalityProfileHints>[0],
  ): void {
    const hints = buildPersonalityProfileHints(params);
    void this.applyHints(actor, hints, 'personality_test');
  }

  applySetVoteHints(
    actor: RequestActor,
    params: Parameters<typeof buildSetVoteProfileHints>[0],
  ): void {
    const hints = buildSetVoteProfileHints(params);
    void this.applyHints(actor, hints, 'set_vote');
  }
}
