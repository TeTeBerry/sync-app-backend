import type { FestivalStayGuide } from '@sync/travel-guide-contracts';

type GuideSeed = Omit<FestivalStayGuide, 'festivalId'>;

const guide = (
  areas: Array<[string, number, string[], string]>,
  estimatedNightlyRange: NonNullable<GuideSeed['estimatedNightlyRange']>,
): GuideSeed => ({
  recommendedAreas: areas.map(([area, score, tags, reason]) => ({
    area,
    score,
    tags,
    reason,
  })),
  estimatedNightlyRange,
});

/**
 * Editorially maintained festival accommodation intelligence. Keep this deliberately
 * small and legible: Raven recommends an area first, then optional inventory lives inside it.
 */
export const FESTIVAL_STAY_GUIDES: Record<string, GuideSeed> = {
  tomorrowland: guide(
    [
      [
        'Pattaya Beach',
        94,
        ['best_balance', 'festival_commute', 'first_timer'],
        'The easiest all-round base for festival transport, food and a softer return after the last set.',
      ],
      [
        'Central Pattaya',
        82,
        ['nightlife', 'late_night'],
        'More energy after the festival, with a slightly busier return.',
      ],
      [
        'Jomtien',
        76,
        ['quiet', 'value'],
        'A calmer beach base if you are happy to plan your late-night ride.',
      ],
    ],
    { min: 90, max: 180, currency: 'USD' },
  ),
  defqon1: guide(
    [
      [
        'Dronten',
        95,
        ['festival_commute', 'first_timer'],
        'The most practical base for the festival gate and the earliest starts.',
      ],
      [
        'Lelystad',
        80,
        ['transport', 'comfort'],
        'More hotel choice with a manageable festival transfer.',
      ],
      [
        'Amsterdam',
        62,
        ['city_break'],
        'Best if you are extending the trip, but not for an effortless late-night return.',
      ],
    ],
    { min: 110, max: 220, currency: 'EUR' },
  ),
  s2o: guide(
    [
      [
        'Jamsil',
        93,
        ['best_balance', 'transport', 'first_timer'],
        'Reliable metro links and an easy return make this the balanced Seoul base.',
      ],
      [
        'Hongdae',
        78,
        ['nightlife'],
        'Best for after-hours Seoul energy, with a longer festival transfer.',
      ],
      [
        'Gangnam',
        74,
        ['comfort', 'city'],
        'Comfortable and connected, but less direct for the festival.',
      ],
    ],
    { min: 90, max: 190, currency: 'USD' },
  ),
  storm: guide(
    [
      [
        'Nanshan',
        90,
        ['best_balance', 'transport'],
        'A comfortable city base with dependable late-night transport options.',
      ],
      [
        'Futian',
        82,
        ['city', 'food'],
        'Central for dining and city time, with a longer venue transfer.',
      ],
      [
        'Baoan',
        76,
        ['festival_commute', 'value'],
        'A practical option when the venue sits toward the airport side of Shenzhen.',
      ],
    ],
    { min: 450, max: 850, currency: 'CNY' },
  ),
  'edc-thailand': guide(
    [
      [
        'Bang Tao',
        95,
        ['best_balance', 'festival_commute', 'first_timer'],
        'Best balance between festival access, beach location and a calmer late-night return.',
      ],
      [
        'Kamala',
        87,
        ['quiet', 'beach'],
        'A relaxed coastal base with a straightforward ride to the festival.',
      ],
      [
        'Patong',
        80,
        ['nightlife'],
        'Great nightlife, but expect a longer commute after the festival.',
      ],
    ],
    { min: 100, max: 200, currency: 'USD' },
  ),
  'world-dj-festival': guide(
    [
      [
        'Odaiba',
        94,
        ['festival_commute', 'first_timer'],
        'The closest, lowest-friction base for the waterfront festival site.',
      ],
      [
        'Shimbashi',
        84,
        ['transport', 'city'],
        'Excellent rail access with restaurants and a more central Tokyo feel.',
      ],
      [
        'Shibuya',
        72,
        ['nightlife'],
        'The liveliest city option, with a longer return across town.',
      ],
    ],
    { min: 120, max: 240, currency: 'USD' },
  ),
  'tomorrowland-belgium': guide(
    [
      [
        'Boom',
        96,
        ['festival_commute', 'first_timer'],
        'The most effortless festival base when available; book early and expect limited inventory.',
      ],
      [
        'Antwerp',
        88,
        ['best_balance', 'transport', 'nightlife'],
        'The strongest balance of trains, restaurants and a realistic late-night return.',
      ],
      [
        'Brussels',
        72,
        ['city_break'],
        'Best for a wider Belgium trip, but the festival commute needs more planning.',
      ],
    ],
    { min: 140, max: 260, currency: 'EUR' },
  ),
  'edc-korea': guide(
    [
      [
        'Incheon',
        92,
        ['festival_commute', 'first_timer'],
        'Closest practical base for the festival grounds and airport-side logistics.',
      ],
      [
        'Songdo',
        85,
        ['comfort', 'transport'],
        'Modern, calm and convenient for a polished festival weekend.',
      ],
      [
        'Hongdae',
        70,
        ['nightlife'],
        'A fun Seoul extension, but plan a longer late-night transfer.',
      ],
    ],
    { min: 90, max: 190, currency: 'USD' },
  ),
  'untold-romania': guide(
    [
      [
        'Cluj-Napoca Old Town',
        94,
        ['best_balance', 'walkable', 'first_timer'],
        'The easiest place to combine festival access, food and the city atmosphere.',
      ],
      [
        'Central Cluj',
        84,
        ['city', 'nightlife'],
        'Lively and flexible, with a short ride or walk depending on the venue.',
      ],
      [
        'Airport area',
        65,
        ['value'],
        'Useful for an early flight, but not the festival experience.',
      ],
    ],
    { min: 80, max: 160, currency: 'EUR' },
  ),
  creamfields: guide(
    [
      [
        'Warrington',
        92,
        ['festival_commute', 'first_timer'],
        'The most practical town base for shuttles and a lower-stress return.',
      ],
      [
        'Manchester',
        80,
        ['city_break', 'nightlife'],
        'Best for extending the trip, with a longer festival transfer.',
      ],
      [
        'Liverpool',
        70,
        ['city_break'],
        'A strong city weekend, but the least convenient commute.',
      ],
    ],
    { min: 110, max: 220, currency: 'EUR' },
  ),
  'ultra-japan': guide(
    [
      [
        'Odaiba',
        95,
        ['festival_commute', 'first_timer'],
        'Stay close to the bay for the smoothest arrival and exit each day.',
      ],
      [
        'Shimbashi',
        84,
        ['transport', 'city'],
        'A connected base for the festival and Tokyo evenings.',
      ],
      [
        'Shibuya',
        74,
        ['nightlife'],
        'Excellent nightlife, but a longer cross-city ride home.',
      ],
    ],
    { min: 120, max: 250, currency: 'USD' },
  ),
  'untold-dubai': guide(
    [
      [
        'Downtown Dubai',
        90,
        ['best_balance', 'city', 'first_timer'],
        'A comfortable all-round base with easy access to the city and festival transport.',
      ],
      [
        'Business Bay',
        85,
        ['transport', 'value'],
        'Often a smarter balance of space and travel time.',
      ],
      [
        'Dubai Marina',
        72,
        ['beach', 'nightlife'],
        'Beautiful for a longer holiday, but further from the festival core.',
      ],
    ],
    { min: 150, max: 300, currency: 'USD' },
  ),
  'edc-orlando': guide(
    [
      [
        'International Drive',
        93,
        ['best_balance', 'festival_commute', 'first_timer'],
        'The practical EDC base for hotels, food and direct festival shuttle options.',
      ],
      [
        'Downtown Orlando',
        78,
        ['nightlife', 'city'],
        'More local nightlife with a longer return after the festival.',
      ],
      [
        'Lake Buena Vista',
        70,
        ['comfort', 'family'],
        'Comfortable for an extended trip, but less direct for EDC logistics.',
      ],
    ],
    { min: 120, max: 240, currency: 'USD' },
  ),
  soundstorm: guide(
    [
      [
        'Riyadh Front',
        91,
        ['festival_commute', 'comfort'],
        'A low-friction base close to the event district and airport routes.',
      ],
      [
        'Al Olaya',
        84,
        ['city', 'food'],
        'Central restaurants and hotels with a manageable ride to the festival.',
      ],
      [
        'Diplomatic Quarter',
        72,
        ['quiet', 'premium'],
        'A calmer premium stay, with less late-night spontaneity.',
      ],
    ],
    { min: 130, max: 260, currency: 'USD' },
  ),
  'ultra-europe': guide(
    [
      [
        'Split',
        95,
        ['best_balance', 'walkable', 'first_timer'],
        'Stay in Split for the best mix of festival access, sea views and an easy walk or short ride home.',
      ],
      [
        'Bacvice',
        86,
        ['beach', 'nightlife'],
        'Beachside and social, with a quick return after the festival.',
      ],
      [
        'Old Town',
        78,
        ['city', 'culture'],
        'Beautiful and central, but busier and often pricier during festival week.',
      ],
    ],
    { min: 110, max: 220, currency: 'EUR' },
  ),
  'tomorrowland-shanghai': guide(
    [
      [
        'Pudong',
        89,
        ['festival_commute', 'transport'],
        'A dependable base when the event is on the east side of the city.',
      ],
      [
        "People's Square",
        82,
        ['city', 'first_timer'],
        'Best for a full Shanghai weekend, with a longer late-night ride.',
      ],
      [
        'Xuhui',
        74,
        ['nightlife', 'food'],
        'Creative neighbourhood energy, but not the shortest festival transfer.',
      ],
    ],
    { min: 550, max: 1100, currency: 'CNY' },
  ),
  'ultra-taiwan': guide(
    [
      [
        'Xinyi',
        92,
        ['best_balance', 'transport', 'first_timer'],
        'The cleanest balance of city access, food and an easy festival transfer.',
      ],
      [
        'Songshan',
        83,
        ['transport', 'quiet'],
        'Well connected and calmer after the festival.',
      ],
      [
        'Ximending',
        72,
        ['nightlife', 'value'],
        'Lively and affordable, with a longer ride home.',
      ],
    ],
    { min: 90, max: 180, currency: 'USD' },
  ),
  'lost-lands': guide(
    [
      [
        'Thornville',
        95,
        ['festival_commute', 'first_timer'],
        'The closest practical base; reserve early and prioritize a confirmed ride plan.',
      ],
      [
        'Columbus',
        74,
        ['city_break', 'inventory'],
        'More availability and restaurants, with a longer festival transfer.',
      ],
      [
        'Newark',
        70,
        ['value', 'transport'],
        'A quieter alternative that still needs a committed late-night ride.',
      ],
    ],
    { min: 110, max: 220, currency: 'USD' },
  ),
};
