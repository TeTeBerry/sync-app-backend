import { Test } from '@nestjs/testing';
import { ArtistProfileResolver } from '@src/modules/itinerary/artist-profile-resolver.service';
import { LineupCatalogService } from '@src/modules/itinerary/lineup-catalog.service';
import { DjService } from '@src/modules/dj/dj.service';

describe('ArtistProfileResolver', () => {
  it('merges catalog profile into artist detail', async () => {
    const lineupCatalog = {
      resolveCatalogLineupArtistById: jest.fn().mockResolvedValue({
        id: 'dj-snake',
        name: 'DJ Snake',
        genreLabel: 'Trap',
        activityCount: 1,
      }),
    };
    const djService = {
      lookupForLineupArtists: jest.fn().mockResolvedValue(
        new Map([
          [
            'DJ Snake',
            {
              discogsId: 9,
              name: 'DJ Snake',
              profile: 'International DJ profile text',
              genres: ['Electronic'],
              styles: ['Trap'],
            },
          ],
        ]),
      ),
      resolveProfileForDisplay: jest
        .fn()
        .mockResolvedValue('International DJ profile text'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistProfileResolver,
        { provide: LineupCatalogService, useValue: lineupCatalog },
        { provide: DjService, useValue: djService },
      ],
    }).compile();

    const resolver = moduleRef.get(ArtistProfileResolver);
    const artist = await resolver.getCatalogLineupArtistDetail('dj-snake');

    expect(artist.name).toBe('DJ Snake');
    expect(artist.profileFull).toBe('International DJ profile text');
    expect(artist.profileSummary).toContain('International DJ');
  });
});
