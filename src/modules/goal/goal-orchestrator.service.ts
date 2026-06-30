import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Activity } from '../../database/schemas/activity.schema';
import { toRequestActor } from '../../common/auth/actor-query.util';
import { NoticeAgent } from '../../ai/agents/notice.agent';
import { SceneRunService } from '../../ai/scene/scene-run.service';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  type IActivityRegistrationRepository,
} from '../activity/registration/interfaces/activity-registration.repository.interface';
import {
  UserGoalArtifactKind,
  UserGoalKind,
  type UserGoalDocument,
} from './goal.model';
import { UserGoalService } from './goal.service';

const ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function deriveComposeDates(activityDate?: string): {
  dateStart: string;
  dateEnd: string;
} {
  const raw = activityDate?.trim() ?? '';
  if (!raw) {
    const today = new Date().toISOString().slice(0, 10);
    return { dateStart: today, dateEnd: today };
  }
  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    const date = isoMatch[0];
    return { dateStart: date, dateEnd: date };
  }
  return { dateStart: raw, dateEnd: raw };
}

@Injectable()
export class GoalOrchestrator {
  private readonly logger = new Logger(GoalOrchestrator.name);

  constructor(
    private readonly goalService: UserGoalService,
    @Optional() private readonly noticeAgent?: NoticeAgent,
    @Optional() private readonly sceneRunService?: SceneRunService,
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

      if (goal.params?.draftRecruitOnLineup) {
        await this.generateRecruitDraft(goal, activity);
      }
    }
  }

  private async generateRecruitDraft(
    goal: UserGoalDocument,
    activity: Pick<Activity, 'legacyId' | 'name' | 'date' | 'location'>,
  ): Promise<void> {
    if (!this.sceneRunService || !this.noticeAgent) return;

    try {
      const { dateStart, dateEnd } = deriveComposeDates(activity.date);
      const location =
        goal.params?.departureCity?.trim() || activity.location?.trim() || '';

      const response = await this.sceneRunService.run(
        {
          scene: 'recruit_compose',
          activityLegacyId: activity.legacyId,
          context: {
            trigger: 'page_enter',
            dateStart,
            dateEnd,
            location,
            headcount: '2',
          },
        },
        toRequestActor(goal.userId),
      );

      const candidatesEffect = response.effects.find(
        (e) => e.type === 'candidates',
      );
      if (!candidatesEffect || candidatesEffect.type !== 'candidates') {
        return;
      }

      const artifactId = randomUUID();
      const now = Date.now();
      await this.goalService.saveArtifact({
        artifactId,
        goalId: String(goal._id),
        userId: goal.userId,
        activityLegacyId: activity.legacyId,
        kind: UserGoalArtifactKind.RECRUIT_DRAFT,
        payload: { candidates: candidatesEffect.items },
        expiresAt: new Date(now + ARTIFACT_TTL_MS).toISOString(),
      });

      await this.goalService.update(String(goal._id), {
        lastResult: {
          changeSummary: '阵容已官宣',
          artifactId,
        },
      });

      await this.noticeAgent.notifyProactiveNudge({
        userId: goal.userId,
        activityLegacyId: activity.legacyId,
        ruleId: 'draft_ready',
        copy: '阵容已官宣，招募草稿已备好',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to generate recruit draft for goal ${String(goal._id)}: ${error}`,
      );
    }
  }
}
