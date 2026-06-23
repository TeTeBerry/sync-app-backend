import {
  filterDomesticTransportHints,
  resolveDepartureAirportLabel,
  resolveDestinationAirportLabel,
} from '../../../../src/modules/travel-guide/domain/travel-guide-departure-airport.util';
import {
  buildInterCityTransportLines,
  resolveDestinationTransportProfile,
} from '../../../../src/modules/travel-guide/domain/travel-guide-transport.util';

describe('travel-guide-departure-airport.util', () => {
  it('maps departure city to international airport', () => {
    expect(resolveDepartureAirportLabel('深圳')).toContain('深圳宝安');
    expect(resolveDepartureAirportLabel('广州')).toContain('广州白云');
    expect(resolveDepartureAirportLabel('上海')).toContain('浦东');
  });

  it('filters domestic rail hub hints for overseas plans', () => {
    const filtered = filterDomesticTransportHints([
      '上海→深圳：建议高铁至深圳北站',
      '普吉机场 Shuttle 可用',
    ]);
    expect(filtered).toEqual(['普吉机场 Shuttle 可用']);
  });
});

describe('overseas transport uses departure airport not rail', () => {
  it('mentions departure airport and destination airport for Thailand', () => {
    const activity = {
      name: 'EDC Thailand 2026',
      location: '泰国·普吉岛',
      region: 'overseas' as const,
    };
    const lines = buildInterCityTransportLines({
      departure: '深圳',
      departureCity: '深圳',
      venueTitle: 'Rhythm Park',
      venueReadableAddress: '泰国普吉岛',
      selfDrive: false,
      interCity: true,
      transportHints: ['抵深后接驳：地铁11号线'],
      destinationCity: '泰国',
      activity,
    });

    const text = lines.join(' ');
    expect(text).toContain('深圳宝安');
    expect(text).toContain('普吉国际机场');
    expect(text).not.toMatch(/高铁|北站|地铁11/);
  });

  it('resolves phuket destination airport', () => {
    const profile = resolveDestinationTransportProfile({
      destinationCity: '泰国',
      activity: {
        name: 'EDC',
        location: '泰国·普吉岛',
        region: 'overseas',
      },
    });
    expect(resolveDestinationAirportLabel(profile, '泰国·普吉岛')).toContain(
      'HKT',
    );
  });
  it('resolves ICN destination airport for Korea', () => {
    const profile = resolveDestinationTransportProfile({
      destinationCity: '仁川',
      activity: {
        name: 'EDC Korea 2026',
        location: '韩国·仁川',
        region: 'overseas',
      },
    });
    expect(resolveDestinationAirportLabel(profile, '韩国·仁川')).toContain(
      'ICN',
    );
  });

  it('resolves HND/NRT destination airport for Japan', () => {
    const profile = resolveDestinationTransportProfile({
      destinationCity: '东京',
      activity: {
        name: 'Ultra Japan 2026',
        location: '日本·东京 台场',
        region: 'overseas',
      },
    });
    expect(resolveDestinationAirportLabel(profile, '日本·东京 台场')).toMatch(
      /HND|NRT/,
    );
  });
});
