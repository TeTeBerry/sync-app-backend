import { Injectable } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { PindanService } from '../pindan/pindan.service';
import { TicketService } from '../ticket/ticket.service';
import { mapTicketsToListingUi } from '../ticket/ticket-listing.mapper';

@Injectable()
export class HomeService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly pindanService: PindanService,
    private readonly ticketService: TicketService,
  ) {}

  async getSummary() {
    const [activities, pinOrders, joinedPeople, tickets] = await Promise.all([
      this.activityService.findAll(),
      this.pindanService.countOpen(),
      this.pindanService.sumJoinedPeople(),
      this.ticketService.searchListings({}),
    ]);

    const activityNameMap = new Map(
      activities.map(item => [item.code, item.name]),
    );

    const signupEvents = activities.map(item => ({
      id: item.legacyId,
      title: item.name,
      date: item.date ?? '',
      location: item.location ?? '',
      image: item.image ?? '',
      category: item.hot ? '户外电音' : 'EDM节',
      hot: Boolean(item.hot),
      attendees: item.attendees ?? 0,
      pinCount: item.pinCount ?? 0,
      going: false,
    }));

    const hotPins = await this.buildHotPins(activities);
    const ticketListings = mapTicketsToListingUi(tickets, activityNameMap);

    return {
      heat: {
        people:
          joinedPeople +
          activities.reduce((sum, activity) => sum + (activity.attendees ?? 0), 0),
        pinOrders,
        growthPercent: 28,
      },
      signupEvents,
      hotPins,
      ticketListings,
    };
  }

  private async buildHotPins(
    activities: Awaited<ReturnType<ActivityService['findAll']>>,
  ) {
    const activityMap = new Map(
      activities.map(item => [item.legacyId, item.name]),
    );

    const hotRank = [
      { legacyId: 1, badge: '🔥 最热', category: '套餐拼', tone: 'primary', pinType: 'package', pinItemId: 3 },
      { legacyId: 2, badge: '⚡ 急拼', category: '酒店拼', tone: 'amber', pinType: 'hotel', pinItemId: 5 },
      { legacyId: 3, badge: '🎉 新开', category: '酒店拼', tone: 'amber', pinType: 'hotel', pinItemId: 4 },
      { legacyId: 4, badge: '🏆 大神局', category: '交通拼', tone: 'cyan', pinType: 'transport', pinItemId: 12 },
    ] as const;

    const hotPins = await Promise.all(
      hotRank.map(async (meta, index) => {
        const activity = activities.find(item => item.legacyId === meta.legacyId);
        if (!activity) return null;

        const rows = await this.pindanService.search({
          activityLegacyId: activity.legacyId,
        });
        const top = rows[0];

        return {
          id: activity.legacyId,
          rank: index + 1,
          title: activityMap.get(activity.legacyId) ?? activity.name,
          badge: meta.badge,
          category: meta.category,
          categoryTone: meta.tone,
          people: top?.joined ?? activity.attendees ?? 0,
          pinType: top?.type ?? meta.pinType,
          pinItemId: top?.legacyId ?? meta.pinItemId,
        };
      }),
    );

    return hotPins.filter(Boolean);
  }
}
