import {
  buildInterCityTransportLines,
  buildVenueTransportOptions,
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

    expect(interCityLines.join(' ')).toMatch(/国际|航班|直飞/);
    expect(interCityLines.join(' ')).not.toMatch(/乘高铁|动车至|地铁\/公交至/);

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
});
