import {
  buildDiscogsElectronicSearchQuery,
  decideDiscogsArtistMatch,
  getAmbiguousScoreCluster,
  isVerifiableDiscogsDjRecord,
  pickTiebreakWinner,
  scoreDiscogsArtistCandidate,
  scoreReleaseTagRatios,
  tryBreakDiscogsArtistTie,
} from '@src/modules/dj/discogs-artist-match.util';

describe('discogs-artist-match.util', () => {
  it('builds strict electronic producer search query', () => {
    expect(buildDiscogsElectronicSearchQuery('DJ SNAKE')).toBe(
      '"DJ SNAKE" dj electronic producer',
    );
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
      expect(decision.reviewReason).toContain('存疑');
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
});
