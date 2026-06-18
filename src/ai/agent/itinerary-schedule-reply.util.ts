import type { ItineraryScheduleDto } from '../../modules/itinerary/itinerary-schedule.service';

/** Shared overview text for `itinerary_get_schedule` and read-only fast path. */
export function buildItineraryScheduleOverviewReply(
  schedule: ItineraryScheduleDto,
): string {
  const djPreview = schedule.djs
    .slice(0, 12)
    .map((dj) => dj.name)
    .join('、');

  const lines = [schedule.eventMeta];
  if (schedule.djs.length === 0) {
    lines.push('阵容未公布，官宣后会第一时间同步～');
  } else if (schedule.schedulePublished) {
    lines.push(`官方演出表已发布，共 ${schedule.performances.length} 场演出。`);
    lines.push(`部分艺人：${djPreview}`);
  } else {
    lines.push('阵容已公布，官方演出时段尚未发布。');
    lines.push(`部分艺人：${djPreview}`);
  }

  return lines.join('\n');
}
