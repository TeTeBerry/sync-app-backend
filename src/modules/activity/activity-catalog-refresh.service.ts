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

@Injectable()
export class ActivityCatalogRefreshService implements IActivityCatalogRefreshPort {
  constructor(
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    @Optional() private readonly noticeAgent?: NoticeAgent,
    @Optional()
    @Inject(ACTIVITY_REGISTRATION_REPOSITORY)
    private readonly registrationRepository?: IActivityRegistrationRepository,
  ) {}

  async refreshAfterLineupCatalogChange(): Promise<void> {
    const beforeRecords = await this.activityLookup.findAll();
    const previousLineup = new Map(
      beforeRecords.map((record) => [record.legacyId, record.lineupPublished]),
    );

    await this.activityLookup.refreshCache();

    const afterRecords = await this.activityLookup.findAll();
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
