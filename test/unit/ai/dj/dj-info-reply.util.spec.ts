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

      expect(reply).toContain('🎵 Marshmello 近期发行');
      expect(reply).toContain('Happier (2018)');
      expect(reply).toContain('· Happier');
      expect(reply).toContain('· Happier (Remix)');
    });

    it('lists newer releases before older ones', () => {
      const reply = formatArtistDiscographyReply({
        artistName: 'DJ Snake',
        works: [
          {
            releaseId: 1,
            title: 'Legacy',
            year: 2015,
            type: 'single',
            tracks: ['Old Song'],
          },
          {
            releaseId: 2,
            title: 'Fresh',
            year: 2024,
            type: 'single',
            tracks: ['New Song'],
          },
        ],
      });

      expect(reply.indexOf('Fresh (2024)')).toBeLessThan(
        reply.indexOf('Legacy (2015)'),
      );
    });

    it('handles empty discography', () => {
      expect(
        formatArtistDiscographyReply({
          artistName: 'Marshmello',
          works: [],
        }),
      ).toContain('暂未收录该艺人的近期发行');
    });
  });
});
