import {
  buildArtistProfileDetailFromCatalog,
  pickRepresentativeTrackTitles,
} from '@src/modules/itinerary/utils/artist-profile-detail.util';

describe('artist-profile-detail.util', () => {
  describe('pickRepresentativeTrackTitles', () => {
    it('returns up to three unique track titles from newest releases first', () => {
      expect(
        pickRepresentativeTrackTitles([
          {
            releaseId: 1,
            title: 'Album A',
            year: 2024,
            tracks: ['Track One', 'Track Two'],
          },
          {
            releaseId: 2,
            title: 'Album B',
            year: 2023,
            tracks: ['Track Three', 'Track Four'],
          },
        ]),
      ).toEqual(['Track One', 'Track Two', 'Track Three']);
    });

    it('prefers tracks from the most recent releases', () => {
      expect(
        pickRepresentativeTrackTitles([
          {
            releaseId: 1,
            title: 'Legacy Album',
            year: 2015,
            tracks: ['Old Hit'],
          },
          {
            releaseId: 2,
            title: 'Fresh Single',
            year: 2024,
            tracks: ['New Track'],
          },
        ]),
      ).toEqual(['New Track', 'Old Hit']);
    });

    it('falls back to release title when tracks are empty', () => {
      expect(
        pickRepresentativeTrackTitles([
          { releaseId: 1, title: 'Turn Down for What', tracks: [] },
        ]),
      ).toEqual(['Turn Down for What']);
    });
  });

  describe('buildArtistProfileDetailFromCatalog', () => {
    it('builds summary, full profile, and representative tracks', () => {
      const detail = buildArtistProfileDetailFromCatalog({
        discogsId: 1,
        name: 'DJ Snake',
        genres: ['Electronic'],
        styles: ['EDM'],
        profile: 'International DJ profile text from Discogs',
        representativeWorks: [
          {
            releaseId: 1,
            title: 'Encore',
            tracks: ['Middle', 'Talk'],
          },
        ],
      });

      expect(detail.profileSummary).toContain('International DJ');
      expect(detail.profileFull).toBe(
        'International DJ profile text from Discogs',
      );
      expect(detail.representativeTracks).toEqual(['Middle', 'Talk']);
    });
  });
});
