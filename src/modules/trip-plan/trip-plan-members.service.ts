import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { UserService } from '../user/user.service';
import { TripPlanService } from './trip-plan.service';

export type TripPlanMemberProfileDto = {
  userId: string;
  name: string;
  avatar: string;
  isOwner: boolean;
};

@Injectable()
export class TripPlanMembersService {
  constructor(
    private readonly tripPlanService: TripPlanService,
    private readonly userService: UserService,
  ) {}

  async listMembers(
    tripPlanId: string,
    actor: RequestActor,
  ): Promise<TripPlanMemberProfileDto[]> {
    const tripPlan = await this.tripPlanService.getById(tripPlanId, actor);
    const profiles = await this.userService.findAuthorSummariesByExternalIds(
      tripPlan.memberIds,
    );

    return tripPlan.memberIds.map((userId) => {
      const profile = profiles.get(userId);
      return {
        userId,
        name: profile?.name?.trim() || '',
        avatar: profile?.avatar?.trim() || '',
        isOwner: userId === tripPlan.ownerId,
      };
    });
  }
}
