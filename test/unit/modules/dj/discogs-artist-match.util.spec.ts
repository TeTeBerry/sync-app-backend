import {
  buildDiscogsElectronicSearchQuery,
  decideDiscogsArtistMatch,
  scoreDiscogsArtistCandidate,
} from '@src/modules/dj/discogs-artist-match.util';

describe('discogs-artist-match.util', () => {
  it('builds strict electronic producer search query', () => {
    expect(buildDiscogsElectronicSearchQuery('DJ SNAKE')).toBe(
      '"DJ SNAKE" dj electronic producer',
    );
  });

  it('prefers exact name and electronic evidence in scoring', () => {
    const electronic = scoreDiscogsArtistCandidate('Martin Garrix', {
      id: 1,
      name: 'Martin Garrix',
      profile: 'Dutch DJ and electronic music producer.',
      genres: ['Electronic'],
      styles: ['Big Room', 'Progressive House'],
      releaseGenres: ['Electronic'],
      releaseStyles: ['Electro House'],
    });
    const classical = scoreDiscogsArtistCandidate('Martin Garrix', {
      id: 2,
      name: 'Martin Garrix',
      profile: 'Classical composer and orchestra conductor.',
      genres: ['Classical'],
      styles: ['Opera'],
      releaseGenres: ['Classical'],
      releaseStyles: ['Opera'],
    });

    expect(electronic.total).toBeGreaterThan(classical.total);
  });

  it('marks ambiguous top candidates as pending review', () => {
    const decision = decideDiscogsArtistMatch('KREAM', [
      {
        discogsId: 1,
        name: 'Kream (4)',
        total: 58,
        breakdown: {
          nameMatch: 20,
          profileElectronic: 10,
          catalogElectronic: 10,
          releaseElectronic: 18,
          nonElectronicPenalty: 0,
        },
      },
      {
        discogsId: 2,
        name: 'Kream',
        total: 56,
        breakdown: {
          nameMatch: 18,
          profileElectronic: 10,
          catalogElectronic: 10,
          releaseElectronic: 18,
          nonElectronicPenalty: 0,
        },
      },
    ]);

    expect(decision.status).toBe('pending_review');
  });

  it('accepts a clear electronic winner', () => {
    const decision = decideDiscogsArtistMatch('ALOK', [
      {
        discogsId: 1588397,
        name: 'Alok',
        total: 72,
        breakdown: {
          nameMatch: 30,
          profileElectronic: 15,
          catalogElectronic: 15,
          releaseElectronic: 12,
          nonElectronicPenalty: 0,
        },
      },
      {
        discogsId: 99,
        name: 'Alok (sound artist)',
        total: 20,
        breakdown: {
          nameMatch: 12,
          profileElectronic: 0,
          catalogElectronic: 0,
          releaseElectronic: 8,
          nonElectronicPenalty: 12,
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
