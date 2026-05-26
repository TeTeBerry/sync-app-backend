import { Injectable } from '@nestjs/common';
import { PINDAN_TYPE_LABEL } from '../../common/constants/pindan-labels';
import { ActivityService } from '../activity/activity.service';
import { PindanService } from '../pindan/pindan.service';
import { TicketService } from '../ticket/ticket.service';
import { mapTicketsToListingUi } from '../ticket/ticket-listing.mapper';
import type { PindanType } from '../../database/schemas/pindan.schema';

const PIN_CATEGORY_LABEL = PINDAN_TYPE_LABEL;

const PIN_CATEGORY_TONE: Record<PindanType, 'primary' | 'amber' | 'cyan'> = {
  package: 'primary',
  hotel: 'amber',
  transport: 'cyan',
};

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

    const recentPins = await this.pindanService.findRecentOpen(4);

    return recentPins
      .map((pin, index) => {
        const pinType = (pin.type ?? 'hotel') as PindanType;
        const activityLegacyId = pin.activityLegacyId;
        const activityName =
          (activityLegacyId != null
            ? activityMap.get(activityLegacyId)
            : undefined) ?? pin.title;
        const joined = pin.joined ?? 1;
        const total = pin.total ?? 4;
        const spotsLeft = Math.max(0, total - joined);
        const badge =
          index === 0
            ? '🎉 新开'
            : spotsLeft <= 1
              ? '⚡ 急拼'
              : '🔥 热拼';

        return {
          id: activityLegacyId ?? pin.legacyId ?? index + 1,
          rank: index + 1,
          title: activityName,
          badge,
          category: PIN_CATEGORY_LABEL[pinType],
          categoryTone: PIN_CATEGORY_TONE[pinType],
          people: joined,
          pinType,
          pinItemId: pin.legacyId ?? 0,
        };
      })
      .filter(item => item.pinItemId > 0);
  }
}
