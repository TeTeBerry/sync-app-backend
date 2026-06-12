import {
  isZoneTagAllowed,
  normalizeZoneTag,
  resolveLiveInfoZones,
  zoneLabelForTag,
} from '../../../../src/modules/live-info/domain/live-info-zones.util';

describe('live-info-zones.util', () => {
  it('falls back to venue when activity has no zones', () => {
    expect(resolveLiveInfoZones(null)).toEqual([
      { id: 'venue', label: '全场' },
    ]);
  });

  it('uses configured zones when present', () => {
    expect(
      resolveLiveInfoZones({
        liveInfoZones: [{ id: 'stage_a', label: 'A区' }],
      }),
    ).toEqual([{ id: 'stage_a', label: 'A区' }]);
  });

  it('normalizes missing zoneTag to venue', () => {
    expect(normalizeZoneTag()).toBe('venue');
    expect(normalizeZoneTag('  stage_a  ')).toBe('stage_a');
  });

  it('validates allowed zone tags', () => {
    const zones = [
      { id: 'stage_a', label: 'A' },
      { id: 'venue', label: '全场' },
    ];
    expect(isZoneTagAllowed('stage_a', zones)).toBe(true);
    expect(isZoneTagAllowed('unknown', zones)).toBe(false);
  });

  it('maps zone label from config', () => {
    const zones = [{ id: 'stage_b', label: 'B区' }];
    expect(zoneLabelForTag(zones, 'stage_b')).toBe('B区');
    expect(zoneLabelForTag(zones, undefined)).toBe('全场');
  });
});
