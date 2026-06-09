import { normalizeStructuredDjQuery } from '@src/ai/dj/dj-info-structured.util';

describe('dj-info-structured.util', () => {
  it('normalizes LLM structured output', () => {
    expect(
      normalizeStructuredDjQuery({
        intent: 'similar_artists',
        referenceArtist: 'Marshmello',
        styles: ['Future Bass', 'Pop EDM'],
        scope: 'catalog',
      }),
    ).toEqual({
      intent: 'similar_artists',
      referenceArtist: 'Marshmello',
      artistName: undefined,
      styles: expect.arrayContaining(['Future Bass', 'Pop EDM']),
      scope: 'catalog',
    });
  });

  it('rejects invalid intent', () => {
    expect(
      normalizeStructuredDjQuery({
        intent: 'unknown_intent',
      }),
    ).toBeNull();
  });

  it('normalizes artist_discography intent', () => {
    expect(
      normalizeStructuredDjQuery({
        intent: 'artist_discography',
        artistName: 'Marshmello',
      }),
    ).toEqual({
      intent: 'artist_discography',
      artistName: 'Marshmello',
      referenceArtist: undefined,
      styles: [],
      scope: 'catalog',
    });
  });

  it('defaults similar_artists to catalog scope', () => {
    expect(
      normalizeStructuredDjQuery({
        intent: 'similar_artists',
        referenceArtist: 'Marshmello',
      }),
    ).toMatchObject({
      intent: 'similar_artists',
      scope: 'catalog',
    });
  });
});
