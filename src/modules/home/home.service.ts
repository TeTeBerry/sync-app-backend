import { Injectable } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { PindanService } from '../pindan/pindan.service';

@Injectable()
export class HomeService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly pindanService: PindanService,
  ) {}

  async getSummary() {
    const [activities, pinOrders, joinedPeople] = await Promise.all([
      this.activityService.findAll(),
      this.pindanService.countOpen(),
      this.pindanService.sumJoinedPeople(),
    ]);

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

    return {
      heat: {
        people: joinedPeople + activities.reduce((sum, a) => sum + (a.attendees ?? 0), 0),
        pinOrders,
        growthPercent: 28,
      },
      signupEvents,
      hotPins,
    };
  }

  private async buildHotPins(
    activities: Awaited<ReturnType<ActivityService['findAll']>>,
  ) {
    const activityMap = new Map(
      activities.map(item => [item.legacyId, item.name]),
    );

    const pindanRows = await Promise.all(
      activities.slice(0, 4).map(async (activity, index) => {
        const rows = await this.pindanService.search({
          activityLegacyId: activity.legacyId,
        });
        const top = rows[0];
        if (!top) return null;

        const badges = ['🔥 最热', '⚡ 急拼', '🎉 新开', '🏆 大神局'];
        const categories = ['套餐拼', '酒店拼', '酒店拼', '交通拼'];
        const tones = ['primary', 'amber', 'amber', 'cyan'] as const;
        const pinTypes = ['package', 'hotel', 'hotel', 'transport'] as const;

        return {
          id: activity.legacyId,
          rank: index + 1,
          title: activityMap.get(activity.legacyId) ?? activity.name,
          badge: badges[index] ?? '🔥 热门',
          category: categories[index] ?? '套餐拼',
          categoryTone: tones[index] ?? 'primary',
          people: top.joined ?? activity.attendees ?? 0,
          pinType: top.type ?? pinTypes[index] ?? 'package',
          pinItemId: top.legacyId ?? top._id,
        };
      }),
    );

    return pindanRows.filter(Boolean);
  }
}
