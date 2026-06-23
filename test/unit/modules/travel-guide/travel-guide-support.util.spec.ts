import {
  resolveTravelGuideSupported,
  TRAVEL_GUIDE_PREPARING_MESSAGE,
} from '../../../../src/modules/travel-guide/domain/travel-guide-support.util';

describe('travel-guide-support.util', () => {
  it('supports overseas activities with hot path and hotel fallback', () => {
    expect(
      resolveTravelGuideSupported({
        legacyId: 8,
        region: 'overseas',
        location: '韩国·仁川',
      }),
    ).toBe(true);
    expect(
      resolveTravelGuideSupported({
        legacyId: 3,
        region: 'overseas',
        location: '韩国·首尔乐园 Seoul Land',
      }),
    ).toBe(true);
    expect(
      resolveTravelGuideSupported({
        legacyId: 6,
        region: 'overseas',
        location: '日本·东京 海の森水上競技場',
      }),
    ).toBe(true);
  });

  it('rejects unsupported overseas activities without curated map data', () => {
    expect(
      resolveTravelGuideSupported({
        legacyId: 7,
        region: 'overseas',
        location: '比利时·Boom De Schorre',
        latitude: 51.0894,
        longitude: 4.3774,
      }),
    ).toBe(false);
  });

  it('supports domestic activities with location or hot path', () => {
    expect(
      resolveTravelGuideSupported({
        legacyId: 4,
        region: undefined,
        location: '深圳·国际会展中心',
      }),
    ).toBe(true);
    expect(
      resolveTravelGuideSupported({
        legacyId: 99,
        region: undefined,
        location: '上海·某场馆',
      }),
    ).toBe(true);
  });

  it('exposes preparing message constant', () => {
    expect(TRAVEL_GUIDE_PREPARING_MESSAGE).toContain('筹备中');
  });
});
