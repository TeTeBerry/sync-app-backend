import { buildTravelGuideBudgetItems } from '../../../../src/modules/travel-guide/domain/travel-guide-budget-estimate.util';
import {
  buildTravelGuideDocumentItems,
  buildTravelGuideEssentials,
  isTravelGuideAbroad,
  sanitizeTicketChannelsForActivity,
  travelGuideRegionKind,
} from '../../../../src/modules/travel-guide/domain/travel-guide-international.util';
import {
  accommodationSchemesFromRanked,
  buildTicketChannels,
  buildVenueTransportOptions,
  mapCandidatesToLlmFallback,
} from '../../../../src/modules/travel-guide/map/travel-guide-map-plan.builder';
import { pickAccommodationSchemes } from '../../../../src/modules/travel-guide/map/travel-guide-poi.ranker';
import type {
  RankedMapPoi,
  TravelGuideMapContext,
  TravelGuideRankedCandidates,
} from '../../../../src/modules/travel-guide/map/travel-guide-map.types';

function rankedPoi(
  partial: Partial<RankedMapPoi> & Pick<RankedMapPoi, 'name' | 'distanceM'>,
): RankedMapPoi {
  return {
    id: partial.name,
    address: '测试路',
    lat: 22.5,
    lng: 114,
    category: '酒店',
    kind: 'hotel',
    keyword: '酒店',
    lateNightFriendly: false,
    score: 0.9,
    scoreBreakdown: { distance: 0.9, rating: 0.8, budget: 0.8, lateNight: 0 },
    ...partial,
  };
}

