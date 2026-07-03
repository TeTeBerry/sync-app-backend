import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Activity } from '../../database/schemas/activity.schema';
import { NoticeAgent } from '../../ai/agents/notice.agent';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  type IActivityRegistrationRepository,
} from '../activity/registration/interfaces/activity-registration.repository.interface';
import { UserGoalKind } from './goal.model';
import { UserGoalService } from './goal.service';

@Injectable()
export class GoalOrchestrator {
  constructor(
    private readonly goalService: UserGoalService,
    @Optional() private readonly noticeAgent?: NoticeAgent,
    @Optional()
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository?: IActivityRegistrationRepository,
  ) {}

  async onLineupPublished(
    activity: Pick<Activity, 'legacyId' | 'name' | 'date' | 'location'>,
    changeSummary: string,
  ): Promise<void> {
    if (!this.noticeAgent || !this.registrationRepository) {
      return;
    }

    const [registeredUserIds, wechatUserIds, goals] = await Promise.all([
      this.registrationRepository.findRegisteredUserIds(activity.legacyId),
      this.registrationRepository.findWechatActivityUpdateOptInUserIds(
        activity.legacyId,
      ),
      this.goalService.findActiveByActivityLegacyId(activity.legacyId),
    ]);

    const goalUserIds = goals
      .filter((g) => g.kind === UserGoalKind.WATCH_LINEUP)
      .map((g) => g.userId.trim())
      .filter(Boolean);

    const allUserIds = [
      ...new Set(
        [...registeredUserIds, ...goalUserIds]
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];

    if (allUserIds.length) {
      void this.noticeAgent.notifyActivityUpdate(
        allUserIds,
        activity.legacyId,
        activity.name,
        changeSummary,
        activity.date,
        activity.location,
        wechatUserIds,
      );
    }

    for (const goal of goals) {
      if (goal.kind !== UserGoalKind.WATCH_LINEUP) continue;

      await this.goalService.update(String(goal._id), {
        lastRunAt: new Date().toISOString(),
        lastResult: {
          ...(goal.lastResult ?? {}),
          changeSummary,
        },
      });
    }
  }
}
