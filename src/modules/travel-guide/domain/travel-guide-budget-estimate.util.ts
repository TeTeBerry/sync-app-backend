import type { TravelGuideBudgetTier } from './travel-guide.types';
import type { TravelGuideBudgetItem } from './travel-guide.types';
import { budgetTierHotelNightRanges } from './parse-activity-days.util';
import type { TravelGuideRegionKind } from './travel-guide-international.util';

function parseRangeMid(range: string): number {
  const nums = range.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return 0;
  if (nums.length === 1) return nums[0]!;
  return Math.round((nums[0]! + nums[1]!) / 2);
}

function formatRange(min: number, max: number, perPerson = false): string {
  const suffix = perPerson ? '/人' : '';
  if (min === max) return `约 ¥${min}${suffix}`;
  return `约 ¥${min}–${max}${suffix}`;
}

function roomCount(headcount: number): number {
  if (headcount <= 1) return 1;
  return Math.ceil(headcount / 2);
}

export function buildTravelGuideBudgetItems(input: {
  budgetTier: TravelGuideBudgetTier;
  headcount: number;
  accommodationNights: number;
  interCity: boolean;
  regionKind: TravelGuideRegionKind;
  selfDrive: boolean;
}): TravelGuideBudgetItem[] {
  const {
    budgetTier,
    headcount,
    accommodationNights,
    interCity,
    regionKind,
    selfDrive,
  } = input;
  const rooms = roomCount(headcount);
  const hotelRanges = budgetTierHotelNightRanges(budgetTier);
  const primaryMid = parseRangeMid(hotelRanges.primary);
  const secondaryMid = parseRangeMid(hotelRanges.secondary);
  const hotelMid = Math.round((primaryMid + secondaryMid) / 2);
  const hotelMin = Math.round(hotelMid * 0.85) * rooms * accommodationNights;
  const hotelMax = Math.round(hotelMid * 1.15) * rooms * accommodationNights;

  const items: TravelGuideBudgetItem[] = [];

  if (interCity) {
    if (regionKind === 'overseas') {
      const min = 1800 * headcount;
      const max = 5500 * headcount;
      items.push({
        label: '机票（往返）',
        range: formatRange(min, max),
        note: '视出发城市、购票时间与舱位浮动，建议提前 2–8 周关注。',
      });
    } else if (regionKind === 'hmt') {
      const min = 600 * headcount;
      const max = 2200 * headcount;
      items.push({
        label: '机票/高铁（往返）',
        range: formatRange(min, max),
        note: '含口岸接驳；节假日与电音节前后票量紧张。',
      });
    } else {
      const min = 400 * headcount;
      const max = 1600 * headcount;
      items.push({
        label: selfDrive ? '自驾（油费+过路费）' : '城际交通（高铁/机票）',
        range: formatRange(min, max),
        note: selfDrive
          ? '含往返油费与高速费，视出发地里程浮动。'
          : '含往返高铁/机票，建议提前购票。',
      });
    }
  } else if (selfDrive) {
    items.push({
      label: '自驾（油费+停车）',
      range: formatRange(80, 350),
      note: '同城/近郊自驾，含停车与市区拥堵绕行。',
    });
  }

  const ticketMin = regionKind === 'overseas' ? 800 : 380;
  const ticketMax = regionKind === 'overseas' ? 2200 : 1280;
  items.push({
    label: '门票',
    range: formatRange(ticketMin * headcount, ticketMax * headcount),
    note: '以官方渠道为准；VIP/多日票会更高，早鸟通常更划算。',
  });

  items.push({
    label: '住宿',
    range: formatRange(hotelMin, hotelMax),
    note: `按您选择的${budgetTier === 'economy' ? '经济' : budgetTier === 'comfort' ? '豪华' : '舒适'}档 · ${accommodationNights} 晚 · ${rooms} 间房估算。`,
  });

  const transitDays = Math.max(accommodationNights, 2);
  const transitMin =
    regionKind === 'overseas'
      ? 120 * headcount * transitDays
      : 40 * headcount * transitDays;
  const transitMax =
    regionKind === 'overseas'
      ? 350 * headcount * transitDays
      : 120 * headcount * transitDays;
  items.push({
    label: '交通（市内+会场接驳）',
    range: formatRange(transitMin, transitMax),
    note: '含机场/车站至酒店、每日往返会场、散场网约车；高峰可能上浮。',
  });

  const mealMin =
    regionKind === 'overseas'
      ? 120 * headcount * transitDays
      : 80 * headcount * transitDays;
  const mealMax =
    regionKind === 'overseas'
      ? 280 * headcount * transitDays
      : 180 * headcount * transitDays;
  items.push({
    label: '餐饮',
    range: formatRange(mealMin, mealMax),
    note: '含场内简餐、散场夜宵与早餐；奢享餐饮未计入。',
  });

  const miscMin =
    regionKind === 'overseas'
      ? 300 * headcount
      : regionKind === 'hmt'
        ? 200 * headcount
        : 150 * headcount;
  const miscMax =
    regionKind === 'overseas'
      ? 800 * headcount
      : regionKind === 'hmt'
        ? 500 * headcount
        : 400 * headcount;
  items.push({
    label: '现金/杂费',
    range: formatRange(miscMin, miscMax),
    note:
      regionKind === 'overseas'
        ? '含签证/落地签、小费、纪念品、应急药品与 SIM 卡等。'
        : '含水、雨衣、寄存、周边与应急支出。',
  });

  const subtotalMin = items.reduce((sum, item) => {
    const nums = item.range.match(/\d+/g)?.map(Number) ?? [];
    return sum + (nums[0] ?? 0);
  }, 0);
  const subtotalMax = items.reduce((sum, item) => {
    const nums = item.range.match(/\d+/g)?.map(Number) ?? [];
    return sum + (nums[nums.length - 1] ?? nums[0] ?? 0);
  }, 0);

  items.push({
    label: headcount > 1 ? '合计参考（全员）' : '合计参考（单人）',
    range: formatRange(subtotalMin, subtotalMax),
    note:
      headcount > 1
        ? `${headcount} 人全程合计估算；人均约 ¥${Math.round(subtotalMin / headcount)}–${Math.round(subtotalMax / headcount)}，不含购物与个人消费差异。`
        : '单人全程合计估算，不含购物与个人消费差异。',
  });

  return items;
}