describe('travel guide enhanced sections', () => {
  it('detects overseas activity for documents', () => {
    expect(isTravelGuideAbroad({ region: 'overseas' })).toBe(true);
    const docs = buildTravelGuideDocumentItems({
      activity: {
        name: 'EDC Thailand 2026',
        location: '泰国·普吉岛',
        region: 'overseas',
      },
    });
    expect(docs.some((d) => d.includes('护照'))).toBe(true);
    expect(docs.some((d) => d.includes('泰铢'))).toBe(true);
  });

  it('builds Korea-specific documents and essentials for EDC Korea', () => {
    const activity = {
      name: 'EDC Korea 2026',
      location: '韩国·仁川',
      region: 'overseas' as const,
    };
    const docs = buildTravelGuideDocumentItems({ activity });
    expect(docs.some((d) => /K-ETA|韩国入境/.test(d))).toBe(true);
    expect(docs.some((d) => /T-money|韩元/.test(d))).toBe(true);
    expect(docs.some((d) => /Kakao T|Naver Map/.test(d))).toBe(true);

    const essentials = buildTravelGuideEssentials({
      activity,
      interCity: true,
    });
    expect(essentials.apps.some((a) => /Kakao T/.test(a))).toBe(true);
    expect(essentials.apps.some((a) => /Naver Map|AREX/.test(a))).toBe(true);
    expect(essentials.payment.some((p) => /T-money/.test(p))).toBe(true);
  });

  it('builds Japan-specific documents and essentials for WDJF', () => {
    const activity = {
      name: 'World DJ Festival Japan 2026',
      location: '日本·东京 海の森水上競技場',
      region: 'overseas' as const,
    };
    const docs = buildTravelGuideDocumentItems({ activity });
    expect(docs.some((d) => /Visit Japan Web|日本入境/.test(d))).toBe(true);
    expect(docs.some((d) => /Suica|Pasmo|日元/.test(d))).toBe(true);

    const essentials = buildTravelGuideEssentials({
      activity,
      interCity: true,
    });
    expect(essentials.apps.some((a) => /Uber Japan|Navitime/.test(a))).toBe(
      true,
    );
    expect(essentials.payment.some((p) => /Suica|Pasmo/.test(p))).toBe(true);
  });

  it('picks nearby and city center accommodation schemes', () => {
    const hotels = [
      rankedPoi({ name: '近酒店', distanceM: 400 }),
      rankedPoi({ name: '远酒店', distanceM: 2200 }),
    ];
    const picks = pickAccommodationSchemes(hotels, 'standard');
    expect(picks.nearby.name).toBe('近酒店');
    expect(picks.cityCenter.name).toBe('远酒店');

    const schemes = accommodationSchemesFromRanked(
      picks,
      '2 晚',
      '双床',
      ['¥300-450', '¥450-600'],
      undefined,
    );
    expect(schemes).toHaveLength(2);
    expect(schemes[0]?.label).toBe('就近方案');
    expect(schemes[1]?.label).toBe('市中心方案');
    expect(schemes[0]?.reason).toContain('距会场');
  });

  it('builds full budget breakdown by user tier', () => {
    const items = buildTravelGuideBudgetItems({
      budgetTier: 'standard',
      headcount: 2,
      accommodationNights: 2,
      interCity: true,
      regionKind: 'domestic',
      selfDrive: false,
    });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('城际交通（高铁/机票）');
    expect(labels).toContain('门票');
    expect(labels).toContain('住宿');
    expect(labels).toContain('餐饮');
    expect(labels).toContain('合计参考（全员）');
  });

  it('omits accommodation from budget when nights are zero', () => {
    const items = buildTravelGuideBudgetItems({
      budgetTier: 'standard',
      headcount: 2,
      accommodationNights: 0,
      interCity: false,
      regionKind: 'domestic',
      selfDrive: false,
    });
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain('住宿');
    expect(labels).toContain('门票');
    expect(labels).toContain('合计参考（全员）');
  });

  it('mapCandidatesToLlmFallback includes tickets, budget and venue transport', () => {
    const ctx: TravelGuideMapContext = {
      venue: { title: 'Rhythm Park', address: 'Phuket', lat: 7.8, lng: 98.3 },
      venueReadableAddress: '泰国普吉岛',
      venueSource: 'hot_path',
      transportSource: 'hot_path',
      transportHints: ['普吉机场接驳'],
      interCity: true,
      pois: [],
      eventEndHour: 23.5,
      collectedAt: new Date().toISOString(),
    };
    const ranked: TravelGuideRankedCandidates = {
      hotels: [
        rankedPoi({ name: '近酒店', distanceM: 500 }),
        rankedPoi({ name: '远酒店', distanceM: 2500 }),
      ],
      accommodationPicks: {
        nearby: rankedPoi({ name: '近酒店', distanceM: 500 }),
        cityCenter: rankedPoi({ name: '远酒店', distanceM: 2500 }),
      },
      parking: [],
      nightlife: [
        {
          ...rankedPoi({ name: '夜宵', distanceM: 300 }),
          kind: 'nightlife_food',
        },
      ],
      minHotelRating: 4,
      budgetTier: 'standard',
      hotelPriceBand: ['¥300-450', '¥450-600'],
    };

    const payload = mapCandidatesToLlmFallback(ctx, ranked, {
      departure: '上海',
      selfDrive: false,
      accommodationNights: 2,
      headcount: 2,
      activity: {
        name: 'EDC Thailand 2026',
        location: '泰国·普吉岛',
        region: 'overseas',
        externalUrl: 'https://example.com/tickets',
      } as import('../../../../src/database/schemas/activity.schema').Activity,
    });

    expect(payload.accommodationSchemes).toHaveLength(2);
    expect(payload.hotels.length).toBeGreaterThanOrEqual(2);
    expect(payload.hotels[0]?.reason).toBeTruthy();
    expect(payload.nightlifeSpots[0]?.reason).toBeTruthy();
    expect(payload.accommodationSchemes?.[0]?.bookingHint).toBe(
      '携程 / Agoda / Booking / Airbnb',
    );
    expect(payload.documentItems?.length).toBeGreaterThan(0);
    expect(payload.ticketChannels?.[0]?.note).toContain(
      'https://example.com/tickets',
    );
    expect(
      payload.ticketChannels?.some((c) =>
        /大麦|猫眼|小程序|公众号/.test(`${c.name} ${c.note}`),
      ),
    ).toBe(false);
    expect(payload.venueTransportOptions?.length).toBeGreaterThanOrEqual(3);
    expect(
      payload.venueTransportOptions?.some((o) => /Grab|Shuttle/i.test(o.label)),
    ).toBe(true);
    expect(
      payload.venueTransportOptions?.some((o) => /高铁|地铁/.test(o.label)),
    ).toBe(false);
    expect(payload.transportLines?.join(' ')).toMatch(/国际|航班|直飞/);
    expect(payload.transportLines?.join(' ')).not.toMatch(
      /乘高铁|动车至|地铁\/公交至/,
    );
    expect(payload.budgetItems?.some((b) => b.label.includes('机票'))).toBe(
      true,
    );
  });

  it('builds overseas ticket channels without domestic platforms', () => {
    const tmlThailand = buildTicketChannels({
      name: 'Tomorrowland Thailand 2026',
      location: '芭提雅 Wisdom Valley',
      region: 'overseas',
      code: 'tomorrowland',
    });
    expect(
      tmlThailand.some((c) => /thailand\.tomorrowland\.com/i.test(c.note)),
    ).toBe(true);
    expect(tmlThailand.some((c) => /Klook/i.test(c.name))).toBe(true);
    expect(
      tmlThailand.some((c) =>
        /大麦|猫眼|小程序|公众号/.test(`${c.name} ${c.note}`),
      ),
    ).toBe(false);

    const wdjf = buildTicketChannels({
      name: 'World DJ Festival Japan 2026',
      location: '日本·东京 海の森水上競技場',
      region: 'overseas',
      code: 'world-dj-festival',
    });
    expect(wdjf.some((c) => /worlddjfestival-jp\.com/i.test(c.note))).toBe(
      true,
    );
    expect(
      wdjf.some((c) => /大麦|猫眼|小程序|公众号/.test(`${c.name} ${c.note}`)),
    ).toBe(false);

    const ultra = buildTicketChannels({
      name: 'Ultra Europe 2026',
      location: '克罗地亚·斯普利特',
      region: 'overseas',
      code: 'ultra-europe',
    });
    expect(ultra.some((c) => /ultraeurope\.com/i.test(c.note))).toBe(true);
    expect(ultra.some((c) => /Eventim/i.test(c.name))).toBe(true);

    const edcOrlando = buildTicketChannels({
      name: 'EDC Orlando 2026',
      location: '美国·奥兰多',
      region: 'overseas',
      code: 'edc-orlando',
    });
    expect(
      edcOrlando.some((c) =>
        /electricdaisycarnival\.com|Insomniac/i.test(`${c.name} ${c.note}`),
      ),
    ).toBe(true);
  });

  it('keeps domestic ticket channels for mainland festivals', () => {
    const channels = buildTicketChannels({
      name: '风暴电音节 深圳站 2026',
      location: '深圳国际会展中心',
      region: 'domestic',
      code: 'storm',
      externalUrl: 'https://detail.damai.cn/item.htm?id=1',
    });
    expect(channels[0]?.name).toBe('官方购票链接');
    expect(channels.some((c) => /大麦|猫眼/.test(c.name))).toBe(true);
    expect(channels.some((c) => /小程序|公众号/.test(c.name))).toBe(true);
  });

  it('strips domestic ticket channels from LLM polish for overseas festivals', () => {
    const sanitized = sanitizeTicketChannelsForActivity(
      [
        { name: '大麦 / 猫眼', note: '国内授权渠道' },
        { name: 'Ultra Europe 官网', note: 'https://ultraeurope.com' },
      ],
      {
        name: 'Ultra Europe 2026',
        location: '克罗地亚·斯普利特',
        region: 'overseas',
        code: 'ultra-europe',
      },
    );
    expect(sanitized.some((c) => /大麦|猫眼/.test(c.name))).toBe(false);
    expect(sanitized.some((c) => /ultraeurope\.com/i.test(c.note))).toBe(true);
  });

  it('infers overseas region for TML Thailand when region field is missing', () => {
    expect(
      travelGuideRegionKind({
        name: 'Tomorrowland Thailand 2026',
        location: '芭提雅 Wisdom Valley',
        code: 'tomorrowland',
      }),
    ).toBe('overseas');
  });

  it('replaces LLM domestic ticket mix with overseas fallback for TML Thailand', () => {
    const sanitized = sanitizeTicketChannelsForActivity(
      [
        { name: '大麦 / 猫眼', note: '国内大型电音节常用官方授权渠道' },
        { name: '活动官方小程序 / 公众号', note: '搜索活动全名' },
        {
          name: 'Klook / Trip.com（境外场）',
          note: 'EDC Thailand、Tomorrowland 等境外场常用',
        },
      ],
      {
        name: 'Tomorrowland Thailand 2026',
        location: '芭提雅 Wisdom Valley',
        code: 'tomorrowland',
      },
    );
    expect(sanitized.some((c) => /大麦|猫眼|小程序|公众号/.test(c.name))).toBe(
      false,
    );
    expect(
      sanitized.some((c) => /thailand\.tomorrowland\.com/i.test(c.note)),
    ).toBe(true);
  });

  it('includes official url in ticket channels', () => {
    const channels = buildTicketChannels({
      name: 'Storm',
      region: 'domestic',
      code: 'storm',
      externalUrl: 'https://detail.damai.cn/item.htm?id=1',
    });
    expect(channels[0]?.name).toBe('官方购票链接');
  });

  it('builds multiple venue transport options for intercity domestic', () => {
    const options = buildVenueTransportOptions({
      departure: '北京',
      venueTitle: '国际会展中心',
      venueReadableAddress: '深圳宝安',
      selfDrive: false,
      interCity: true,
      transportHints: ['深圳北站接驳'],
      destinationCity: '深圳',
      activity: {
        name: 'Storm',
        location: '深圳·国际会展中心',
        region: undefined,
      },
    });
    expect(options.length).toBeGreaterThanOrEqual(3);
    expect(options.some((o) => o.label.includes('枢纽接驳'))).toBe(true);
    expect(options.some((o) => /高铁\/动车/.test(o.label))).toBe(false);
  });
});
