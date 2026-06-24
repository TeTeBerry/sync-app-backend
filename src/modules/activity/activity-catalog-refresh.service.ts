import { Inject, Injectable, Optional } from '@nestjs/common';
import { NoticeAgent } from '../../ai/agents/notice.agent';
import type { Activity } from '../../database/schemas/activity.schema';
import {
  ACTIVITY_REGISTRATION_REPOSITORY,
  type IActivityRegistrationRepository,
} from './registration/interfaces/activity-registration.repository.interface';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from './ports/activity-lookup.port';
import type { IActivityCatalogRefreshPort } from './ports/activity-catalog-refresh.port';
import { LineupCatalogService } from '../itinerary/lineup-catalog.service';

@Injectable()
export class ActivityCatalogRefreshService implements IActivityCatalogRefreshPort {
  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    @Optional() private readonly noticeAgent?: NoticeAgent,
    @Optional()
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository?: IActivityRegistrationRepository,
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
        void this.notifyActivityUpdate(record, '阵容已官宣');
      }
    }
  }

  private async notifyActivityUpdate(
    activity: Pick<Activity, 'legacyId' | 'name' | 'date' | 'location'>,
    changeSummary: string,
  ): Promise<void> {
    if (!this.noticeAgent || !this.registrationRepository) {
      return;
    }

    const [userIds, wechatUserIds] = await Promise.all([
      this.registrationRepository.findRegisteredUserIds(activity.legacyId),
      this.registrationRepository.findWechatActivityUpdateOptInUserIds(
        activity.legacyId,
      ),
    ]);
    if (!userIds.length) return;

    void this.noticeAgent.notifyActivityUpdate(
      userIds,
      activity.legacyId,
      activity.name,
      changeSummary,
      activity.date,
      activity.location,
      wechatUserIds,
    );
  }
}
