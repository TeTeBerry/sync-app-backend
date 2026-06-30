import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ModuleRef } from '@nestjs/core';
import { Model } from 'mongoose';
import type { Activity } from '../../database/schemas/activity.schema';
import {
  Activity as ActivityModel,
  ActivityDocument,
} from '../../database/schemas/activity.schema';
import { GoalOrchestrator } from '../goal/goal-orchestrator.service';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from './ports/activity-lookup.port';
import type { IActivityCatalogRefreshPort } from './ports/activity-catalog-refresh.port';
import { LineupCatalogService } from '../itinerary/lineup-catalog.service';

@Injectable()
export class ActivityCatalogRefreshService implements IActivityCatalogRefreshPort {
  private readonly logger = new Logger(ActivityCatalogRefreshService.name);

  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly moduleRef: ModuleRef,
    @InjectModel(ActivityModel.name)
    private readonly activityModel: Model<ActivityDocument>,
    @Optional() private readonly lineupCatalog?: LineupCatalogService,
  ) {}

  async refreshAfterLineupCatalogChange(): Promise<void> {
    const beforeRecords = await this.activityLookup.findAllBasics();
    const previousLineup = new Map(
      beforeRecords.map((record) => [record.legacyId, record.lineupPublished]),
    );

    await this.activityLookup.refreshCache();
    await this.lineupCatalog?.refreshRankedCatalogCache();

    const afterRecords = await this.activityLookup.findAllBasics();
    for (const record of afterRecords) {
      if (
        previousLineup.get(record.legacyId) === false &&
        record.lineupPublished === true
      ) {
        const announcedAt = new Date();
        await this.activityModel.updateOne(
          { legacyId: record.legacyId },
          { $set: { lineupAnnouncedAt: announcedAt } },
        );
        void this.onLineupPublished(record, '阵容已官宣');
      }
    }
  }

  private async onLineupPublished(
    activity: Pick<Activity, 'legacyId' | 'name' | 'date' | 'location'>,
    changeSummary: string,
  ): Promise<void> {
    try {
      const orchestrator = this.moduleRef.get(GoalOrchestrator, {
        strict: false,
      });
      if (!orchestrator) {
        this.logger.warn(
          'GoalOrchestrator not available for lineup publish hook',
        );
        return;
      }
      await orchestrator.onLineupPublished(activity, changeSummary);
    } catch (error) {
      this.logger.warn(
        `GoalOrchestrator lineup hook failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
