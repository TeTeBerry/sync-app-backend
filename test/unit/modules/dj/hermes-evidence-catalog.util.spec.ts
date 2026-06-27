import {
  catalogGenresFromHermesEvidence,
  catalogItemFromHermesMapRow,
  enrichCatalogItemFromHermesEvidence,
} from '@src/modules/dj/hermes-evidence-catalog.util';

describe('hermes-evidence-catalog.util', () => {
  const stanneEvidence = {
    integratedReport:
      'STANNE is a hard techno DJ from Belgium with festival bookings.',
    sourcedFacts: [{ claim: 'genre hint', value: 'Hard techno', source: 'RA' }],
    web: [
      {
        snippet: 'Belgian hard techno producer',
        relevance: 'high',
      },
    ],
  };

  it('extracts genres from integrated report and sourced facts', () => {
    const { genres } = catalogGenresFromHermesEvidence(stanneEvidence);
    expect(genres).toContain('Hard techno');
  });

  it('enriches empty catalog item genres from evidence', () => {
    const enriched = enrichCatalogItemFromHermesEvidence(
      {
        discogsId: 990001,
        name: 'STANNE',
        genres: [],
        styles: [],
      },
      stanneEvidence,
    );

    expect(enriched.genres).toContain('Hard techno');
    expect(enriched.styles).toContain('Hard techno');
    expect(enriched.profile).toContain('hard techno');
  });

  it('keeps existing catalog genres over evidence', () => {
    const enriched = enrichCatalogItemFromHermesEvidence(
      {
        discogsId: 1,
        name: 'Artist',
        genres: ['Techno'],
        styles: ['Techno'],
      },
      stanneEvidence,
    );

    expect(enriched.genres).toEqual(['Techno']);
  });

  it('builds synthetic catalog item from map row', () => {
    const item = catalogItemFromHermesMapRow({
      lineupName: 'STANNE',
      discogsName: 'Stanne',
      discogsId: 990001,
      hermesEvidence: stanneEvidence,
    });

    expect(item?.name).toBe('Stanne');
    expect(item?.genres).toContain('Hard techno');
  });
});
