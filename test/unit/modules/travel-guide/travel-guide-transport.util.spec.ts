import {
  buildInterCityTransportLines,
  buildVenueTransportOptions,
  mergeVenueTransportWithLlmPolish,
  sanitizeVenueTransportOptions,
  resolveDestinationTransportProfile,
} from '../../../../src/modules/travel-guide/domain/travel-guide-transport.util';

const thailandActivity = {
  name: 'EDC Thailand 2026',
  location: '泰国·普吉岛',
  region: 'overseas' as const,
};

describe('travel-guide-transport.util', () => {
  it('splits international travel from venue shuttle for Thailand', () => {
    const interCityLines = buildInterCityTransportLines({
      departure: '上海',
      venueTitle: 'Rhythm Park',
      venueReadableAddress: '泰国普吉岛',
      selfDrive: false,
      interCity: true,
      transportHints: [],
      destinationCity: '泰国',
      activity: thailandActivity,
    });

    expect(interCityLines.join(' ')).toMatch(/国际|航班|宝安|白云|浦东/);
    expect(interCityLines.join(' ')).not.toMatch(
      /乘高铁|动车至|地铁\/公交至|北站/,
    );

    const venueOptions = buildVenueTransportOptions({
      departure: '上海',
      venueTitle: 'Rhythm Park',
      venueReadableAddress: '泰国普吉岛',
      selfDrive: false,
      interCity: true,
      transportHints: ['普吉机场接驳'],
      destinationCity: '泰国',
      activity: thailandActivity,
    });

    expect(venueOptions.some((o) => /Grab|Shuttle/i.test(o.label))).toBe(true);
    expect(venueOptions.some((o) => /高铁|地铁/.test(o.label))).toBe(false);
    expect(
      venueOptions.some((o) => o.lines.join(' ').match(/双条车|Grab|Shuttle/i)),
    ).toBe(true);
  });

  it('uses rail/flight for domestic inter-city transport', () => {
    const lines = buildInterCityTransportLines({
      departure: '上海',
      venueTitle: '深圳国际会展中心',
      venueReadableAddress: '深圳宝安',
      selfDrive: false,
      interCity: true,
      transportHints: ['深圳北站高铁'],
      destinationCity: '深圳',
      activity: {
        name: 'Storm',
        location: '深圳·国际会展中心',
        region: undefined,
      },
    });

    expect(lines.join(' ')).toMatch(/高铁|飞机/);
    expect(lines.some((l) => l.includes('会场接驳'))).toBe(true);
  });

  it('builds domestic venue options without repeating departure city leg', () => {
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

    expect(options.some((o) => o.label.includes('枢纽接驳'))).toBe(true);
    expect(options.some((o) => o.label.includes('高铁/动车'))).toBe(false);
    expect(options.some((o) => o.label.includes('地铁'))).toBe(true);
  });

  it('includes BTS/MRT for Bangkok but not for Phuket', () => {
    const bangkokOptions = buildVenueTransportOptions({
      departure: '上海',
      venueTitle: 'Impact Arena',
      venueReadableAddress: '曼谷',
      selfDrive: false,
      interCity: true,
      transportHints: [],
      destinationCity: '曼谷',
      activity: {
        name: 'S2O Bangkok',
        location: '泰国·曼谷',
        region: 'overseas' as const,
      },
    });
    expect(bangkokOptions.some((o) => /BTS|MRT/.test(o.label))).toBe(true);

    const phuketOptions = buildVenueTransportOptions({
      departure: '上海',
      venueTitle: 'Rhythm Park',
      venueReadableAddress: '泰国普吉岛',
      selfDrive: false,
      interCity: true,
      transportHints: [],
      destinationCity: '泰国',
      activity: thailandActivity,
    });
    expect(phuketOptions.some((o) => /BTS|MRT|地铁|高铁/.test(o.label))).toBe(
      false,
    );
    expect(phuketOptions.some((o) => /双条车|Grab/i.test(o.label))).toBe(true);
  });

  it('omits metro for domestic cities without urban rail', () => {
    const options = buildVenueTransportOptions({
      departure: '广州',
      venueTitle: '某活动场',
      venueReadableAddress: '清远某镇',
      selfDrive: false,
      interCity: true,
      transportHints: [],
      destinationCity: '清远',
      activity: {
        name: 'Local Fest',
        location: '广东·清远',
        region: undefined,
      },
    });
    expect(options.some((o) => /地铁/.test(o.label))).toBe(false);
    expect(options.some((o) => /公交|网约车/.test(o.label))).toBe(true);
  });

  it('keeps map venue options when LLM invents invalid modes', () => {
    const input = {
      departure: '上海',
      venueTitle: 'Rhythm Park',
      venueReadableAddress: '泰国普吉岛',
      selfDrive: false,
      interCity: true,
      transportHints: [],
      destinationCity: '泰国',
      activity: thailandActivity,
    };
    const mapOptions = buildVenueTransportOptions(input);
    const merged = mergeVenueTransportWithLlmPolish(
      mapOptions,
      [
        {
          label: '地铁 + 高铁直达会场',
          lines: ['从深圳北站乘高铁再转地铁11号线'],
        },
        ...mapOptions.map((o) => ({
          label: o.label,
          lines: [`润色：${o.lines[0]}`],
        })),
      ],
      input,
    );
    expect(merged.some((o) => /地铁|高铁|深圳北/.test(o.label))).toBe(false);
    expect(
      merged.every((o) => mapOptions.some((m) => m.label === o.label)),
    ).toBe(true);
  });

  it('filters invented venue modes via sanitize', () => {
    const profile = resolveDestinationTransportProfile({
      destinationCity: '泰国',
      activity: thailandActivity,
    });
    const cleaned = sanitizeVenueTransportOptions(profile, [
      { label: '地铁11号线', lines: ['深圳北站换乘'] },
      { label: 'Grab / Bolt 网约车', lines: ['正常选项'] },
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]?.label).toMatch(/Grab/);
  });
});
