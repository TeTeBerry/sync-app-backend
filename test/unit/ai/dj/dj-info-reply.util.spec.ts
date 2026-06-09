import { formatArtistDiscographyReply } from '@src/ai/dj/dj-info-reply.util';

describe('dj-info-reply.util', () => {
  describe('formatArtistDiscographyReply', () => {
    it('formats releases with tracks', () => {
      const reply = formatArtistDiscographyReply({
        artistName: 'Marshmello',
        works: [
          {
            releaseId: 1,
            title: 'Happier',
            year: 2018,
            type: 'single',
            tracks: ['Happier', 'Happier (Remix)'],
          },
        ],
      });

      expect(reply).toContain('🎵 Marshmello 代表作');
      expect(reply).toContain('Happier (2018)');
      expect(reply).toContain('· Happier');
      expect(reply).toContain('· Happier (Remix)');
    });

    it('handles empty discography', () => {
      expect(
        formatArtistDiscographyReply({
          artistName: 'Marshmello',
          works: [],
        }),
      ).toContain('暂未收录该艺人的曲目列表');
    });
  });
});
