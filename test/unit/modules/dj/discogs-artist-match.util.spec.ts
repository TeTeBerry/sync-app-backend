import {
  artistRefsFromRelease,
  buildLineupSearchStrategies,
  defaultLineupSearchQueryLabel,
  DISCOGS_LINEUP_SEARCH_GENRE,
  filterDiscogsArtistSearchHits,
  formatDiscogsArtistSearchLabel,
  decideDiscogsArtistMatch,
  DISCOGS_REVIEW_REASON,
  getAmbiguousScoreCluster,
  isLegacyDiscogsV2MapEntry,
  isLineupDiscogsCandidatePlausible,
  isLineupDiscogsNamePlausible,
  isVerifiableDiscogsDjRecord,
  mergeDiscogsArtistRefs,
  pickTiebreakWinner,
  scoreDiscogsArtistCandidate,
  scoreReleaseTagRatios,
  tryBreakDiscogsArtistTie,
} from '@src/modules/dj/discogs-artist-match.util';
import { DISCOGS_LINEUP_SEARCH_ALIASES } from '@src/modules/dj/lineup-name-match.util';

describe('discogs-artist-match.util', () => {
  it('builds v3 lineup search strategies with genre=Electronic on every tier', () => {
    const strategies = buildLineupSearchStrategies('CHARLOTTE DE WITTE');
    expect(strategies.map((strategy) => strategy.id)).toEqual([
      'artist-exact',
      'artist-anv',
      'release-by-artist',
      'release-by-credit',
      'artist-q',
    ]);
    for (const strategy of strategies) {
      expect(strategy.params.genre).toBe(DISCOGS_LINEUP_SEARCH_GENRE);
    }
    expect(defaultLineupSearchQueryLabel('CHARLOTTE DE WITTE')).toBe(
      'artist=CHARLOTTE DE WITTE&genre=Electronic&type=artist',
    );
    expect(
      formatDiscogsArtistSearchLabel({
        type: 'artist',
        artist: 'KSHMR',
        genre: DISCOGS_LINEUP_SEARCH_GENRE,
      }),
    ).toBe('artist=KSHMR&genre=Electronic&type=artist');
  });

  it('keeps alias regression names plausible under v3 name gate', () => {
    const aliasSamples = [
      ['WUJACKERS', 'Wukong'],
      ['OPPIDAN', 'Oppidan (2)'],
      ['VEGAS', 'Vegas (2)'],
      ['KÖLSCH', 'Kölsch'],
      ['GHENGAR', 'Ghengar'],
    ] as const;

    for (const [lineup, alias] of aliasSamples) {
      expect(DISCOGS_LINEUP_SEARCH_ALIASES[lineup]).toBe(alias);
      expect(isLineupDiscogsNamePlausible(lineup, alias, [lineup, alias])).toBe(
        true,
      );
    }
  });

  it('allows Ghastly as trusted match for GHENGAR lineup alias', () => {
    expect(
      isLineupDiscogsNamePlausible('GHENGAR', 'Ghastly', [
        'GHENGAR',
        'Ghengar',
        'Ghastly',
      ]),
    ).toBe(true);
  });

  it('accepts discogs ANV / namevariations on the artist page', () => {
    expect(
      isLineupDiscogsCandidatePlausible(
        'OPPIDAN',
        { name: 'Oppidan (2)', aliases: ['Oppidan'] },
        ['OPPIDAN', 'Oppidan (2)'],
      ),
    ).toBe(true);
    expect(
      isLineupDiscogsNamePlausible('WHYBEATZ', 'Unrelated', [], {
        discogsAliases: ['WhyBeatz'],
      }),
    ).toBe(true);
  });

  it('trusts artist-anv search hits before artist-page verification', () => {
    const strategy = buildLineupSearchStrategies('MARLO')[1];
    const hits = [
      { type: 'artist', id: 10, title: 'Marlo (5)' },
      { type: 'artist', id: 11, title: 'Different Name' },
    ];
    expect(
      filterDiscogsArtistSearchHits(hits, ['MARLO'], strategy.id).map(
        (hit) => hit.id,
      ),
    ).toEqual([10, 11]);
    expect(
      filterDiscogsArtistSearchHits(hits, ['MARLO'], 'artist-exact').map(
        (hit) => hit.id,
      ),
    ).toEqual([10]);
  });

  it('expands release graph refs and dedupes by strategy priority', () => {
    const releaseStrategy = buildLineupSearchStrategies('KSHMR')[2];
    const refs = artistRefsFromRelease(
      {
        artists: [
          { id: 1, name: 'KSHMR' },
          { id: 2, name: 'Guest' },
        ],
      },
      releaseStrategy,
    );
    expect(refs).toHaveLength(2);
    expect(refs[0]).toMatchObject({
      artistId: 1,
      refKind: 'release-graph',
      strategyId: 'release-by-artist',
    });

    const merged = mergeDiscogsArtistRefs([
      ...refs,
      {
        artistId: 1,
        displayName: 'KSHMR',
        strategyId: 'artist-q',
        strategyLabel: 'q=KSHMR',
        refKind: 'artist-hit',
      },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((ref) => ref.artistId === 1)?.strategyId).toBe(
      'release-by-artist',
    );
  });

  it('flags legacy v2 map rows missing genre=Electronic', () => {
    expect(isLegacyDiscogsV2MapEntry({ searchQuery: 'artist=KSHMR' })).toBe(
      true,
    );
    expect(isLegacyDiscogsV2MapEntry({ searchQuery: 'q=KSHMR' })).toBe(true);
    expect(
      isLegacyDiscogsV2MapEntry({
        searchQuery: 'artist=KSHMR&genre=Electronic&type=artist',
        discoveryStrategyId: 'artist-exact',
      }),
    ).toBe(false);
  });

  it('rejects disambiguation stub artist pages', () => {
    expect(
      isLineupDiscogsCandidatePlausible(
        'ALAN WALKER',
        {
          name: 'Alan Walker',
          profile: 'For the British-Norwegian DJ use [a4827622]',
        },
        ['ALAN WALKER'],
      ),
    ).toBe(false);
    expect(
      isVerifiableDiscogsDjRecord({
        profile: 'For the British-Norwegian DJ use [a4827622]',
        styles: ['House'],
        representativeWorks: [{ title: 'Faded' }],
      }),
    ).toBe(false);
  });

  it('rejects wrong homonym profiles via profile trust', () => {
    const marshaSmithProfile =
      'Marsha Smith is a London, UK based DJ, radio host, music consultant, supervisor, mentor, networking and creative developer, also known as Marshmello.';
    expect(
      isLineupDiscogsCandidatePlausible(
        'MARSHMELLO',
        {
          name: 'Marshmello',
          profile: marshaSmithProfile,
        },
        ['MARSHMELLO'],
      ),
    ).toBe(false);
    expect(
      isLineupDiscogsCandidatePlausible(
        'KREAM',
        {
          name: 'Kream (4)',
          profile: 'Kream is a Danish electronic music duo.',
        },
        ['KREAM'],
      ),
    ).toBe(true);
    expect(
      isLineupDiscogsCandidatePlausible(
        'MARSHMELLO',
        {
          name: 'Marshmello (2)',
          profile:
            'Trap and dubstep artist (* May 19th, 1992), DJ and producer from Philadelphia, United States.',
        },
        ['MARSHMELLO'],
      ),
    ).toBe(true);
    expect(
      isLineupDiscogsCandidatePlausible(
        'MARSHMELLO',
        {
          name: 'Marshmello',
          profile:
            'Marshmello (Christopher Comstock) is an American electronic music producer and DJ.',
        },
        ['MARSHMELLO'],
      ),
    ).toBe(true);
  });

  it('filters search hits to exact normalized artist titles', () => {
    const hits = [
      { type: 'artist', id: 1, title: 'Kream (4)' },
      { type: 'artist', id: 2, title: 'Kream' },
      { type: 'artist', id: 3, title: 'Dream (2)' },
      { type: 'release', id: 4, title: 'Kream - EP' },
    ];
    expect(
      filterDiscogsArtistSearchHits(hits, ['KREAM']).map((h) => h.id),
    ).toEqual([1, 2]);
    expect(filterDiscogsArtistSearchHits(hits, ['MARLO'])).toEqual([]);
  });

  it('scores from artist catalog tags when release samples are absent', () => {
    const score = scoreDiscogsArtistCandidate('KSHMR', {
      id: 1,
      name: 'KSHMR',
      profile: 'DJ and electronic music producer.',
      genres: ['Electronic'],
      styles: ['Electro House', 'Progressive House', 'Big Room'],
    });

    expect(score.breakdown.profileElectronicBonus).toBe(30);
    expect(score.breakdown.releaseElectronicBonus).toBe(50);
    expect(score.total).toBeGreaterThanOrEqual(120);
  });

  it('scores electronic DJ from base + profile + release bonuses', () => {
    const score = scoreDiscogsArtistCandidate('Martin Garrix', {
      id: 1,
      name: 'Martin Garrix',
      profile: 'Dutch DJ and festival performer.',
      releaseSamples: [
        {
          genres: ['Electronic'],
          styles: ['Big Room', 'Progressive House'],
        },
        {
          genres: ['Electronic'],
          styles: ['Electro House', 'House'],
        },
        {
          genres: ['Electronic'],
          styles: ['Techno', 'Electro'],
        },
        {
          genres: ['Electronic'],
          styles: ['Trance'],
        },
        {
          genres: ['Electronic'],
          styles: ['House'],
        },
      ],
    });

    expect(score.total).toBeGreaterThanOrEqual(120);
    expect(score.breakdown.base).toBe(100);
    expect(score.breakdown.profileElectronicBonus).toBe(30);
    expect(score.breakdown.releaseElectronicBonus).toBe(50);
  });

  it('rejects pure non-electronic profile with heavy penalty', () => {
    const score = scoreDiscogsArtistCandidate('Martin Garrix', {
      id: 2,
      name: 'Martin Garrix',
      profile: 'Indie rock band and folk singer from Norway.',
      releaseSamples: [
        { genres: ['Rock'], styles: ['Indie Rock'] },
        { genres: ['Folk'], styles: ['Folk'] },
      ],
    });

    expect(score.total).toBeLessThan(60);
    expect(score.breakdown.profileNonElectronicPenalty).toBe(100);
  });

  it('applies release non-electronic penalty when pop/rock dominates', () => {
    const ratios = scoreReleaseTagRatios([
      { genres: ['Pop'], styles: ['Pop Rock'] },
      { genres: ['Rock'], styles: ['Rock'] },
      { genres: ['Hip Hop'], styles: ['Trap'] },
      { genres: ['Pop'], styles: [] },
    ]);
    expect(ratios.nonElectronicRatio).toBeGreaterThanOrEqual(0.4);

    const score = scoreDiscogsArtistCandidate('Artist', {
      id: 3,
      name: 'Artist',
      profile: 'DJ producer',
      releaseSamples: [
        { genres: ['Pop'], styles: ['Pop Rock'] },
        { genres: ['Rock'], styles: ['Rock'] },
        { genres: ['Hip Hop'], styles: ['Trap'] },
        { genres: ['Pop'], styles: [] },
      ],
    });
    expect(score.breakdown.releaseNonElectronicPenalty).toBe(60);
  });

  it('marks sub-threshold top candidate as pending review', () => {
    const decision = decideDiscogsArtistMatch('KSHMR', [
      {
        discogsId: 1,
        name: 'KSHMR',
        total: 100,
        breakdown: {
          base: 100,
          profileElectronicBonus: 0,
          releaseElectronicBonus: 0,
          releaseNonElectronicPenalty: 0,
          profileNonElectronicPenalty: 0,
        },
      },
    ]);

    expect(decision.status).toBe('pending_review');
    if (decision.status === 'pending_review') {
      expect(decision.reviewReason).toContain('可信度不足');
    }
  });

  it('marks no qualifying candidates with empty candidateScores', () => {
    const decision = decideDiscogsArtistMatch('999999999', [
      {
        discogsId: 1,
        name: 'Nobody',
        total: 30,
        breakdown: {
          base: 100,
          profileElectronicBonus: 0,
          releaseElectronicBonus: 0,
          releaseNonElectronicPenalty: 0,
          profileNonElectronicPenalty: 100,
        },
      },
    ]);

    expect(decision.status).toBe('pending_review');
    if (decision.status === 'pending_review') {
      expect(decision.reviewReason).toBe(
        DISCOGS_REVIEW_REASON.NO_QUALIFYING_CANDIDATE,
      );
      expect(decision.candidateScores).toEqual([]);
    }
  });

  it('marks ambiguous high-score candidates for tiebreak review', () => {
    const decision = decideDiscogsArtistMatch('KREAM', [
      {
        discogsId: 1,
        name: 'Kream (4)',
        total: 180,
        breakdown: {
          base: 100,
          profileElectronicBonus: 30,
          releaseElectronicBonus: 50,
          releaseNonElectronicPenalty: 0,
          profileNonElectronicPenalty: 0,
        },
      },
      {
        discogsId: 2,
        name: 'Kream',
        total: 175,
        breakdown: {
          base: 100,
          profileElectronicBonus: 30,
          releaseElectronicBonus: 50,
          releaseNonElectronicPenalty: 0,
          profileNonElectronicPenalty: 0,
        },
      },
    ]);

    expect(decision.status).toBe('pending_review');
    if (decision.status === 'pending_review') {
      expect(decision.needsTiebreak).toBe(true);
      expect(decision.reviewReason).toBe(
        DISCOGS_REVIEW_REASON.HOMONYM_AMBIGUITY,
      );
    }
  });

  it('breaks a tie using release electronic tag counts', () => {
    const winner = tryBreakDiscogsArtistTie(
      {
        id: 1,
        name: 'Porter Robinson',
        profile: 'DJ producer',
        releaseSamples: [
          { genres: ['Electronic'], styles: ['House', 'Electro'] },
          { genres: ['Electronic'], styles: ['Trance'] },
        ],
      },
      {
        id: 2,
        name: 'Porter Robinson (band)',
        profile: 'DJ producer',
        releaseSamples: [{ genres: ['Rock'], styles: ['Indie Rock'] }],
      },
    );

    expect(winner?.id).toBe(1);
  });

  it('breaks a tie using profile keyword density when release tags tie', () => {
    const winner = tryBreakDiscogsArtistTie(
      {
        id: 1,
        name: 'Like Mike',
        profile:
          'Belgian DJ, producer and festival performer in electronic music.',
        releaseSamples: [{ genres: ['Electronic'], styles: ['House'] }],
      },
      {
        id: 2,
        name: 'Like Mike (MC)',
        profile: 'DJ.',
        releaseSamples: [{ genres: ['Electronic'], styles: ['House'] }],
      },
    );

    expect(winner?.id).toBe(1);
  });

  it('breaks a tie using release type preference when tags and profile tie', () => {
    const winner = tryBreakDiscogsArtistTie(
      {
        id: 1,
        name: 'Angerfist',
        profile: 'DJ producer',
        releaseSamples: [
          {
            genres: ['Electronic'],
            styles: ['Hardcore'],
            title: 'Raise Your Fist (Remix)',
            formatDescriptions: ['Remix'],
          },
        ],
      },
      {
        id: 2,
        name: 'Angerfist (band)',
        profile: 'DJ producer',
        releaseSamples: [
          {
            genres: ['Electronic'],
            styles: ['Hardcore'],
            title: 'Greatest Hits Album',
            formatDescriptions: ['Album', 'Compilation'],
          },
        ],
      },
    );

    expect(winner?.id).toBe(1);
  });

  it('returns null when tie-break criteria are still equal', () => {
    const winner = tryBreakDiscogsArtistTie(
      {
        id: 1,
        name: 'Artist A',
        profile: 'DJ producer',
        releaseSamples: [{ genres: ['Electronic'], styles: ['House'] }],
      },
      {
        id: 2,
        name: 'Artist B',
        profile: 'DJ producer',
        releaseSamples: [{ genres: ['Electronic'], styles: ['House'] }],
      },
    );

    expect(winner).toBeNull();
  });

  it('collects every candidate within the ambiguity gap', () => {
    const eligible = [
      { discogsId: 1, name: 'A', total: 130, breakdown: {} as never },
      { discogsId: 2, name: 'B', total: 130, breakdown: {} as never },
      { discogsId: 3, name: 'C', total: 130, breakdown: {} as never },
      { discogsId: 4, name: 'D', total: 125, breakdown: {} as never },
      { discogsId: 5, name: 'E', total: 100, breakdown: {} as never },
    ];

    expect(getAmbiguousScoreCluster(eligible, 120, 8)).toEqual([
      eligible[0],
      eligible[1],
      eligible[2],
      eligible[3],
    ]);
  });

  it('picks the best candidate across the full tied cluster', () => {
    const winner = pickTiebreakWinner([
      {
        id: 1,
        name: 'Homonym A',
        profile: 'DJ',
        releaseSamples: [{ genres: ['Rock'], styles: ['Indie Rock'] }],
      },
      {
        id: 2,
        name: 'Homonym B',
        profile: 'DJ',
        releaseSamples: [{ genres: ['Rock'], styles: ['Indie Rock'] }],
      },
      {
        id: 25958,
        name: 'Angerfist',
        profile: 'DJ producer and hardcore artist at festivals.',
        releaseSamples: [
          { genres: ['Electronic'], styles: ['Hardcore', 'Gabber'] },
          { genres: ['Electronic'], styles: ['Hardcore'] },
          {
            genres: ['Electronic'],
            styles: ['Hardcore'],
            title: 'Raise Your Fist (Remix)',
            formatDescriptions: ['Remix'],
          },
        ],
      },
    ]);

    expect(winner?.id).toBe(25958);
  });

  it('rejects dj records with no profile and no release-backed styles', () => {
    expect(
      isVerifiableDiscogsDjRecord({
        profile: '',
        styles: [],
        representativeWorks: [],
      }),
    ).toBe(false);
  });

  it('accepts dj records with a substantive discogs profile', () => {
    expect(
      isVerifiableDiscogsDjRecord({
        profile: 'Dutch DJ and electronic music producer.',
        styles: [],
        representativeWorks: [],
      }),
    ).toBe(true);
  });

  it('accepts dj records with release-derived styles and works', () => {
    expect(
      isVerifiableDiscogsDjRecord({
        profile: '',
        styles: ['Hardstyle'],
        representativeWorks: [{ title: 'Spaceman' }],
      }),
    ).toBe(true);
  });

  it('accepts a clear electronic winner at or above 120', () => {
    const decision = decideDiscogsArtistMatch('ALOK', [
      {
        discogsId: 1588397,
        name: 'Alok',
        total: 180,
        breakdown: {
          base: 100,
          profileElectronicBonus: 30,
          releaseElectronicBonus: 50,
          releaseNonElectronicPenalty: 0,
          profileNonElectronicPenalty: 0,
        },
      },
      {
        discogsId: 99,
        name: 'Alok (sound artist)',
        total: 30,
        breakdown: {
          base: 100,
          profileElectronicBonus: 0,
          releaseElectronicBonus: 0,
          releaseNonElectronicPenalty: 0,
          profileNonElectronicPenalty: 100,
        },
      },
    ]);

    expect(decision).toMatchObject({
      status: 'mapped',
      discogsId: 1588397,
      discogsName: 'Alok',
    });
  });

  it('accepts exact normalized discogs names', () => {
    expect(isLineupDiscogsNamePlausible('KREAM', 'Kream (4)')).toBe(true);
    expect(isLineupDiscogsNamePlausible('COSMIC GATE', 'Cosmic Gate')).toBe(
      true,
    );
    expect(
      isLineupDiscogsNamePlausible('WUJACKERS', 'Wukong', ['Wukong']),
    ).toBe(true);
  });

  it('rejects partial, collaborator, and homonym discogs names', () => {
    expect(
      isLineupDiscogsNamePlausible('BRENNAN HEART', 'Hpnotic', [
        'BRENNAN HEART',
      ]),
    ).toBe(false);
    expect(
      isLineupDiscogsNamePlausible('ARMIN VAN BUUREN', 'DJ Chief MC', [
        'ARMIN VAN BUUREN',
      ]),
    ).toBe(false);
    expect(isLineupDiscogsNamePlausible('YOHAN', 'Yohann Mills')).toBe(false);
    expect(isLineupDiscogsNamePlausible('DØMINA', 'Domination (4)')).toBe(
      false,
    );
    expect(isLineupDiscogsNamePlausible('MARLO', 'Marlow')).toBe(false);
    expect(isLineupDiscogsNamePlausible('BLONDEX', 'Blondee')).toBe(false);
    expect(isLineupDiscogsNamePlausible('ARGY', 'Argy K')).toBe(false);
    expect(
      isLineupDiscogsNamePlausible('DIMITRI VEGAS & LIKE MIKE', 'Like Mike'),
    ).toBe(false);
    expect(
      isLineupDiscogsNamePlausible(
        'DAVID FORBES',
        'David Forbes & Mallorca Lee',
      ),
    ).toBe(false);
  });

  it('maps with ANV when decide receives candidate aliases', () => {
    const decision = decideDiscogsArtistMatch(
      'OPPIDAN',
      [
        {
          discogsId: 42,
          name: 'Oppidan (2)',
          total: 180,
          breakdown: {
            base: 100,
            profileElectronicBonus: 30,
            releaseElectronicBonus: 50,
            releaseNonElectronicPenalty: 0,
            profileNonElectronicPenalty: 0,
          },
        },
      ],
      {
        nameMatchVariants: ['OPPIDAN', 'Oppidan (2)'],
        candidateById: new Map([
          [
            42,
            {
              name: 'Oppidan (2)',
              aliases: ['Oppidan'],
            },
          ],
        ]),
      },
    );

    expect(decision).toMatchObject({
      status: 'mapped',
      discogsId: 42,
      discogsName: 'Oppidan (2)',
    });
  });

  it('prefers unnumbered Discogs names in tie-break', () => {
    const winner = pickTiebreakWinner([
      {
        id: 4688591,
        name: 'Marshmello (2)',
        profile: 'Trap and dubstep artist from Philadelphia.',
        releaseSamples: [{ genres: ['Electronic'], styles: ['Trap'] }],
      },
      {
        id: 1001,
        name: 'Marshmello',
        profile: 'Marshmello is an American electronic music producer and DJ.',
        releaseSamples: [{ genres: ['Electronic'], styles: ['Future Bass'] }],
      },
    ]);

    expect(winner?.id).toBe(1001);
  });

  it('maps the next gate-passing candidate when the top score is a homonym', () => {
    const decision = decideDiscogsArtistMatch(
      'MARSHMELLO',
      [
        {
          discogsId: 314685,
          name: 'Marshmello',
          total: 180,
          breakdown: {
            base: 100,
            profileElectronicBonus: 30,
            releaseElectronicBonus: 50,
            releaseNonElectronicPenalty: 0,
            profileNonElectronicPenalty: 0,
          },
        },
        {
          discogsId: 4688591,
          name: 'Marshmello (2)',
          total: 130,
          breakdown: {
            base: 100,
            profileElectronicBonus: 30,
            releaseElectronicBonus: 0,
            releaseNonElectronicPenalty: 0,
            profileNonElectronicPenalty: 0,
          },
        },
      ],
      {
        nameMatchVariants: ['MARSHMELLO'],
        candidateById: new Map([
          [
            314685,
            {
              name: 'Marshmello',
              profile:
                'Marsha Smith is a London, UK based DJ, also known as Marshmello.',
            },
          ],
          [
            4688591,
            {
              name: 'Marshmello (2)',
              profile:
                'Trap and dubstep artist (* May 19th, 1992), DJ and producer from Philadelphia, United States.',
            },
          ],
        ]),
      },
    );

    expect(decision).toMatchObject({
      status: 'mapped',
      discogsId: 4688591,
      discogsName: 'Marshmello (2)',
    });
  });

  it('rejects homonym winner when discogs name does not match lineup', () => {
    const decision = decideDiscogsArtistMatch(
      'BRENNAN HEART',
      [
        {
          discogsId: 6770993,
          name: 'Hpnotic',
          total: 180,
          breakdown: {
            base: 100,
            profileElectronicBonus: 30,
            releaseElectronicBonus: 50,
            releaseNonElectronicPenalty: 0,
            profileNonElectronicPenalty: 0,
          },
        },
      ],
      { nameMatchVariants: ['BRENNAN HEART'] },
    );

    expect(decision.status).toBe('pending_review');
    if (decision.status === 'pending_review') {
      expect(decision.reviewReason).toContain('名称不一致');
    }
  });
});
