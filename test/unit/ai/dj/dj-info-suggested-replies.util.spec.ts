import { buildDjInfoSuggestedReplies } from '@src/ai/dj/dj-info-suggested-replies.util';

describe('dj-info-suggested-replies.util', () => {
  it('suggests follow-ups after artist profile', () => {
    expect(
      buildDjInfoSuggestedReplies({
        query: {
          intent: 'artist_profile',
          artistName: 'Marshmello',
          styles: [],
          scope: 'catalog',
        },
      }),
    ).toEqual([
      'Marshmello 近期演出',
      '找类似风格的 DJ',
      'Marshmello 代表作有哪些',
    ]);
  });

  it('suggests lineup chip on homepage after similar artists', () => {
    expect(
      buildDjInfoSuggestedReplies({
        query: {
          intent: 'similar_artists',
          referenceArtist: 'Marshmello',
          styles: ['Future Bass'],
          scope: 'catalog',
        },
      }),
    ).toEqual(['Marshmello 近期演出', '风暴电音节阵容']);
  });
});
