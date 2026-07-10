import {
  getAllHotPathFallbackPois,
  getHotPathFallbackPois,
} from '@src/data/travel-guide/travel-guide-hot-path-pois.data';

describe('travel-guide-hot-path-pois', () => {
  it('provides storm activity fallback nightlife (hotels come from Amap only)', () => {
    const hotels = getHotPathFallbackPois(4, 'hotel', '酒店');
    const nightlife = getHotPathFallbackPois(4, 'nightlife_food', '夜宵');
    expect(hotels).toHaveLength(0);
    expect(nightlife.length).toBeGreaterThanOrEqual(1);
  });

  it('provides TML Shanghai fallback nightlife near expo park', () => {
    const nightlife = getHotPathFallbackPois(16, 'nightlife_food', '夜宵');
    expect(nightlife.length).toBeGreaterThanOrEqual(1);
    expect(nightlife.some((p) => /海底捞|很久以前/.test(p.name))).toBe(true);
  });

  it('returns full set for collector merge', () => {
    const all = getAllHotPathFallbackPois(4);
    expect(all.some((p) => p.kind === 'hotel')).toBe(false);
    expect(all.some((p) => p.kind.startsWith('nightlife'))).toBe(true);
  });

  it('provides tier-diverse EDC thailand fallback hotels by keyword', () => {
    const economy = getHotPathFallbackPois(5, 'hotel', 'hostel');
    const comfort = getHotPathFallbackPois(5, 'hotel', '豪华酒店');
    expect(economy.some((h) => /Lub d|Guesthouse/i.test(h.name))).toBe(true);
    expect(
      comfort.some((h) => /Hilton|InterContinental|Pullman/i.test(h.name)),
    ).toBe(true);
  });

  it('provides Tomorrowland Thailand fallback hotels in Pattaya', () => {
    const hotels = getHotPathFallbackPois(1, 'hotel', '酒店');
    expect(hotels.length).toBeGreaterThanOrEqual(2);
    expect(
      hotels.some((h) =>
        /Pattaya|Hilton|Avani/i.test(`${h.name} ${h.address}`),
      ),
    ).toBe(true);
    expect(hotels.some((h) => /北京|北清路|合生汇/.test(h.name))).toBe(false);
  });

  it('provides verified De Schorre parking for Tomorrowland Belgium', () => {
    const parking = getHotPathFallbackPois(7, 'parking', 'parking');
    expect(parking).toHaveLength(2);
    expect(parking.map((poi) => poi.address)).toEqual(
      expect.arrayContaining([
        'Schommelei 1, 2850 Boom, Belgium',
        'Kapelstraat, 2850 Boom, Belgium',
      ]),
    );
  });

  it('provides a local vehicle-access POI for every non-China activity without full venue POIs', () => {
    for (const activityLegacyId of [2, 9, 10, 12, 13, 14, 15, 21]) {
      const parking = getHotPathFallbackPois(
        activityLegacyId,
        'parking',
        'parking',
      );
      expect(parking).toHaveLength(1);
      expect(parking[0]?.distanceLabel).toContain('主办方停车指引');
    }
  });

  it('covers every non-China activity with at least one local POI', () => {
    for (const activityLegacyId of [
      1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 21,
    ]) {
      expect(getAllHotPathFallbackPois(activityLegacyId)).not.toHaveLength(0);
    }
  });

  it('provides EDC Korea fallback hotels and nightlife near Incheon', () => {
    const hotels = getHotPathFallbackPois(8, 'hotel', '酒店');
    const nightlife = getHotPathFallbackPois(8, 'nightlife_food', '夜宵');
    expect(hotels.length).toBeGreaterThanOrEqual(3);
    expect(
      hotels.some((h) =>
        /Incheon|Yeongjong|Paradise|Hyatt/i.test(`${h.name} ${h.address}`),
      ),
    ).toBe(true);
    expect(nightlife.length).toBeGreaterThanOrEqual(1);

    const all = getAllHotPathFallbackPois(8);
    expect(all.some((p) => p.kind === 'hotel')).toBe(true);
    expect(all.some((p) => p.kind.startsWith('nightlife'))).toBe(true);
  });

  it('provides S2O Korea fallback hotels near Seoul Land', () => {
    const hotels = getHotPathFallbackPois(3, 'hotel', '酒店');
    expect(hotels.length).toBeGreaterThanOrEqual(4);
    expect(hotels.some((h) => /Seoul|Lotte|Gangnam/i.test(h.name))).toBe(true);
  });

  it('provides WDJF and Ultra Japan fallback hotels in Tokyo', () => {
    const wdjf = getHotPathFallbackPois(6, 'hotel', '酒店');
    const ultra = getHotPathFallbackPois(11, 'hotel', '酒店');
    expect(wdjf.length).toBeGreaterThanOrEqual(4);
    expect(ultra.length).toBeGreaterThanOrEqual(4);
    expect(wdjf.some((h) => /Tokyo|Daiba|Ariake/i.test(h.name))).toBe(true);
  });
});
