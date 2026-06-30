import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ActivityRegistrationService } from '../activity/registration/activity-registration.service';
import {
  UserGoalDocument,
  UserGoalSchema,
  UserGoalKind,
  UserGoalStatus,
} from './goal.model';
import { CreateUserGoalDto, UpdateUserGoalDto } from './goal.dto';
import { Model } from 'mongoose';
import type { UserGoalArtifactDocument } from './goal.model';
import { UserGoalArtifactSchema } from './goal.model';

@Injectable()
export class UserGoalService {
  constructor(
    @InjectModel('UserGoal')
    private readonly goalModel: Model<UserGoalDocument>,
    private readonly registrationService: ActivityRegistrationService,
  ) {}

  async create(
    actor: RequestActor,
    dto: CreateUserGoalDto,
  ): Promise<UserGoalDocument> {
    const userId = actor.resolvedUserId;

    if (dto.kind === UserGoalKind.WATCH_LINEUP) {
      await this.registrationService.register(dto.activityLegacyId, actor);
      if (dto.params?.notifyWechat !== false) {
        await this.registrationService.optInWechatActivityUpdates(
          dto.activityLegacyId,
          actor,
        );
      }
    }

    const existing = await this.goalModel.findOne({
      userId,
      activityLegacyId: dto.activityLegacyId,
      kind: dto.kind,
    });

    const params = {
      notifyWechat: dto.params?.notifyWechat ?? true,
      draftRecruitOnLineup: dto.params?.draftRecruitOnLineup ?? false,
      departureCity: dto.params?.departureCity ?? '',
    };

    if (existing) {
      existing.status = UserGoalStatus.ACTIVE;
      existing.params = { ...existing.params, ...params };
      existing.updatedAt = new Date().toISOString();
      return existing.save();
    }

    return this.goalModel.create({
      userId,
      activityLegacyId: dto.activityLegacyId,
      kind: dto.kind,
      params,
      status: UserGoalStatus.ACTIVE,
    });
  }

  async findByUser(
    userId: string,
    activityLegacyId?: number,
  ): Promise<UserGoalDocument[]> {
    const filter: Record<string, unknown> = { userId };
    if (activityLegacyId) filter.activityLegacyId = activityLegacyId;
    return this.goalModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findById(goalId: string): Promise<UserGoalDocument | null> {
    return this.goalModel.findById(goalId).exec();
  }

  async findActiveGoals(): Promise<UserGoalDocument[]> {
    return this.goalModel
      .find({ status: UserGoalStatus.ACTIVE })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActiveByActivityLegacyId(
    activityLegacyId: number,
  ): Promise<UserGoalDocument[]> {
    return this.goalModel
      .find({
        activityLegacyId,
        status: UserGoalStatus.ACTIVE,
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findActive(goalId: string): Promise<UserGoalDocument | null> {
    return this.goalModel
      .findOne({ _id: goalId, status: UserGoalStatus.ACTIVE })
      .exec();
  }

  async update(
    goalId: string,
    dto: UpdateUserGoalDto,
  ): Promise<UserGoalDocument> {
    const updated = await this.goalModel
      .findByIdAndUpdate(
        goalId,
        { $set: { ...dto, updatedAt: new Date().toISOString() } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Goal not found');
    return updated;
  }

  async remove(actor: RequestActor, goalId: string): Promise<void> {
    const goal = await this.goalModel.findById(goalId).exec();
    if (!goal) throw new NotFoundException('Goal not found');

    if (goal.kind === UserGoalKind.WATCH_LINEUP) {
      await this.registrationService.unregister(goal.activityLegacyId, actor);
      goal.status = UserGoalStatus.CANCELLED;
      goal.updatedAt = new Date().toISOString();
      await goal.save();
      return;
    }

    await this.goalModel.deleteOne({ _id: goalId }).exec();
  }

  /**
   * Default in-app watch_lineup when user engages with activity features.
   * Skips if already active, or user previously cancelled subscription.
   */
  async subscribeOnEngagement(
    actor: RequestActor,
    activityLegacyId: number,
  ): Promise<UserGoalDocument | null> {
    const userId = actor.resolvedUserId?.trim();
    if (
      !userId ||
      !Number.isFinite(activityLegacyId) ||
      activityLegacyId <= 0
    ) {
      return null;
    }

    const goals = await this.findByUser(userId, activityLegacyId);
    const watchLineup = goals.find((g) => g.kind === UserGoalKind.WATCH_LINEUP);

    if (watchLineup?.status === UserGoalStatus.ACTIVE) {
      return watchLineup;
    }
    if (watchLineup?.status === UserGoalStatus.CANCELLED) {
      return null;
    }

    return this.create(actor, {
      activityLegacyId,
      kind: UserGoalKind.WATCH_LINEUP,
      params: { notifyWechat: false },
    });
  }

  async saveArtifact(
    artifact: Partial<UserGoalArtifactDocument>,
  ): Promise<UserGoalArtifactDocument> {
    const ArtifactModel = this.goalModel.db.model(
      'user_goal_artifacts',
      UserGoalArtifactSchema,
    );
    return ArtifactModel.create(artifact);
  }

  async findArtifact(
    artifactId: string,
  ): Promise<UserGoalArtifactDocument | null> {
    const ArtifactModel = this.goalModel.db.model(
      'user_goal_artifacts',
      UserGoalArtifactSchema,
    );
    return ArtifactModel.findOne({ artifactId }).exec();
  }
}
