import type { TravelGuideLocale } from './travel-guide-locale';

export type TravelGuideCopy = {
  section: {
    accommodation: string;
    parking: string;
    nightlife: string;
    tips: string;
    documents: string;
    tickets: string;
    essentials: string;
    budget: string;
    transport: string;
    interCityTransport: string;
    internationalTravel: string;
    venueTransport: string;
  };
  budgetLabels: {
    flightRoundtrip: string;
    flightOrRailRoundtrip: string;
    interCityTransport: string;
    selfDriveFuelToll: string;
    selfDriveFuelParking: string;
    tickets: string;
    accommodation: string;
    localTransport: string;
    food: string;
    misc: string;
    totalGroup: string;
    totalSolo: string;
  };
  budgetTier: {
    economy: string;
    standard: string;
    comfort: string;
  };
  fallback: {
    venue: string;
    eventDates: string;
    companionNote: (note: string) => string;
  };
  errors: {
    mapPoiUnavailable: string;
    venueResolveUnavailable: string;
  };
};

const ZH: TravelGuideCopy = {
  section: {
    accommodation: '住宿推荐',
    parking: '停车指引',
    nightlife: '散场 AP · 夜宵',
    tips: '小贴士',
    documents: '证件 · 入境必备',
    tickets: '门票渠道',
    essentials: '出行必备',
    budget: '预算参考（全程 · 合计）',
    transport: '交通方案',
    interCityTransport: '城际交通',
    internationalTravel: '国际出行',
    venueTransport: '会场接驳',
  },
  budgetLabels: {
    flightRoundtrip: '机票（往返）',
    flightOrRailRoundtrip: '机票/高铁（往返）',
    interCityTransport: '城际交通（高铁/机票）',
    selfDriveFuelToll: '自驾（油费+过路费）',
    selfDriveFuelParking: '自驾（油费+停车）',
    tickets: '门票',
    accommodation: '住宿',
    localTransport: '交通（市内+会场接驳）',
    food: '餐饮',
    misc: '现金/杂费',
    totalGroup: '合计参考（全员）',
    totalSolo: '合计参考（单人）',
  },
  budgetTier: {
    economy: '经济(¥150-300/晚)',
    standard: '舒适(¥300-600/晚)',
    comfort: '豪华(¥600+/晚)',
  },
  fallback: {
    venue: '活动场馆',
    eventDates: '详见官方日程',
    companionNote: (note) => `同行偏好：${note}`,
  },
  errors: {
    mapPoiUnavailable:
      '无法获取场馆周边推荐（酒店/散场/停车），请确认活动地址或明日再试；若使用高德 Key，请检查配额是否用尽',
    venueResolveUnavailable: '无法解析场馆位置，请确认活动坐标后重试',
  },
};

const EN: TravelGuideCopy = {
  section: {
    accommodation: 'Stay recommendations',
    parking: 'Parking guide',
    nightlife: 'Afterparty · late bites',
    tips: 'Tips',
    documents: 'Documents · entry essentials',
    tickets: 'Ticket channels',
    essentials: 'Travel essentials',
    budget: 'Budget reference (trip total)',
    transport: 'Getting there',
    interCityTransport: 'Intercity travel',
    internationalTravel: 'International travel',
    venueTransport: 'Venue transfer',
  },
  budgetLabels: {
    flightRoundtrip: 'Flights (round-trip)',
    flightOrRailRoundtrip: 'Flights / rail (round-trip)',
    interCityTransport: 'Intercity travel (rail / flights)',
    selfDriveFuelToll: 'Self-drive (fuel + tolls)',
    selfDriveFuelParking: 'Self-drive (fuel + parking)',
    tickets: 'Tickets',
    accommodation: 'Accommodation',
    localTransport: 'Local transport + venue transfer',
    food: 'Food & drinks',
    misc: 'Cash / misc',
    totalGroup: 'Estimated total (group)',
    totalSolo: 'Estimated total (solo)',
  },
  budgetTier: {
    economy: 'Economy ($21–42 / night)',
    standard: 'Comfort ($42–83 / night)',
    comfort: 'Premium ($83+ / night)',
  },
  fallback: {
    venue: 'Festival venue',
    eventDates: 'See official schedule',
    companionNote: (note) => `Travel notes: ${note}`,
  },
  errors: {
    mapPoiUnavailable:
      'Unable to load nearby stays / afterparty / parking. Check the venue address or try again later; if using an Amap key, verify quota.',
    venueResolveUnavailable:
      'Unable to resolve the festival venue. Check the activity location coordinates and try again.',
  },
};

export function getTravelGuideCopy(locale: TravelGuideLocale): TravelGuideCopy {
  return locale === 'en' ? EN : ZH;
}

/** Map/POI collection failure message (domestic Amap vs abroad venue resolve). */
export function travelGuideMapCollectUnavailableMessage(
  locale: TravelGuideLocale,
  abroad: boolean,
): string {
  const errors = getTravelGuideCopy(locale).errors;
  return abroad ? errors.venueResolveUnavailable : errors.mapPoiUnavailable;
}

export function isAccommodationBudgetLabel(label: string): boolean {
  const trimmed = label.trim();
  return (
    trimmed === ZH.budgetLabels.accommodation ||
    trimmed === EN.budgetLabels.accommodation ||
    trimmed.startsWith('住宿') ||
    /^Accommodation\b/i.test(trimmed)
  );
}

export function isTotalBudgetLabel(label: string): boolean {
  const trimmed = label.trim();
  return (
    trimmed === ZH.budgetLabels.totalGroup ||
    trimmed === ZH.budgetLabels.totalSolo ||
    trimmed === EN.budgetLabels.totalGroup ||
    trimmed === EN.budgetLabels.totalSolo ||
    trimmed.startsWith('合计') ||
    /Estimated total/i.test(trimmed)
  );
}
